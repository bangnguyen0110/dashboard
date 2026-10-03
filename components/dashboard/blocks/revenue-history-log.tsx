"use client";

import { useEffect, useState } from "react";
import { History, Inbox, Loader2, TrendingDown, TrendingUp } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  REVENUE_HISTORY_TABLE,
  formatRelativeTime,
  formatVnNumber,
  type LichSuDoanhThuRow,
} from "@/lib/revenue-sync";

/**
 * ============================================================================
 * RevenueHistoryLog — Bảng "Lịch sử biến động data-value" của một xã/phường.
 * ----------------------------------------------------------------------------
 * - Đọc `lich_su_doanh_thu` (mới nhất trước).
 * - Tự động CHÈN dòng mới ngay khi DB Trigger ghi log (Supabase Realtime).
 * ============================================================================
 */

interface RevenueHistoryLogProps {
  /** Mã Xã/Phường cần xem lịch sử. */
  maXa?: string | null;
  /** Số dòng tối đa hiển thị (mặc định 50). */
  limit?: number;
  className?: string;
}

export function RevenueHistoryLog({
  maXa,
  limit = 50,
  className = "",
}: RevenueHistoryLogProps) {
  const [rows, setRows] = useState<LichSuDoanhThuRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Tải lịch sử ban đầu (setState SAU await => không vi phạm rule sync-in-effect)
  useEffect(() => {
    if (!maXa) return;
    let active = true;

    void (async () => {
      const { data } = await supabase
        .from(REVENUE_HISTORY_TABLE)
        .select("id, ma_xa, so_cu, so_moi, chenh_lech, nguon, thoi_gian")
        .eq("ma_xa", maXa)
        .order("thoi_gian", { ascending: false })
        .limit(limit);

      if (!active) return;
      setRows((data ?? []) as LichSuDoanhThuRow[]);
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [maXa, limit]);

  // Nghe realtime: chèn dòng log mới lên đầu bảng
  useEffect(() => {
    if (!maXa) return;

    const channel = supabase
      .channel(`revenue-history:${maXa}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: REVENUE_HISTORY_TABLE,
          filter: `ma_xa=eq.${maXa}`,
        },
        (payload) => {
          const rec = payload as unknown as { new?: LichSuDoanhThuRow };
          if (!rec.new) return;
          setRows((prev) => [rec.new as LichSuDoanhThuRow, ...prev].slice(0, limit));
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [maXa, limit]);

  if (!maXa) {
    return (
      <p className={`text-xs text-slate-500 ${className}`}>
        Chưa cấu hình Mã Xã — hãy bấm &quot;Thiết lập doanh thu&quot;.
      </p>
    );
  }

  return (
    <div
      className={`overflow-hidden rounded-xl border-x-2 border-b-2 border-[#1d293d] border-t-0 bg-[#0c1830]/90 ${className}`}
    >
      <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3 text-xs font-semibold text-slate-300">
        <History size={14} className="text-cyan-400" />
        LỊCH SỬ BIẾN ĐỘNG DOANH THU
        <span className="ml-auto font-mono text-[11px] text-slate-500">Mã Xã: {maXa}</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-400">
          <Loader2 size={16} className="animate-spin text-cyan-400" /> Đang tải lịch sử…
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-1 py-8 text-xs text-slate-500">
          <Inbox size={18} className="text-slate-600" />
          Chưa có biến động nào được ghi nhận.
        </div>
      ) : (
        <div className="max-h-[360px] overflow-auto">
          <table className="w-full border-collapse text-left text-[12px]">
            <thead className="sticky top-0 z-10 bg-[#0a1124] text-[10px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 font-semibold">Thời gian</th>
                <th className="px-4 py-2 text-right font-semibold">Số cũ</th>
                <th className="px-4 py-2 text-right font-semibold">Số mới</th>
                <th className="px-4 py-2 text-right font-semibold">Chênh lệch</th>
                <th className="px-4 py-2 font-semibold">Nguồn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((row) => {
                const up = Number(row.chenh_lech) >= 0;
                return (
                  <tr key={row.id} className="transition hover:bg-white/5">
                    <td className="px-4 py-2 text-slate-300">
                      {formatRelativeTime(row.thoi_gian)}
                      <span className="ml-1 text-[10px] text-slate-500">
                        {new Date(row.thoi_gian).toLocaleString("vi-VN")}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-400">
                      {formatVnNumber(row.so_cu)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums font-semibold text-slate-100">
                      {formatVnNumber(row.so_moi)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums font-bold">
                      <span
                        className={`inline-flex items-center gap-1 ${
                          up ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {up ? "+" : ""}
                        {formatVnNumber(row.chenh_lech)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-[11px] text-slate-500">{row.nguon || "push"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default RevenueHistoryLog;