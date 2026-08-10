"use client";

import { useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Check, ImagePlus, Info, RotateCcw, Settings2, Trash2 } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import SettingsTabs from "@/components/settings/SettingsTabs";
import ReceiptDocument from "@/features/receipt/components/ReceiptDocument";
import ReceiptPrintButton from "@/features/receipt/components/ReceiptPrintButton";
import {
    RECEIPT_FONT_WEIGHT_OPTIONS,
    RECEIPT_PAPER_PROFILES,
    RECEIPT_THEMES,
} from "@/features/receipt/config/receiptConfig";
import { SAMPLE_RECEIPT_ORDER } from "@/features/receipt/data/sampleReceipt";
import { useReceiptSettingsStore } from "@/features/receipt/store/useReceiptSettingsStore";
import type {
    ReceiptFontWeight,
    ReceiptFontWeights,
    ReceiptPaperSize,
    ReceiptTheme,
} from "@/features/receipt/types/receipt";
import { useAuth } from "@/lib/contexts/AuthContext";
import { showError, showSuccess } from "@/lib/utils/toast";

const fieldClassName = "min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-text-primary)] shadow-sm transition-colors placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none";
const SAMPLE_INVOICE_REQUEST_URL = "https://invoice-preview.local/request/sample";

const FONT_WEIGHT_FIELDS: Array<{
    key: keyof ReceiptFontWeights;
    label: string;
    description: string;
}> = [
        { key: "storeName", label: "Tên cửa hàng", description: "Tên thương hiệu ở đầu biên lai" },
        { key: "storeDetails", label: "Địa chỉ & hotline", description: "Thông tin liên hệ đầu trang" },
        { key: "receiptTitle", label: "Tiêu đề biên lai", description: "Dòng BIÊN LAI BÁN HÀNG" },
        { key: "orderInfo", label: "Thông tin đơn", description: "Mã đơn, ngày giờ, nhân viên" },
        { key: "tableHeader", label: "Tiêu đề hàng hóa", description: "HÀNG HÓA và THÀNH TIỀN" },
        { key: "itemName", label: "Tên sản phẩm", description: "Tên của từng mặt hàng" },
        { key: "itemDetails", label: "Số lượng & đơn giá", description: "Dòng số lượng, giá và thành tiền" },
        { key: "itemTax", label: "Thuế từng món", description: "Thuế suất và tiền thuế của món" },
        { key: "summary", label: "Tạm tính & giảm giá", description: "Các dòng cộng trừ cuối đơn" },
        { key: "taxTotal", label: "Tổng tiền thuế", description: "Dòng tổng thuế toàn đơn" },
        { key: "grandTotal", label: "Tổng tiền", description: "Số tiền thanh toán cuối cùng" },
        { key: "invoiceQrTitle", label: "Tiêu đề QR hóa đơn", description: "Lời mời quét mã yêu cầu hóa đơn" },
        { key: "invoiceQrHint", label: "Chú thích QR hóa đơn", description: "Thông tin hướng dẫn dưới mã QR" },
        { key: "themeMessage", label: "Câu chủ đề", description: "Câu chúc theo dịp lễ đang chọn" },
        { key: "footer", label: "Hậu mãi & cảm ơn", description: "Nội dung ở cuối biên lai" },
        { key: "decoration", label: "Hoa văn chủ đề", description: "Ngôi sao, hình thoi trang trí" },
    ];

export default function ReceiptSettingsPage() {
    const router = useRouter();
    const { user, userDoc, isLoading: authLoading, logout } = useAuth();
    const settings = useReceiptSettingsStore((state) => state.settings);
    const updateSettings = useReceiptSettingsStore((state) => state.updateSettings);
    const resetSettings = useReceiptSettingsStore((state) => state.resetSettings);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const activeTheme = RECEIPT_THEMES.find((theme) => theme.id === settings.theme) || RECEIPT_THEMES[0];
    useEffect(() => {
        if (!authLoading && (!user || !userDoc)) router.replace("/login");
    }, [authLoading, router, user, userDoc]);

    const handleLogoChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            showError("Logo không hợp lệ", "Vui lòng chọn tệp ảnh PNG, JPG hoặc WEBP.");
            return;
        }
        if (file.size > 600 * 1024) {
            showError("Logo quá lớn", "Vui lòng chọn ảnh nhỏ hơn 600 KB để lưu ổn định trên máy POS.");
            return;
        }
        const reader = new FileReader();
        reader.addEventListener("load", () => {
            if (typeof reader.result !== "string") return;
            updateSettings({ logoDataUrl: reader.result, showLogo: true });
            showSuccess("Đã cập nhật logo", "Ảnh sẽ được chuyển sang đơn sắc khi in nhiệt.");
        });
        reader.addEventListener("error", () => showError("Không thể đọc logo", "Vui lòng chọn một tệp ảnh khác."));
        reader.readAsDataURL(file);
    }, [updateSettings]);

    const handleReset = useCallback(() => {
        resetSettings();
        showSuccess("Đã khôi phục mặc định", "Cấu hình biên lai trên thiết bị đã được đặt lại.");
    }, [resetSettings]);

    if (authLoading || !user || !userDoc) {
        return <div className="flex h-screen items-center justify-center bg-[var(--color-background)]"><div className="flex flex-col items-center gap-3"><div className="size-10 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" /><p className="text-sm text-[var(--color-text-muted)]">Đang tải cấu hình...</p></div></div>;
    }

    return (
        <div className="flex h-screen bg-[var(--color-background)]">
            <Sidebar onLogout={logout} />
            <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
                <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] bg-white px-5 py-3 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-xl bg-orange-50 text-[var(--color-accent)]"><Settings2 className="size-5" /></div>
                        <div><h1 className="text-lg font-extrabold tracking-tight text-[var(--color-text-primary)]">Cấu hình biên lai</h1><p className="text-xs text-[var(--color-text-muted)]">Thiết lập riêng cho máy POS này · tự động lưu trên thiết bị</p></div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="hidden items-center gap-1.5 text-xs font-semibold text-emerald-600 sm:flex"><Check className="size-3.5" /> Đã lưu</span>
                        <button type="button" onClick={handleReset} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--color-border)] bg-white px-3 text-xs font-bold text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)]"><RotateCcw className="size-3.5" />Khôi phục mặc định</button>
                    </div>
                </header>

                <SettingsTabs />

                <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto xl:grid-cols-[minmax(560px,1fr)_430px] xl:overflow-hidden">
                    <div className="space-y-4 p-4 xl:overflow-y-auto">
                        <SettingsSection title="Khổ giấy máy in" description="Các số đo là vùng in thực tế; lề an toàn được đặt bên trong nội dung.">
                            <div className="grid gap-2 sm:grid-cols-3">
                                {Object.values(RECEIPT_PAPER_PROFILES).map((profile) => {
                                    const isSelected = settings.paperSize === profile.id;
                                    return (
                                        <button key={profile.id} type="button" onClick={() => updateSettings({ paperSize: profile.id as ReceiptPaperSize })} className={`relative rounded-2xl border p-3 text-left transition-all ${isSelected ? "border-[var(--color-accent)] bg-orange-50 shadow-[0_0_0_1px_var(--color-accent)]" : "border-[var(--color-border)] bg-white hover:border-orange-200"}`}>
                                            {isSelected && <span className="absolute right-2.5 top-2.5 flex size-5 items-center justify-center rounded-full bg-[var(--color-accent)] text-white"><Check className="size-3" /></span>}
                                            <span className="block text-sm font-extrabold text-[var(--color-text-primary)]">{profile.label}</span>
                                            <span className="mt-1 block text-[11px] leading-relaxed text-[var(--color-text-muted)]">{profile.description}</span>
                                            <span className="mt-3 block h-3 rounded-sm border-x-2 border-b border-black/50 bg-[repeating-linear-gradient(90deg,transparent_0_5px,rgba(0,0,0,.12)_5px_6px)]" style={{ width: `${Math.round((profile.printableWidthMm / 82) * 100)}%` }} aria-hidden="true" />
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="mt-3 flex items-start gap-2 rounded-xl bg-blue-50 px-3 py-2.5 text-xs leading-relaxed text-blue-700"><Info className="mt-0.5 size-4 shrink-0" />POS82 cho phép vùng in tối đa 82 mm. Hãy chọn đúng khổ giấy trong hộp thoại hệ thống khi in lần đầu.</div>
                        </SettingsSection>

                        <SettingsSection title="Nhận diện cửa hàng" description="Logo sẽ tự chuyển sang thang xám, tăng tương phản khi in.">
                            <div className="grid gap-4 md:grid-cols-[150px_1fr]">
                                <div className="rounded-2xl border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-background)] p-3 text-center">
                                    <div className="flex h-20 items-center justify-center overflow-hidden rounded-xl bg-white">
                                        {settings.logoDataUrl ? <Image src={settings.logoDataUrl} alt="Logo hiện tại" width={160} height={100} unoptimized className="object-contain grayscale" style={{ width: `${Math.min(settings.logoWidthMm * 3, 125)}px`, maxHeight: `${Math.min(settings.logoMaxHeightMm * 3, 68)}px`, filter: `grayscale(1) contrast(${settings.logoContrastPercent}%)` }} /> : <ImagePlus className="size-7 text-[var(--color-text-muted)]" />}
                                    </div>
                                    <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogoChange} className="hidden" />
                                    <button type="button" onClick={() => fileInputRef.current?.click()} className="mt-2 text-xs font-bold text-[var(--color-accent)]">{settings.logoDataUrl ? "Thay logo" : "Tải logo lên"}</button>
                                    {settings.logoDataUrl && <button type="button" onClick={() => updateSettings({ logoDataUrl: null })} className="mt-2 flex w-full items-center justify-center gap-1 text-[11px] font-semibold text-red-500"><Trash2 className="size-3" /> Xóa logo</button>}
                                </div>
                                <div className="grid gap-3">
                                    <TextField label="Tên cửa hàng" value={settings.storeName} onChange={(value) => updateSettings({ storeName: value })} maxLength={80} />
                                    <TextField label="Địa chỉ" value={settings.storeAddress} onChange={(value) => updateSettings({ storeAddress: value })} maxLength={160} />
                                    <TextField label="Hotline" value={settings.hotline} onChange={(value) => updateSettings({ hotline: value })} maxLength={40} />
                                </div>
                            </div>
                            <div className="mt-4 grid gap-4 border-t border-[var(--color-border)] pt-4 sm:grid-cols-3">
                                <SliderField label="Chiều rộng logo" value={settings.logoWidthMm} min={12} max={50} step={1} unit="mm" onChange={(value) => updateSettings({ logoWidthMm: value })} />
                                <SliderField label="Chiều cao tối đa" value={settings.logoMaxHeightMm} min={8} max={30} step={1} unit="mm" onChange={(value) => updateSettings({ logoMaxHeightMm: value })} />
                                <SliderField label="Độ đậm logo" value={settings.logoContrastPercent} min={80} max={200} step={5} unit="%" onChange={(value) => updateSettings({ logoContrastPercent: value })} />
                            </div>
                        </SettingsSection>

                        <SettingsSection title="Chủ đề trang trí" description="Chủ đề đổi hoa văn, đường viền và câu chúc; nội dung đơn hàng giữ nguyên.">
                            <div className="grid gap-2 sm:grid-cols-3">
                                {RECEIPT_THEMES.map((theme) => {
                                    const isSelected = settings.theme === theme.id;
                                    return <button key={theme.id} type="button" onClick={() => updateSettings({ theme: theme.id as ReceiptTheme })} className={`rounded-2xl border p-3 text-left transition-all ${isSelected ? "border-[var(--color-accent)] bg-orange-50 shadow-[0_0_0_1px_var(--color-accent)]" : "border-[var(--color-border)] bg-white hover:border-orange-200"}`}><span className="block text-sm font-bold text-[var(--color-text-primary)]">{theme.label}</span><span className="mt-1 block text-[11px] leading-relaxed text-[var(--color-text-muted)]">{theme.description}</span></button>;
                                })}
                            </div>
                            <div className="mt-4 border-t border-[var(--color-border)] pt-4">
                                <ToggleField
                                    label="Hiển thị câu chủ đề"
                                    description="Câu chúc được in trong banner trang trí"
                                    checked={settings.showThemeMessage}
                                    onChange={(checked) => updateSettings({ showThemeMessage: checked })}
                                />
                                <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_190px]">
                                    <div>
                                        <TextField
                                            label={`Câu chủ đề · ${activeTheme.label}`}
                                            value={settings.themeMessages[settings.theme]}
                                            placeholder={activeTheme.defaultMessage || "Nhập câu chủ đề..."}
                                            onChange={(value) => updateSettings({
                                                themeMessages: { ...settings.themeMessages, [settings.theme]: value },
                                            })}
                                            maxLength={120}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => updateSettings({
                                                themeMessages: {
                                                    ...settings.themeMessages,
                                                    [settings.theme]: activeTheme.defaultMessage,
                                                },
                                            })}
                                            className="mt-2 text-[11px] font-bold text-[var(--color-accent)] hover:underline"
                                        >
                                            Dùng câu gợi ý của chủ đề
                                        </button>
                                    </div>
                                    <SliderField
                                        label="Cỡ chữ câu chủ đề"
                                        value={settings.themeMessageFontSizePt}
                                        min={8}
                                        max={16}
                                        step={0.5}
                                        unit="pt"
                                        onChange={(value) => updateSettings({ themeMessageFontSizePt: value })}
                                    />
                                </div>
                            </div>
                        </SettingsSection>

                        <SettingsSection title="QR yêu cầu xuất hóa đơn" description="Điều chỉnh riêng mã QR và phần chữ hướng dẫn xuất hóa đơn.">
                            <ToggleField
                                label="Hiển thị QR xuất hóa đơn"
                                description="Chỉ xuất hiện khi đơn hàng có đường dẫn yêu cầu hợp lệ"
                                checked={settings.showInvoiceRequestQr}
                                onChange={(checked) => updateSettings({ showInvoiceRequestQr: checked })}
                            />
                            <div className="mt-4 grid gap-4 border-t border-[var(--color-border)] pt-4 sm:grid-cols-3">
                                <SliderField
                                    label="Kích thước mã QR"
                                    value={settings.invoiceQrSizeMm}
                                    min={22}
                                    max={50}
                                    step={1}
                                    unit="mm"
                                    onChange={(value) => updateSettings({ invoiceQrSizeMm: value })}
                                />
                                <SliderField
                                    label="Cỡ chữ tiêu đề"
                                    value={settings.invoiceQrTitleFontSizePt}
                                    min={7}
                                    max={14}
                                    step={0.5}
                                    unit="pt"
                                    onChange={(value) => updateSettings({ invoiceQrTitleFontSizePt: value })}
                                />
                                <SliderField
                                    label="Cỡ chữ chú thích"
                                    value={settings.invoiceQrHintFontSizePt}
                                    min={6}
                                    max={12}
                                    step={0.5}
                                    unit="pt"
                                    onChange={(value) => updateSettings({ invoiceQrHintFontSizePt: value })}
                                />
                            </div>
                            <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-800">
                                <Info className="mt-0.5 size-4 shrink-0" />
                                Mã QR luôn in đen–trắng để bảo đảm khả năng quét. Độ đậm của tiêu đề và chú thích được chỉnh riêng trong mục Độ đậm nét in.
                            </div>
                        </SettingsSection>

                        <SettingsSection title="Độ đậm nét in" description="Điều chỉnh riêng từng thành phần. Độ dày nét ổn định hơn màu xám trên máy in nhiệt.">
                            <div className="grid gap-2 md:grid-cols-2">
                                {FONT_WEIGHT_FIELDS.map((field) => (
                                    <FontWeightField
                                        key={field.key}
                                        label={field.label}
                                        description={field.description}
                                        value={settings.fontWeights[field.key]}
                                        onChange={(value) => updateSettings({
                                            fontWeights: { ...settings.fontWeights, [field.key]: value },
                                        })}
                                    />
                                ))}
                            </div>
                        </SettingsSection>

                        <SettingsSection title="Nội dung nâng cao" description="Chọn thông tin bổ sung và cách tính thuế cho đơn hàng cũ.">
                            <div className="grid gap-3 md:grid-cols-2">
                                <ToggleField label="Hiển thị logo" description="Ẩn logo nhưng vẫn giữ tệp đã tải" checked={settings.showLogo} onChange={(checked) => updateSettings({ showLogo: checked })} />
                                <ToggleField label="Hiển thị nhân viên" description="Lấy từ người tạo đơn" checked={settings.showCashier} onChange={(checked) => updateSettings({ showCashier: checked })} />
                                <ToggleField label="Thuế theo từng món" description="In thuế suất và tiền thuế dưới dòng hàng" checked={settings.showItemTax} onChange={(checked) => updateSettings({ showItemTax: checked })} />
                                <ToggleField label="Thông tin liên hệ" description="Hotline và nội dung hậu mãi" checked={settings.showContact} onChange={(checked) => updateSettings({ showContact: checked })} />
                            </div>
                            <div className="mt-4 grid gap-3 md:grid-cols-[180px_1fr]">
                                <label className="grid gap-1.5 text-xs font-bold text-[var(--color-text-secondary)]">Thuế mặc định cho đơn cũ<div className="relative"><input type="number" min={0} max={100} step={0.1} value={settings.defaultTaxRate} onChange={(event) => { const value = Number(event.target.value); updateSettings({ defaultTaxRate: Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0 }); }} className={`${fieldClassName} pr-8`} /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--color-text-muted)]">%</span></div></label>
                                <TextField label="Thông tin hậu mãi" value={settings.afterSalesText} onChange={(value) => updateSettings({ afterSalesText: value })} maxLength={200} />
                            </div>
                            <div className="mt-3"><TextField label="Lời cảm ơn cuối biên lai" value={settings.footerMessage} onChange={(value) => updateSettings({ footerMessage: value })} maxLength={120} /></div>
                        </SettingsSection>
                    </div>

                    <aside className="border-t border-[var(--color-border)] bg-[#e9e8e5] p-4 xl:overflow-y-auto xl:border-l xl:border-t-0">
                        <div className="mx-auto max-w-[390px] xl:sticky xl:top-0">
                            <div className="mb-3 flex items-center justify-between"><div><h2 className="text-sm font-extrabold text-[var(--color-text-primary)]">Xem trước thực tế</h2><p className="text-[11px] text-[var(--color-text-muted)]">{RECEIPT_PAPER_PROFILES[settings.paperSize].printableWidthMm} mm · đơn sắc</p></div><ReceiptPrintButton order={SAMPLE_RECEIPT_ORDER} settings={settings} invoiceRequestUrlOverride={SAMPLE_INVOICE_REQUEST_URL} printMode="dialog" label="In thử" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#202124] px-3.5 text-xs font-bold text-white shadow-md transition-transform active:scale-[0.98] disabled:opacity-60" /></div>
                            <div className="overflow-x-auto rounded-2xl bg-[#d8d6d1] p-5 shadow-inner"><div className="mx-auto w-fit overflow-hidden bg-white shadow-[0_12px_35px_rgba(0,0,0,.18)]"><ReceiptDocument order={SAMPLE_RECEIPT_ORDER} settings={settings} invoiceRequestUrlOverride={SAMPLE_INVOICE_REQUEST_URL} /></div></div>
                            <p className="mt-3 text-center text-[11px] leading-relaxed text-[var(--color-text-muted)]">Bản xem trước dùng dữ liệu mẫu. Khi in đơn thật, mã đơn, thời gian, nhân viên, hàng hóa và thuế được lấy từ đơn hàng.</p>
                        </div>
                    </aside>
                </div>
            </main>
        </div>
    );
}

function SettingsSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
    return <section className="rounded-2xl border border-[var(--color-border)] bg-white p-4 shadow-sm"><div className="mb-4"><h2 className="text-sm font-extrabold text-[var(--color-text-primary)]">{title}</h2><p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{description}</p></div>{children}</section>;
}

function TextField({ label, value, onChange, maxLength, placeholder }: { label: string; value: string; onChange: (value: string) => void; maxLength: number; placeholder?: string }) {
    return <label className="grid gap-1.5 text-xs font-bold text-[var(--color-text-secondary)]">{label}<input type="text" value={value} maxLength={maxLength} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className={fieldClassName} /></label>;
}

function ToggleField({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
    return <label className="flex min-h-[62px] cursor-pointer items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 py-2.5"><span><span className="block text-xs font-bold text-[var(--color-text-primary)]">{label}</span><span className="mt-0.5 block text-[11px] text-[var(--color-text-muted)]">{description}</span></span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="peer sr-only" /><span className="relative h-6 w-11 shrink-0 rounded-full bg-gray-300 transition-colors peer-checked:bg-[var(--color-accent)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--color-accent)] after:absolute after:left-1 after:top-1 after:size-4 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:after:translate-x-5" /></label>;
}

function SliderField({ label, value, min, max, step, unit, onChange }: { label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (value: number) => void }) {
    return (
        <label className="grid gap-2 text-xs font-bold text-[var(--color-text-secondary)]">
            <span className="flex items-center justify-between gap-2"><span>{label}</span><output className="rounded-md bg-orange-50 px-2 py-1 font-mono text-[11px] text-[var(--color-accent)]">{value}{unit}</output></span>
            <input type="range" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} className="h-2 w-full cursor-pointer accent-[var(--color-accent)]" />
        </label>
    );
}

function FontWeightField({ label, description, value, onChange }: { label: string; description: string; value: ReceiptFontWeight; onChange: (value: ReceiptFontWeight) => void }) {
    return (
        <label className="flex min-h-[68px] items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 py-2.5">
            <span className="min-w-0"><span className="block text-xs text-[var(--color-text-primary)]" style={{ fontWeight: value }}>{label}</span><span className="mt-0.5 block text-[11px] text-[var(--color-text-muted)]">{description}</span></span>
            <select value={value} onChange={(event) => onChange(Number(event.target.value) as ReceiptFontWeight)} className="min-h-10 w-[112px] shrink-0 rounded-lg border border-[var(--color-border)] bg-white px-2 text-xs font-semibold text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none" aria-label={`Độ đậm ${label}`}>
                {RECEIPT_FONT_WEIGHT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
        </label>
    );
}

function ThemeCardPreview({ theme }: { theme: ReceiptTheme }) {
    const lineClassName = theme === "NATIONAL_DAY" ? "h-1 border-y border-black" : "h-px bg-black";
    return (
        <span className="flex h-9 items-center gap-2 rounded-lg bg-white px-2" aria-hidden="true">
            <span className={`flex-1 ${lineClassName}`} />
            {theme === "NATIONAL_DAY" ? (
                <span className="flex size-7 items-center justify-center rounded-full border-2 border-black text-sm text-black">★</span>
            ) : theme === "TET" ? (
                <span className="flex items-center gap-1.5 px-1">
                    <span className="size-1.5 rotate-45 bg-black" />
                    <span className="flex size-5 rotate-45 items-center justify-center border-2 border-black"><span className="size-2 bg-black" /></span>
                    <span className="size-1.5 rotate-45 bg-black" />
                </span>
            ) : (
                <span className="size-2.5 rounded-full border border-black" />
            )}
            <span className={`flex-1 ${lineClassName}`} />
        </span>
    );
}
