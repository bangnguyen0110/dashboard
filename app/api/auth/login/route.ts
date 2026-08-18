import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * Xác thực đăng nhập dựa trên bảng `app_users` theo `username` + `password`
 * (không dùng email). Dùng service role để vượt RLS. KHÔNG trả về mật khẩu.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const username = String(body?.username ?? "").trim();
    const password = String(body?.password ?? "");

    if (!username || !password) {
      return NextResponse.json(
        { error: "Thiếu tài khoản hoặc mật khẩu" },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from("app_users")
      .select("id, username, role, created_at")
      .eq("username", username)
      .eq("password", password)
      .maybeSingle();

    if (error) {
      console.error("Supabase Error:", error);
      return NextResponse.json(
        { error: "Lỗi xác thực, vui lòng thử lại" },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Tài khoản hoặc mật khẩu không đúng" },
        { status: 401 }
      );
    }

    return NextResponse.json({ success: true, user: data });
  } catch (error) {
    console.error("Lỗi đăng nhập:", error);
    return NextResponse.json({ error: "Lỗi đăng nhập" }, { status: 500 });
  }
}
