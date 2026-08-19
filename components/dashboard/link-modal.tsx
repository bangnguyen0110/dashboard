"use client";

import { useState } from "react";
import { Dialog } from "./dialog";
import type { DashboardRow } from "@/lib/types";

/**
 * Modal "Thiết lập Link": cập nhật `domain_link` (custom domain / URL đính kèm)
 * và `slug` (lưu trong metadata JSONB) cho Dashboard Tỉnh/Xã.
 *
 * Component được render có điều kiện (mount khi mở) nên state khởi tạo mới
 * từ `dashboard` mỗi lần mở modal.
 */

interface LinkModalProps {
  dashboard: DashboardRow;
  onClose: () => void;
  onSaved: () => void;
  /** Khi có: ưu tiên handler parent (ghi base_domain qua API route admin, RLS-safe). */
  onSave?: (domainLink: string, slug: string) => Promise<void>;
}

export function LinkModal({ dashboard, onClose, onSaved, onSave }: LinkModalProps) {
  const [domainLink, setDomainLink] = useState(
    dashboard.base_domain ?? dashboard.metadata?.base_domain ?? dashboard.domain_link ?? ""
  );
  const [slug, setSlug] = useState(dashboard.metadata?.slug ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();

    setSaving(true);
    setError(null);
    try {
      // Khi parent cung cấp onSave (Header Tầng 1): ưu tiên handler trực tiếp —
      // ghi base_domain qua API route admin (getSupabaseAdmin, không bị chặn RLS)
      // + cập nhật State + thông báo bằng alert (UX theo spec). Không dùng fetch mặc định.
      if (onSave) {
        await onSave(domainLink, slug);
        onClose();
        onSaved();
        return;
      }
      const res = await fetch(`/api/v1/dashboards/${dashboard.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: dashboard.title,
          domainLink,
          metadata: { slug },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Lỗi lưu liên kết");
      }

      onClose();
      onSaved();
    } catch (err) {
      setError(
        `Lỗi lưu liên kết: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open
      title={`Thiết lập Link · ${dashboard.unit?.name ?? "Dashboard"}`}
      onClose={onClose}
    >
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label htmlFor="link-domain" className="mb-1 block text-sm opacity-70">
            Domain / URL đính kèm
          </label>
          <input
            id="link-domain"
            type="text"
            value={domainLink}
            onChange={(event) => setDomainLink(event.target.value)}
            placeholder="kinhteso.kiengiang.gov.vn"
            className="glass w-full rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div>
          <label htmlFor="link-slug" className="mb-1 block text-sm opacity-70">
            Slug / đường dẫn rút gọn
          </label>
          <input
            id="link-slug"
            type="text"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            placeholder="kich-thuoc-phat-trien"
            className="glass w-full rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        {error ? <p className="text-xs text-red-400">{error}</p> : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="glass rounded-xl px-4 py-2 text-sm opacity-80 transition hover:opacity-100"
          >
            Huỷ
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-gradient-to-r from-accent to-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-60"
          >
            {saving ? "Đang lưu…" : "Lưu liên kết"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}