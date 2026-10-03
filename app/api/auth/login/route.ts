import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { ADMIN_SESSION_COOKIE, createAdminToken } from "@/lib/admin-session";

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

    // Cấp cookie phiên Admin (httpOnly, ký HMAC) để các API nhạy cảm kiểm tra
    // được phía server. Response body giữ nguyên -> client không phải đổi gì.
    const isAdminUser = data.role === "admin" || data.username === "quanlykinhteso";
    const response = NextResponse.json({ success: true, user: data });

    if (isAdminUser) {
      const { token, maxAge } = createAdminToken(String(data.username), data.role);
      response.cookies.set(ADMIN_SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge,
      });
    }

    return response;
  } catch (error) {
    console.error("Lỗi đăng nhập:", error);
    return NextResponse.json({ error: "Lỗi đăng nhập" }, { status: 500 });
  }
}
