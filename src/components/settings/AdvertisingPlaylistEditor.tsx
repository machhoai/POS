"use client";

import { ArrowDown, ArrowUp, GripVertical, Trash2 } from "lucide-react";
import { useState } from "react";

import type {
  CustomerDisplayAdvertisingMedia,
  CustomerDisplayPlaylistItem,
} from "@/lib/types/customerDisplayAdvertising";

export default function AdvertisingPlaylistEditor({ items, mediaById, disabled, onChange, onRemove }: {
  items: CustomerDisplayPlaylistItem[];
  mediaById: Map<string, CustomerDisplayAdvertisingMedia>;
  disabled: boolean;
  onChange: (items: CustomerDisplayPlaylistItem[]) => void;
  onRemove: (mediaId: string) => void;
}) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    const next = items.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next.map((item, index) => ({ ...item, sort_order: index })));
  };
  if (items.length === 0) {
    return <p className="rounded-2xl bg-slate-50 p-8 text-center text-sm font-semibold text-[var(--color-text-muted)]">Chưa có quảng cáo. Màn hình khách hàng sẽ hiển thị ảnh Joy World mặc định.</p>;
  }
  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const media = mediaById.get(item.media_id);
        if (!media) return null;
        return (
          <article key={item.media_id} draggable={!disabled} onDragStart={() => setDraggedId(item.media_id)} onDragOver={(event) => event.preventDefault()} onDrop={() => { const from = items.findIndex((entry) => entry.media_id === draggedId); if (from >= 0) move(from, index); setDraggedId(null); }} className="grid gap-3 rounded-2xl border border-[var(--color-border)] bg-white p-3 shadow-sm md:grid-cols-[auto_10rem_1fr_auto] md:items-center">
            <GripVertical className="size-5 cursor-grab text-slate-400" />
            <div className="h-24 overflow-hidden rounded-xl bg-slate-950">
              {media.type === "VIDEO" ? (
                <video src={media.download_url} muted preload="metadata" className="h-full w-full object-cover" />
              ) : (
                // Signed preview URLs intentionally bypass the Next image optimizer.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={media.download_url} alt={media.file_name} className="h-full w-full object-cover" />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold text-[var(--color-text-primary)]">{media.file_name}</p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">{media.type === "VIDEO" ? `Video · ${Math.ceil(media.duration_seconds ?? 0)} giây` : "Hình ảnh"}</p>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-xs font-bold">
                <label className="flex items-center gap-2"><input type="checkbox" checked={item.enabled} disabled={disabled} onChange={(event) => onChange(items.map((entry) => entry.media_id === item.media_id ? { ...entry, enabled: event.target.checked } : entry))} className="accent-[var(--color-accent)]" />Hiển thị</label>
                {media.type === "IMAGE" ? <label className="flex items-center gap-2">Thời lượng<input type="number" min={3} max={15} disabled={disabled} value={item.image_duration_seconds ?? 7} onChange={(event) => onChange(items.map((entry) => entry.media_id === item.media_id ? { ...entry, image_duration_seconds: Math.min(15, Math.max(3, Number(event.target.value) || 3)) } : entry))} className="h-8 w-16 rounded-lg border border-[var(--color-border)] px-2" />giây</label> : null}
              </div>
            </div>
            <div className="flex gap-1">
              <button type="button" aria-label="Đưa lên" disabled={disabled || index === 0} onClick={() => move(index, index - 1)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30"><ArrowUp className="size-4" /></button>
              <button type="button" aria-label="Đưa xuống" disabled={disabled || index === items.length - 1} onClick={() => move(index, index + 1)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30"><ArrowDown className="size-4" /></button>
              <button type="button" aria-label="Xóa" disabled={disabled} onClick={() => onRemove(item.media_id)} className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-30"><Trash2 className="size-4" /></button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
