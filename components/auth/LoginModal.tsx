"use client";

import React, { useState } from "react";
import { X, Lock, User as UserIcon, LogIn } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);

    const res = await login(username, password);
    setLoading(false);

    if (res.success) {
      onClose();
    } else {
      setErrorMsg(res.message || "Đăng nhập thất bại");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs min-h-screen overflow-y-auto">
      <div className="relative w-full max-w-md my-auto bg-[#0a1124] border-x-2 border-b-2 border-[#1d293d] border-t-0 rounded-2xl shadow-2xl overflow-hidden text-white">
        
        {/* Header Modal */}
        <div className="bg-[#0c1e38] px-6 py-4 border-b border-[#1d293d] flex justify-between items-center">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-cyan-400 uppercase tracking-wider">
              DASHBOARD KINH TẾ SỐ ĐỊA PHƯƠNG
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Hệ thống xác thực quản trị</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Đăng Nhập */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl text-center">
              {errorMsg}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Tài khoản</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <UserIcon size={16} />
              </div>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Nhập tên tài khoản..."
                className="w-full pl-10 pr-4 py-2.5 bg-[#061121] border-x-2 border-b-2 border-[#1d293d] border-t-0 rounded-xl text-sm focus:outline-hidden focus:border-cyan-400 text-slate-100 placeholder-slate-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Mật khẩu</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock size={16} />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu..."
                className="w-full pl-10 pr-4 py-2.5 bg-[#061121] border-x-2 border-b-2 border-[#1d293d] border-t-0 rounded-xl text-sm focus:outline-hidden focus:border-cyan-400 text-slate-100 placeholder-slate-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-900/30 disabled:opacity-50"
          >
            <LogIn size={16} />
            <span>{loading ? "Đang xác thực..." : "Đăng nhập"}</span>
          </button>
        </form>
      </div>
    </div>
  );
}