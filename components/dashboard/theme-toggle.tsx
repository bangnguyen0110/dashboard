"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Đổi giao diện sáng/tối"
      title={isDark ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
      className="glass inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-foreground transition hover:scale-105 hover:text-accent"
    >
      {resolvedTheme ? (
        isDark ? (
          <Sun size={18} />
        ) : (
          <Moon size={18} />
        )
      ) : (
        <span className="h-4 w-4 rounded-full bg-accent/40" />
      )}
    </button>
  );
}