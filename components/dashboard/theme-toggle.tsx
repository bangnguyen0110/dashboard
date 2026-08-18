"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  // Đảm bảo code chỉ chạy ở Client side sau khi Hydration xong
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Khi đang render ở Server (SSR), hiển thị khung nút tĩnh/placeholder
  if (!mounted) {
    return (
      <button
        type="button"
        aria-label="Đổi giao diện sáng/tối"
        title="Chuyển sang giao diện tối"
        className="glass inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
      >
        <span className="h-4 w-4 rounded-full bg-accent/40" />
      </button>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Đổi giao diện sáng/tối"
      title={isDark ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
      className="glass inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors"
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}