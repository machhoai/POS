"use client";

import { ImagePlus, LoaderCircle } from "lucide-react";
import { useRef } from "react";

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "video/mp4"]);

const validateVideo = (file: File) => new Promise<boolean>((resolve) => {
  const video = document.createElement("video");
  const url = URL.createObjectURL(file);
  video.preload = "metadata";
  video.onloadedmetadata = () => {
    const valid = Number.isFinite(video.duration) && video.duration <= 15.05;
    URL.revokeObjectURL(url);
    resolve(valid);
  };
  video.onerror = () => {
    URL.revokeObjectURL(url);
    resolve(false);
  };
  video.src = url;
});

export default function AdvertisingMediaUploader({ disabled, uploading, onUpload, onInvalid }: {
  disabled: boolean;
  uploading: boolean;
  onUpload: (file: File) => Promise<void>;
  onInvalid: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const select = async (file?: File) => {
    if (!file || !ALLOWED_TYPES.has(file.type)) return onInvalid();
    const maxSize = file.type === "video/mp4" ? 10 * 1024 * 1024 : 20 * 1024 * 1024;
    if (file.size > maxSize) return onInvalid();
    if (file.type === "video/mp4" && !(await validateVideo(file))) return onInvalid();
    await onUpload(file);
    if (input.current) input.current.value = "";
  };
  return (
    <section className="rounded-2xl border border-dashed border-orange-300 bg-orange-50 p-4">
      <input ref={input} hidden type="file" accept="image/png,image/jpeg,image/webp,video/mp4" onChange={(event) => void select(event.target.files?.[0])} />
      <button type="button" disabled={disabled || uploading} onClick={() => input.current?.click()} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 text-xs font-bold text-white disabled:opacity-50">
        {uploading ? <LoaderCircle className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
        {uploading ? "Đang tải lên…" : "Thêm hình ảnh hoặc video"}
      </button>
      <p className="mt-2 text-xs leading-5 text-orange-900/75">PNG, JPG, WEBP hoặc MP4. Video tối đa 15 giây; playlist tối đa 10 mục.</p>
    </section>
  );
}
