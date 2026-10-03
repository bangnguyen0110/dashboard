"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  REVENUE_TINH_TABLE,
  REVENUE_XA_TABLE,
  type DoanhThuTinhRow,
  type DoanhThuXaRow,
} from "@/lib/revenue-sync";

/**
 * ============================================================================
 * useRevenueRealtime — Lắng nghe Supabase Realtime để "nhảy số" tức thời.
 * ----------------------------------------------------------------------------
 *  - Dashboard Xã : truyền `maXa`  -> nghe bảng `doanh_thu_xa`.
 *  - Dashboard Tỉnh: truyền `maTinh` -> nghe bảng `doanh_thu_tinh` (đã SUM).
 *
 * Không cần F5: mỗi khi Edge Function ghi dữ liệu, Postgres phát sự kiện qua
 * WebSocket và hook cập nhật state ngay lập tức.
 * ============================================================================
 */

export type RealtimeStatus = "connecting" | "connected" | "disconnected" | "error";

interface UseRevenueRealtimeOptions {
  /** Mã Xã/Phường cần lắng nghe (Dashboard Xã). */
  maXa?: string | null;
  /** Mã Tỉnh cần lắng nghe tổng cộng dồn (Dashboard Tỉnh). */
  maTinh?: string | null;
  /** Tạm tắt subscription (vd: tiết kiệm kết nối). */
  enabled?: boolean;
}

interface UseRevenueRealtimeResult {
  /** Bản ghi xã mới nhất nhận qua realtime (null nếu chưa có sự kiện). */
  liveXa: DoanhThuXaRow | null;
  /** Tổng tỉnh mới nhất nhận qua realtime (null nếu chưa có sự kiện). */
  liveTinh: DoanhThuTinhRow | null;
  status: RealtimeStatus;
  /** Tăng mỗi lần nhận sự kiện — dùng kích hoạt hiệu ứng nhảy số. */
  pulse: number;
}

export function useRevenueRealtime({
  maXa,
  maTinh,
  enabled = true,
}: UseRevenueRealtimeOptions): UseRevenueRealtimeResult {
  const [liveXa, setLiveXa] = useState<DoanhThuXaRow | null>(null);
  const [liveTinh, setLiveTinh] = useState<DoanhThuTinhRow | null>(null);
  const [status, setStatus] = useState<RealtimeStatus>("connecting");
  const [pulse, setPulse] = useState(0);
  const pulseRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    if (!maXa && !maTinh) return;

    const channel = supabase.channel(`revenue:${maXa ?? "_"}:${maTinh ?? "_"}`);

    // ---- Lắng nghe doanh thu của XÃ -------------------------------------------------
    if (maXa) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: REVENUE_XA_TABLE,
          filter: `ma_xa=eq.${maXa}`,
        },
        (payload) => {
          const rec = payload as unknown as { new?: DoanhThuXaRow; old?: DoanhThuXaRow };
          const row = rec.new ?? rec.old;
          if (!row) return;
          setLiveXa(row);
          pulseRef.current += 1;
          setPulse(pulseRef.current);
        }
      );
    }

    // ---- Lắng nghe TỔNG TỈNH (đã SUM sẵn bởi trigger) -------------------------------
    if (maTinh) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: REVENUE_TINH_TABLE,
          filter: `ma_tinh=eq.${maTinh}`,
        },
        (payload) => {
          const rec = payload as unknown as { new?: DoanhThuTinhRow; old?: DoanhThuTinhRow };
          const row = rec.new ?? rec.old;
          if (!row) return;
          setLiveTinh(row);
          pulseRef.current += 1;
          setPulse(pulseRef.current);
        }
      );
    }

    channel.subscribe((state) => {
      if (state === "SUBSCRIBED") setStatus("connected");
      else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT") setStatus("error");
      else if (state === "CLOSED") setStatus("disconnected");
    });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [maXa, maTinh, enabled]);

  return { liveXa, liveTinh, status, pulse };
}

export default useRevenueRealtime;