import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function importData() {
  console.log("🚀 Bắt đầu tiến trình nạp dữ liệu Tỉnh & Phường/Xã...");

  const filePath = path.join(process.cwd(), "Danh-muc-Phuong-xa_moi.xlsx");
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Đọc dữ liệu dưới dạng mảng 2 chiều để định vị cột chính xác
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  let idxProvCode = -1, idxProvName = -1, idxCommCode = -1, idxCommName = -1;
  let startRow = -1;

  for (let r = 0; r < Math.min(10, rawData.length); r++) {
    const row = rawData[r] || [];
    for (let c = 0; c < row.length; c++) {
      const val = String(row[c] || "").trim();
      if (val.includes("Mã tỉnh (BNV)")) idxProvCode = c;
      if (val.includes("Tên tỉnh/TP mới")) idxProvName = c;
      if (val.includes("Mã phường/xã mới")) idxCommCode = c;
      if (val.includes("Tên Phường/Xã mới")) idxCommName = c;
    }
    if (idxProvCode !== -1 && idxCommCode !== -1) {
      startRow = r + 1;
      break;
    }
  }

  if (startRow === -1) {
    console.error("❌ Không tìm thấy các cột tiêu đề trong file Excel!");
    return;
  }

  // 1. Xóa dữ liệu cũ
  console.log("🧹 Đang dọn dẹp dữ liệu cũ trên Supabase...");
  await supabase.from("commune_dashboards").delete().neq("id", "0");
  await supabase.from("province_dashboards").delete().neq("id", "0");

  // 2. Gom nhóm dữ liệu Tỉnh và Phường/Xã
  const provinceMap = new Map<string, { id: string; name: string; code: string }>();
  const communes: { id: string; province_id: string; name: string; code: string }[] = [];

  for (let r = startRow; r < rawData.length; r++) {
    const row = rawData[r];
    if (!row) continue;

    const provCodeRaw = row[idxProvCode];
    const provNameRaw = row[idxProvName];
    const commCodeRaw = row[idxCommCode];
    const commNameRaw = row[idxCommName];

    if (!provCodeRaw || !provNameRaw || !commCodeRaw || !commNameRaw) continue;

    const provCode = String(provCodeRaw).trim().padStart(2, "0");
    const provName = String(provNameRaw).trim();
    const commCode = String(commCodeRaw).trim();
    const commName = String(commNameRaw).trim();

    if (!provinceMap.has(provCode)) {
      provinceMap.set(provCode, { id: provCode, name: provName, code: provCode });
    }

    communes.push({ id: commCode, province_id: provCode, name: commName, code: commCode });
  }

  const provinces = Array.from(provinceMap.values());
  console.log(`📌 Phát hiện: ${provinces.length} Tỉnh/TP và ${communes.length} Phường/Xã mới.`);

  // 3. Insert Tỉnh/TP
  console.log("⏳ Đang đẩy 34 Tỉnh/TP vào Supabase...");
  const { error: pErr } = await supabase.from("province_dashboards").insert(provinces);
  if (pErr) {
    console.error("❌ Lỗi nạp Tỉnh:", pErr.message);
    return;
  }
  console.log("✅ Đã nạp xong 34 Tỉnh/TP!");

  // 4. Insert Phường/Xã theo lô (500 bản ghi/đợt)
  console.log("⏳ Đang nạp 3.321 Phường/Xã...");
  const BATCH_SIZE = 500;
  for (let i = 0; i < communes.length; i += BATCH_SIZE) {
    const batch = communes.slice(i, i + BATCH_SIZE);
    const { error: cErr } = await supabase.from("commune_dashboards").insert(batch);
    if (cErr) {
      console.error(`❌ Lỗi đợt ${i}:`, cErr.message);
      return;
    }
    console.log(` -> Đã nạp thành công ${Math.min(i + BATCH_SIZE, communes.length)}/${communes.length} bản ghi...`);
  }

  console.log("🎉 HOÀN THÀNH 100%! Toàn bộ dữ liệu Tỉnh và Phường/Xã mới đã sẵn sàng.");
}

importData().catch(console.error);