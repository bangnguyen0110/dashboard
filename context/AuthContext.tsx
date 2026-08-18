"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

/** Người dùng đã xác thực (không chứa mật khẩu). */
export interface AuthUser {
  id: string;
  username: string;
  role?: string | null;
}

/** Kết quả đăng nhập trả về cho component (tương thích LoginModal). */
export interface LoginResult {
  success: boolean;
  message?: string;
}

interface AuthContextValue {
  /** User hiện tại (null khi chưa đăng nhập). */
  user: AuthUser | null;
  /** Có phải Admin hay không (tài khoản quanlykinhteso / role=admin). */
  isAdmin: boolean;
  /** Đang khôi phục phiên từ localStorage (tránh loá sai quyền khi refresh). */
  loading: boolean;
  /** Đăng nhập theo username + password (bảng app_users). */
  login: (username: string, password: string) => Promise<LoginResult>;
  /** Đăng xuất (xoá trạng thái + localStorage). */
  logout: () => void;
}

const STORAGE_KEY = "app_user";
const ADMIN_USERNAME = "quanlykinhteso";

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * AuthProvider: xác thực với bảng `app_users` trong Supabase theo `username`
 * (không phải email) và `password`. Quyền/trạng thái được lưu vào `localStorage`
 * để giữ quyền Admin khi refresh trang.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Khôi phục phiên đăng nhập từ localStorage khi mount (giữ quyền Admin khi refresh)
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as AuthUser;
        if (parsed && typeof parsed.username === "string") {
          // eslint-disable-next-line react-hooks/set-state-in-effect -- khôi phục phiên đăng nhập từ localStorage (setState sau khi đọc ngoại vi)
          setUser(parsed);
        } else {
          window.localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(
    async (username: string, password: string): Promise<LoginResult> => {
      const uname = username.trim();
      if (!uname || !password) {
        return {
          success: false,
          message: "Vui lòng nhập đầy đủ tài khoản và mật khẩu",
        };
      }
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: uname, password }),
        });
        const data = await res.json().catch(() => null);

        if (!res.ok) {
          return { success: false, message: data?.error ?? "Đăng nhập thất bại" };
        }

        const nextUser = data.user as AuthUser;
        setUser(nextUser);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser));
        return { success: true };
      } catch (err) {
        console.error("Lỗi đăng nhập:", err);
        return { success: false, message: "Lỗi kết nối cơ sở dữ liệu" };
      }
    },
    []
  );

  const logout = useCallback(() => {
    setUser(null);
    window.localStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAdmin:
        !!user && (user.role === "admin" || user.username === ADMIN_USERNAME),
      loading,
      login,
      logout,
    }),
    [user, loading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Hook truy cập trạng thái xác thực — phải dùng bên trong <AuthProvider>. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth phải được dùng bên trong <AuthProvider>");
  }
  return ctx;
}
