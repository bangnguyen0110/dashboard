"use client";

import { useState } from "react";
import { LogOut, ShieldCheck, User as UserIcon } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { LoginModal } from "./LoginModal";

/**
 * Bộ điều khiển xác thực dùng chung cho Header/Trang chủ.
 * - Chưa đăng nhập: nút "Đăng nhập" (mở LoginModal).
 * - Đã đăng nhập: badge Admin/User + nút "Đăng xuất".
 */
export function AuthControls() {
  const { user, isAdmin, loading, logout } = useAuth();
  const [showLogin, setShowLogin] = useState(false);

  // Đang khôi phục phiên từ localStorage — render placeholder để tránh loá
  if (loading) {
    return (
      <span className="glass inline-flex h-10 w-24 shrink-0 animate-pulse items-center justify-center rounded-xl" />
    );
  }

  if (!user) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowLogin(true)}
          className="glass inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium text-foreground/80 transition hover:text-accent"
        >
          <UserIcon size={14} />
          <span>Đăng nhập</span>
        </button>
        <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
      </>
    );
  }

  return (
    <>
      <span className="glass inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-foreground/80">
        {isAdmin ? (
          <ShieldCheck size={13} className="text-emerald-400" />
        ) : (
          <UserIcon size={13} className="opacity-60" />
        )}
        <span>
          {isAdmin ? "Admin" : "User"} · {user.username}
        </span>
      </span>
      <button
        type="button"
        onClick={logout}
        className="glass inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-foreground/70 transition hover:text-rose-400"
      >
        <LogOut size={14} />
        <span>Đăng xuất</span>
      </button>
    </>
  );
}
