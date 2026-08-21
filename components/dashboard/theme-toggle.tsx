"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    const currentTheme = resolvedTheme || theme || "dark";
    const nextTheme = currentTheme === "dark" ? "light" : "dark";
    
    setTheme(nextTheme);

    // Ép class trực tiếp trên thẻ <html> để chuyển đổi tức thì 100%
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      if (nextTheme === "dark") {
        root.classList.add("dark");
        root.classList.remove("light");
      } else {
        root.classList.remove("dark");
        root.classList.add("light");
      }
      localStorage.setItem("theme", nextTheme);
    }
  };

  if (!mounted) {
    return (
      <div className="h-9 w-9 rounded-xl border border-slate-700/50 bg-slate-800/40 p-2" />
    );
  }

  const isDark = (resolvedTheme || theme) === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 bg-white/90 text-slate-700 shadow-sm transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/80 dark:text-cyan-400 dark:hover:bg-slate-700"
      title={isDark ? "Chuyển sang giao diện Sáng" : "Chuyển sang giao diện Tối"}
      aria-label="Toggle Theme"
    >
      {isDark ? (
        <Sun className="h-4 w-4 text-amber-400 transition-transform duration-300 rotate-0 scale-100" />
      ) : (
        <Moon className="h-4 w-4 text-indigo-600 transition-transform duration-300 rotate-0 scale-100" />
      )}
    </button>
  );
}

export default ThemeToggle;