import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * ============================================================================
 * lib/admin-session.ts — PHIÊN ADMIN PHÍA SERVER (để bảo vệ API nhạy cảm)
 * ============================================================================
 *
 * BỐI CẢNH: Ứng dụng đăng nhập bằng `localStorage` (xem context/AuthContext),
 * nên PHÍA SERVER không có session. Nếu API chỉ tin `username` do client gửi lên
 * thì bất kỳ ai cũng có thể giả mạo (tên admin `quanlykinhteso` nằm trong source).
 *
 * GIẢI PHÁP: khi đăng nhập thành công, `/api/auth/login` ký một TOKEN HMAC-SHA256
 * lưu trong cookie `httpOnly`. API đọc cookie + kiểm tra chữ ký + đối chiếu lại
 * `role` trong bảng `app_users`. Client không thể tự tạo token hợp lệ.
 *
 * ⚠️ Đây là lớp bảo vệ BỔ SUNG cho các API nguy hiểm (mass-sync, xoá dữ liệu...).
 * Luôn dùng kèm kiểm tra same-origin.
 * ============================================================================
 */

const COOKIE_NAME = "b3_admin_session";
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 giờ
const ADMIN_USERNAME = "quanlykinhteso";

/** Secret ký token: ưu tiên biến môi trường, fallback về service-role key. */
function getSigningSecret(): string {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "dashboard-fallback-admin-session-secret"
  );
}

function base64url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function sign(payload: string): string {
  return createHmac("sha256", getSigningSecret()).update(payload).digest("base64url");
}

export interface AdminSessionPayload {
  username: string;
  role?: string | null;
  exp: number;
}

/** Tạo token đã ký. */
export function createAdminToken(
  username: string,
  role?: string | null
): { token: string; maxAge: number } {
  const payload: AdminSessionPayload = {
    username,
    role: role ?? null,
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const body = base64url(JSON.stringify(payload));
  return { token: `${body}.${sign(body)}`, maxAge: TOKEN_TTL_MS / 1000 };
}

/** Xác minh chữ ký + hạn token (không cần DB). */
export function verifyAdminToken(
  token: string | undefined
): AdminSessionPayload | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;

  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as AdminSessionPayload;
    if (!payload?.username || typeof payload.exp !== "number") return null;
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export const ADMIN_SESSION_COOKIE = COOKIE_NAME;

/**
 * Yêu cầu Admin hợp lệ cho một API route.
 * - Token trong cookie phải đúng chữ ký và còn hạn.
 * - Đối chiếu lại `role` trong DB (token cũ không giữ quyền sau khi đổi role).
 * - Phải cùng origin để chặn kích hoạt chéo site.
 */
export async function requireAdmin(
  isSameOrigin: (req: Request) => boolean,
  req: Request
): Promise<{ ok: true; username: string } | { ok: false; status: number; error: string }> {
  if (!isSameOrigin(req)) {
    return { ok: false, status: 403, error: "Forbidden: không cho phép yêu cầu chéo site" };
  }

  const cookieStore = await cookies();
  const payload = verifyAdminToken(cookieStore.get(COOKIE_NAME)?.value);
  if (!payload) {
    return { ok: false, status: 401, error: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại." };
  }

  const isAdminUser = payload.role === "admin" || payload.username === ADMIN_USERNAME;

  const { getSupabaseAdmin } = await import("@/lib/supabase");
  const { data } = await getSupabaseAdmin()
    .from("app_users")
    .select("username, role")
    .eq("username", payload.username)
    .maybeSingle();

  if (!data) {
    return { ok: false, status: 401, error: "Tài khoản không tồn tại. Vui lòng đăng nhập lại." };
  }

  const roleOk = data.role === "admin" || data.username === ADMIN_USERNAME;
  if (!roleOk || !isAdminUser) {
    return { ok: false, status: 403, error: "Forbidden: chỉ tài khoản Admin được phép thực hiện" };
  }

  return { ok: true, username: data.username };
}