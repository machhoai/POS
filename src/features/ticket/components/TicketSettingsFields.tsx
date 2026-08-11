"use client";

export const ticketFieldClassName =
  "min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-text-primary)] shadow-sm transition-colors placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none";

export function SettingsSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-[var(--color-border)] bg-white p-4 shadow-sm"><div className="mb-4"><h2 className="text-sm font-extrabold text-[var(--color-text-primary)]">{title}</h2><p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{description}</p></div>{children}</section>;
}

export function TextField({ label, value, onChange, maxLength }: { label: string; value: string; onChange: (value: string) => void; maxLength: number }) {
  return <label className="grid gap-1.5 text-xs font-bold text-[var(--color-text-secondary)]">{label}<input type="text" value={value} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} className={ticketFieldClassName} /></label>;
}

export function TextAreaField({ label, value, onChange, maxLength }: { label: string; value: string; onChange: (value: string) => void; maxLength: number }) {
  return <label className="grid gap-1.5 text-xs font-bold text-[var(--color-text-secondary)]">{label}<textarea value={value} maxLength={maxLength} rows={3} onChange={(event) => onChange(event.target.value)} className={`${ticketFieldClassName} py-2`} /></label>;
}

export function ToggleField({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="relative flex min-h-[62px] cursor-pointer items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 py-2.5"><span><span className="block text-xs font-bold text-[var(--color-text-primary)]">{label}</span><span className="mt-0.5 block text-[11px] text-[var(--color-text-muted)]">{description}</span></span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="peer sr-only" /><span className="relative h-6 w-11 shrink-0 rounded-full bg-gray-300 transition-colors peer-checked:bg-[var(--color-accent)] after:absolute after:left-1 after:top-1 after:size-4 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:after:translate-x-5" /></label>;
}

export function SliderField({ label, value, min, max, step, unit, onChange }: { label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (value: number) => void }) {
  return <label className="grid gap-2 text-xs font-bold text-[var(--color-text-secondary)]"><span className="flex items-center justify-between gap-2"><span>{label}</span><output className="rounded-md bg-orange-50 px-2 py-1 font-mono text-[11px] text-[var(--color-accent)]">{value}{unit}</output></span><input type="range" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} className="h-2 w-full cursor-pointer accent-[var(--color-accent)]" /></label>;
}
