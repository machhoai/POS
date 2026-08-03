import { Coffee, Gift, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { CustomerDisplayAdvertisement } from "@/lib/types/customerDisplay";

interface AdvertisingCarouselProps {
  advertisements: readonly CustomerDisplayAdvertisement[];
  activeIndex: number;
}

const ICONS: Record<CustomerDisplayAdvertisement["icon"], LucideIcon> = {
  COFFEE: Coffee,
  GIFT: Gift,
  SPARKLES: Sparkles,
};

const TONE_CLASSES: Record<CustomerDisplayAdvertisement["tone"], string> = {
  ORANGE: "from-orange-500 via-orange-400 to-amber-300",
  EMERALD: "from-emerald-600 via-emerald-500 to-teal-300",
  SKY: "from-sky-600 via-blue-500 to-cyan-300",
};

const AdvertisingCarousel: React.FC<AdvertisingCarouselProps> = ({
  advertisements,
  activeIndex,
}) => (
  <section
    className="relative min-h-[320px] overflow-hidden rounded-[var(--radius-xl)] bg-slate-900 shadow-[var(--shadow-lg)]"
    aria-label="Quảng cáo và ưu đãi"
    aria-roledescription="băng chuyền"
  >
    {advertisements.map((advertisement, index) => {
      const Icon = ICONS[advertisement.icon];
      const isActive = index === activeIndex;
      return (
        <article
          key={advertisement.id}
          className={`absolute inset-0 flex flex-col justify-between bg-gradient-to-br p-7 text-white transition-all duration-700 sm:p-10 ${TONE_CLASSES[advertisement.tone]} ${isActive ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-8 opacity-0"}`}
          aria-hidden={!isActive}
        >
          <div className="absolute -right-20 -top-24 size-72 rounded-full bg-white/15" />
          <div className="absolute -bottom-28 left-1/3 size-80 rounded-full bg-slate-950/10" />

          <div className="relative flex items-center justify-between gap-4">
            <span className="rounded-full border border-white/30 bg-white/15 px-4 py-2 text-sm font-bold backdrop-blur-sm">
              {advertisement.badge}
            </span>
            <span className="rounded-2xl bg-white/20 p-3 backdrop-blur-sm">
              <Icon className="size-8" aria-hidden="true" />
            </span>
          </div>

          <div className="relative max-w-3xl py-8">
            <h2 className="max-w-2xl text-4xl font-black leading-[1.08] tracking-[-0.04em] sm:text-5xl xl:text-6xl">
              {advertisement.title}
            </h2>
            <p className="mt-5 max-w-2xl text-lg font-medium leading-8 text-white/85 sm:text-xl">
              {advertisement.description}
            </p>
          </div>

          <p className="relative w-fit rounded-xl bg-slate-950/20 px-4 py-3 text-sm font-bold backdrop-blur-sm sm:text-base">
            {advertisement.highlight}
          </p>
        </article>
      );
    })}

    <div className="absolute bottom-5 right-6 z-10 flex gap-2" aria-hidden="true">
      {advertisements.map((advertisement, index) => (
        <span
          key={advertisement.id}
          className={`h-2.5 rounded-full bg-white transition-all duration-500 ${index === activeIndex ? "w-8" : "w-2.5 opacity-50"}`}
        />
      ))}
    </div>
  </section>
);

export default AdvertisingCarousel;
