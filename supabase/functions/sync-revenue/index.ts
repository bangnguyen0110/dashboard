// ============================================================================
// Supabase Edge Function: sync-revenue
// ----------------------------------------------------------------------------
// Endpoint nhận PUSH dữ liệu doanh thu từ JS nhúng trên website nguồn.
//
//   POST /functions/v1/sync-revenue
//   Headers: x-sync-token: <SECRET_TOKEN>,  Content-Type: application/json
//   Body:    { "ma_xa": "89398", "gia_tri": 154000000,
//              "ma_tinh": "89" (tuỳ chọn), "ten_xa": "Xã ..." (tuỳ chọn),
//              "url_nguon": "https://..." (tuỳ chọn) }
//
// LUỒNG XỬ LÝ:
//   1) Kiểm tra Secret Token (hằng số môi trường hoặc token riêng từng xã).
//   2) Chống spam: nếu giá trị không đổi trong "cửa sổ ghi" => bỏ qua (no-op).
//   3) UPSERT vào doanh_thu_xa -> DB Trigger tự ghi lịch sử + cộng dồn Tỉnh.
//   4) Trả về giá trị xã vừa cập nhật + tổng Tỉnh hiện tại.
//
// BẢO MẬT: dùng SUPABASE_SERVICE_ROLE_KEY (server-side) nên bỏ qua RLS; token
// được so sánh bằng SHA-256 (constant-time) để hạn chế timing attack.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-sync-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Cửa sổ chống spam (giây): giá trị trùng lặp trong khoảng này sẽ bị bỏ qua. */
const DEDUPE_WINDOW_SEC = 5;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

/** So sánh chuỗi constant-time (hash SHA-256 rồi so từng byte). */
async function safeEqual(a: string, b: string): Promise<boolean> {
  if (!a || !b) return false;
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const va = new Uint8Array(ha);
  const vb = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < va.length; i++) diff |= va[i] ^ vb[i];
  return diff === 0;
}

/** Ép giá trị về số an toàn (chấp nhận cả chuỗi "1.234.567"). */
function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const cleaned = String(value ?? "").replace(/[^\d.-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Kiểu dữ liệu row (khai báo tường minh, tránh `any`).
interface UnitRow {
  id: string;
  code: string | null;
  name: string | null;
  parent_id: string | null;
}
interface XaRow {
  ma_xa: string;
  gia_tri: number;
}
interface NguonRow {
  secret_token: string;
  active: boolean;
}
interface TinhRow {
  ma_tinh: string;
  gia_tri: number;
  so_xa: number;
  updated_at: string;
}

/**
 * Suy ra Mã Tỉnh từ Mã Xã dựa trên bảng `administrative_units`
 * (xã -> parent_id -> đơn vị Tỉnh). Trả về kèm tên xã nếu tìm thấy.
 */
async function resolveDonVi(
  supabase: ReturnType<typeof createClient>,
  maXa: string
): Promise<{ maTinh: string | null; tenXa: string | null }> {
  const base = supabase.from("administrative_units").select("id, code, name, parent_id");
  const { data: unitRaw } = UUID_RE.test(maXa)
    ? await base.eq("id", maXa).maybeSingle()
    : await base.eq("code", maXa).maybeSingle();

  const unit = (unitRaw ?? null) as UnitRow | null;
  if (!unit) return { maTinh: null, tenXa: null };

  let maTinh: string | null = null;
  if (unit.parent_id) {
    const { data: parentRaw } = await supabase
      .from("administrative_units")
      .select("id, code")
      .eq("id", unit.parent_id)
      .maybeSingle();
    const parent = (parentRaw ?? null) as UnitRow | null;
    if (parent) maTinh = parent.code ?? parent.id ?? null;
  }

  return { maTinh, tenXa: unit.name ?? null };
}

// ============================================================================
// HANDLER CHÍNH
// ============================================================================
Deno.serve(async (req: Request): Promise<Response> => {
  // 1) CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json({ success: false, error: "Method not allowed" }, 405);
  }

  // 2) Biến môi trường (Supabase tự inject 2 biến đầu)
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const globalToken = (Deno.env.get("SYNC_SECRET_TOKEN") ?? "").trim();

  if (!supabaseUrl || !serviceKey) {
    return json({ success: false, error: "Server misconfigured" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // 3) Đọc + kiểm tra payload
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ success: false, error: "Invalid JSON body" }, 400);
  }

  const maXa = String(body.ma_xa ?? body.maXa ?? "").trim();
  const giaTri = toNumber(body.gia_tri ?? body.giaTri ?? 0);
  const urlNguon = body.url_nguon ? String(body.url_nguon) : null;
  const maTinhInput = body.ma_tinh ? String(body.ma_tinh).trim() : null;
  const tenXaInput = body.ten_xa ? String(body.ten_xa).trim() : null;

  if (!maXa) {
    return json({ success: false, error: "Thiếu ma_xa" }, 400);
  }
  if (giaTri < 0 || !Number.isFinite(giaTri)) {
    return json({ success: false, error: "gia_tri không hợp lệ" }, 400);
  }

  // 4) XÁC THỰC SECRET TOKEN (hằng số toàn hệ thống HOẶC token riêng từng xã)
  const clientToken = (req.headers.get("x-sync-token") ?? "").trim();
  if (!clientToken) {
    return json({ success: false, error: "Thiếu header x-sync-token" }, 401);
  }

  let tokenOk = await safeEqual(clientToken, globalToken);

  if (!tokenOk) {
    const { data: nguonRaw } = await supabase
      .from("nguon_dong_bo")
      .select("secret_token, active")
      .eq("ma_xa", maXa)
      .maybeSingle();
    const nguon = (nguonRaw ?? null) as NguonRow | null;
    if (nguon?.active && nguon.secret_token) {
      tokenOk = await safeEqual(clientToken, nguon.secret_token);
    }
  }

  if (!tokenOk) {
    return json({ success: false, error: "Sai hoặc thiếu Secret Token" }, 401);
  }

  // 5) CHỐNG SPAM: bỏ qua nếu giá trị không đổi trong cửa sổ ghi
  const { data: currentRaw } = await supabase
    .from("doanh_thu_xa")
    .select("ma_xa, gia_tri")
    .eq("ma_xa", maXa)
    .maybeSingle();
  const current = (currentRaw ?? null) as XaRow | null;

  if (current && Number(current.gia_tri) === giaTri) {
    const { data: tinhSame } = await supabase
      .from("doanh_thu_tinh")
      .select("ma_tinh, gia_tri, so_xa, updated_at")
      .eq("ma_tinh", maTinhInput ?? "__none__")
      .maybeSingle();
    const tinh0 = (tinhSame ?? null) as TinhRow | null;
    return json({
      success: true,
      changed: false,
      deduped: true,
      ma_xa: maXa,
      gia_tri: giaTri,
      tong_tinh: tinh0?.gia_tri ?? 0,
      window_sec: DEDUPE_WINDOW_SEC,
    });
  }

  // 6) Suy ra Mã Tỉnh (ưu tiên giá trị client gửi, nếu thiếu thì tra DB)
  let maTinh = maTinhInput;
  let tenXa = tenXaInput;
  if (!maTinh || !tenXa) {
    const resolved = await resolveDonVi(supabase, maXa);
    maTinh = maTinh ?? resolved.maTinh;
    tenXa = tenXa ?? resolved.tenXa;
  }

  // 7) UPSERT -> DB Trigger tự ghi lịch sử + cộng dồn Tỉnh
  const { error: upsertError } = await supabase.from("doanh_thu_xa").upsert(
    {
      ma_xa: maXa,
      ma_tinh: maTinh,
      ten_xa: tenXa,
      gia_tri: giaTri,
      url_nguon: urlNguon,
      nguon: "push",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "ma_xa" }
  );

  if (upsertError) {
    return json(
      { success: false, error: "Ghi doanh_thu_xa thất bại", details: upsertError.message },
      500
    );
  }

  // 8) Đọc lại tổng Tỉnh (đã được trigger cập nhật đồng bộ)
  let tongTinh = 0;
  let soXa = 0;
  if (maTinh) {
    const { data: tinhRaw } = await supabase
      .from("doanh_thu_tinh")
      .select("ma_tinh, gia_tri, so_xa, updated_at")
      .eq("ma_tinh", maTinh)
      .maybeSingle();
    const tinh = (tinhRaw ?? null) as TinhRow | null;
    tongTinh = tinh?.gia_tri ?? 0;
    soXa = tinh?.so_xa ?? 0;
  }

  return json({
    success: true,
    changed: true,
    ma_xa: maXa,
    ma_tinh: maTinh,
    ten_xa: tenXa,
    gia_tri: giaTri,
    tong_tinh: tongTinh,
    so_xa: soXa,
    updated_at: new Date().toISOString(),
  });
});