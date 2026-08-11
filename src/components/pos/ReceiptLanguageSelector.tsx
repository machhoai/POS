import type { ReceiptLanguage } from "@/features/receipt/types/receipt";

interface ReceiptLanguageSelectorProps {
  value: ReceiptLanguage;
  disabled?: boolean;
  onChange: (language: ReceiptLanguage) => void;
}

const LANGUAGE_OPTIONS: ReadonlyArray<{
  id: ReceiptLanguage;
  label: string;
}> = [
  { id: "vi", label: "Tiếng Việt" },
  { id: "en", label: "Tiếng Anh" },
  { id: "zh", label: "Tiếng Trung" },
];

const STAR_PATH = "M15 3.2 16.35 7.35 20.72 7.35 17.18 9.92 18.53 14.08 15 11.51 11.47 14.08 12.82 9.92 9.28 7.35 13.65 7.35Z";

const ReceiptLanguageFlag: React.FC<{ language: ReceiptLanguage }> = ({ language }) => (
  <svg
    viewBox="0 0 30 20"
    className="h-[18px] w-[27px] rounded-[2px] shadow-[0_0_0_1px_rgba(15,23,42,0.12)]"
    aria-hidden="true"
  >
    {language === "vi" ? (
      <>
        <rect width="30" height="20" fill="#da251d" />
        <path d={STAR_PATH} fill="#ffcd00" />
      </>
    ) : language === "en" ? (
      <>
        <rect width="30" height="20" fill="#012169" />
        <path d="M0 0 30 20M30 0 0 20" stroke="#fff" strokeWidth="5" />
        <path d="M0 0 30 20M30 0 0 20" stroke="#c8102e" strokeWidth="2.5" />
        <path d="M15 0V20M0 10H30" stroke="#fff" strokeWidth="6" />
        <path d="M15 0V20M0 10H30" stroke="#c8102e" strokeWidth="3.5" />
      </>
    ) : (
      <>
        <rect width="30" height="20" fill="#de2910" />
        <path d={STAR_PATH} fill="#ffde00" transform="translate(-5.5 0) scale(.7)" />
        <circle cx="11" cy="3.5" r="1" fill="#ffde00" />
        <circle cx="13" cy="6" r="1" fill="#ffde00" />
        <circle cx="13" cy="9" r="1" fill="#ffde00" />
        <circle cx="11" cy="11.5" r="1" fill="#ffde00" />
      </>
    )}
  </svg>
);

const ReceiptLanguageSelector: React.FC<ReceiptLanguageSelectorProps> = ({
  value,
  disabled = false,
  onChange,
}) => (
  <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Chọn ngôn ngữ in biên lai">
    <span className="mr-1 text-xs font-semibold text-[var(--color-text-muted)]">
      Chọn ngôn ngữ in biên lai
    </span>
    {LANGUAGE_OPTIONS.map((option) => {
      const isSelected = option.id === value;
      return (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={isSelected}
          aria-label={option.label}
          title={option.label}
          disabled={disabled}
          onClick={() => onChange(option.id)}
          className={`flex size-9 items-center justify-center rounded-lg border leading-none transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
            isSelected
              ? "border-[var(--color-accent)] bg-orange-50 shadow-sm ring-2 ring-orange-100"
              : "border-[var(--color-border)] bg-white hover:border-orange-200 hover:bg-orange-50/60"
          }`}
        >
          <ReceiptLanguageFlag language={option.id} />
        </button>
      );
    })}
  </div>
);

export default ReceiptLanguageSelector;
