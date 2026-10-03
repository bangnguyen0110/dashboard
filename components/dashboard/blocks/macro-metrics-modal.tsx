"use client";

import React, { useState, useEffect } from "react";
import { X, Save, RefreshCw, TrendingUp } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { DashboardRow } from "@/lib/types";

interface MacroMetricsModalProps {
  dashboard: DashboardRow;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function MacroMetricsModal({ dashboard, open, onClose, onSaved }: MacroMetricsModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    active_ai_entities: 0,
    annual_gmv_billion: 0,
    night_economy_hours: 8.0,
    avg_tourist_stay_days: 1.2,
    traceable_agri_pct: 0,
    startup_hub_count: 0,
  });

  useEffect(() => {
    if (!open || !dashboard?.id) return;
    const fetchMacroData = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("kpi_macro_metrics")
          .select("*")
          .eq("dashboard_id", dashboard.id)
          .maybeSingle();

        if (data && !error) {
          setFormData({
            active_ai_entities: data.active_ai_entities || 0,
            annual_gmv_billion: data.annual_gmv_billion || 0,
            night_economy_hours: data.night_economy_hours || 8.0,
            avg_tourist_stay_days: data.avg_tourist_stay_days || 1.2,
            traceable_agri_pct: data.traceable_agri_pct || 0,
            startup_hub_count: data.startup_hub_count || 0,
          });
        }
      } catch (err) {
        console.error("Lỗi tải dữ liệu vĩ mô:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchMacroData();
  }, [open, dashboard]);

  if (!open) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        dashboard_id: dashboard.id,
        ...formData,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("kpi_macro_metrics")
        .upsert(payload, { onConflict: "dashboard_id" });

      if (error) throw error;

      alert("✅ Đã lưu chỉ số vĩ mô Tầng B thành công!");
      onSaved();
      onClose();
    } catch (err: any) {
      alert(`❌ Lỗi lưu dữ liệu: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-2xl bg-[#071326] border border-cyan-500/40 rounded-3xl shadow-2xl overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 bg-gradient-to-r from-emerald-950/60 via-[#0a1c38] to-[#071326] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <TrendingUp size={20} />
            </span>
            <div>
              <h3 className="text-base font-bold text-white uppercase tracking-wide">
                Quản Trị Chỉ Số Vĩ Mô & Động Lực Tầng B
              </h3>
              <p className="text-xs text-slate-400">
                Địa bàn: <strong className="text-emerald-300">{dashboard.title}</strong> (Đo lường Kinh tế 02 con số)
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-xl bg-slate-800 text-slate-400 hover:text-white">
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto max-h-[70vh] custom-scrollbar">
          {loading ? (
            <div className="py-12 text-center text-slate-400 flex items-center justify-center gap-2">
              <RefreshCw size={18} className="animate-spin text-emerald-400" />
              <span>Đang tải dữ liệu vĩ mô...</span>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    1. Số chủ thể AI First hoạt động thực chất (Chủ thể)
                  </label>
                  <input
                    type="number"
                    value={formData.active_ai_entities}
                    onChange={(e) => setFormData({ ...formData, active_ai_entities: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm text-white outline-none focus:border-emerald-500"
                    placeholder="VD: 120"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Mục tiêu toàn tỉnh: 10.000 chủ thể, bình quân 250tr/năm.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    2. Tổng doanh thu TMĐT / Kinh tế GMV (Tỷ VNĐ)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.annual_gmv_billion}
                    onChange={(e) => setFormData({ ...formData, annual_gmv_billion: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm text-white outline-none focus:border-emerald-500"
                    placeholder="VD: 45.5"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Doanh thu giao dịch số quy đổi hằng năm.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    3. Thời gian khai thác kinh tế đêm (Giờ/ngày)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={formData.night_economy_hours}
                    onChange={(e) => setFormData({ ...formData, night_economy_hours: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm text-white outline-none focus:border-emerald-500"
                    placeholder="VD: 16.0"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Chuẩn cũ 8h nâng lên 16-18h để tối ưu vòng quay tài sản.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    4. Thời gian lưu trú du lịch trung bình (Ngày)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.avg_tourist_stay_days}
                    onChange={(e) => setFormData({ ...formData, avg_tourist_stay_days: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm text-white outline-none focus:border-emerald-500"
                    placeholder="VD: 2.2"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Mục tiêu chiến lược đến 2030 đạt 2.2 ngày.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    5. Tỷ lệ nông sản truy xuất số & chuẩn ESG (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.traceable_agri_pct}
                    onChange={(e) => setFormData({ ...formData, traceable_agri_pct: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm text-white outline-none focus:border-emerald-500"
                    placeholder="VD: 65.0"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">% nông sản/OCOP dán tem định danh.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    6. Số lượng Hub Xanh / Startup thực chiến (Dự án)
                  </label>
                  <input
                    type="number"
                    value={formData.startup_hub_count}
                    onChange={(e) => setFormData({ ...formData, startup_hub_count: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm text-white outline-none focus:border-emerald-500"
                    placeholder="VD: 5"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Mạng lưới đổi mới sáng tạo địa phương.</p>
                </div>
              </div>
            </>
          )}

          <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-bold bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={saving || loading}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2 text-xs font-bold text-white shadow-lg hover:brightness-110 transition disabled:opacity-50"
            >
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
              <span>Lưu chỉ số vĩ mô</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}