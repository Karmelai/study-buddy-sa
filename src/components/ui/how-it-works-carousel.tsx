import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, type LucideIcon } from "lucide-react";

export type HowItWorksGuide = {
  icon: LucideIcon;
  title: string;
  label: string;
  description: string;
};

type Props = { guides: HowItWorksGuide[] };

export function HowItWorksCarousel({ guides }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const total = guides.length;
  const activeGuide = guides[activeIndex];

  const previous = useCallback(() => setActiveIndex((index) => (index - 1 + total) % total), [total]);
  const next = useCallback(() => setActiveIndex((index) => (index + 1) % total), [total]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") previous();
      if (event.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [next, previous]);

  if (!activeGuide || total === 0) return null;

  return (
    <section className="mx-auto mt-4 max-w-3xl">
      <div className="flex flex-col items-center">
        <div className="flex h-72 w-full items-center justify-center sm:h-80">
          <div className="relative h-72 w-full max-w-md -translate-y-5 [perspective:1200px] sm:h-80">
            {guides.map((guide, index) => {
              const Icon = guide.icon;
              const isActive = index === activeIndex;
              const isLeft = index === (activeIndex - 1 + total) % total;
              const isRight = index === (activeIndex + 1) % total;
              const positionClass = isActive
                ? "z-30 -translate-x-1/2 -translate-y-1/2 scale-100 rotate-y-0 opacity-100"
                : isLeft
                  ? "z-20 translate-x-[calc(-50%_-_40%)] translate-y-[calc(-50%_-_1.75rem)] scale-[0.72] rotate-y-[20deg] opacity-45 sm:translate-x-[calc(-50%_-_46%)]"
                  : isRight
                    ? "z-20 translate-x-[calc(-50%_+_40%)] translate-y-[calc(-50%_-_1.75rem)] scale-[0.72] -rotate-y-[20deg] opacity-45 sm:translate-x-[calc(-50%_+_46%)]"
                    : "pointer-events-none z-10 scale-75 opacity-0";
              return <button key={guide.title} type="button" onClick={() => setActiveIndex(index)} aria-label={`Show ${guide.title}`} className={`absolute left-1/2 top-1/2 grid h-56 w-56 -translate-x-1/2 -translate-y-1/2 place-items-center text-primary transition-all duration-700 ease-[cubic-bezier(.4,2,.3,1)] sm:h-64 sm:w-64 ${positionClass}`}>
                <Icon size={isActive ? 182 : 132} strokeWidth={1.05} className="transition-all duration-500" />
              </button>;
            })}
          </div>
        </div>

        <div className="mt-8 text-center">
          <div key={activeGuide.title} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{activeGuide.title}</h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">{activeGuide.description}</p>
          </div>
          <div className="mt-7 flex items-center justify-center gap-3">
            <button type="button" onClick={previous} className="grid h-11 w-11 place-items-center rounded-full bg-foreground text-background transition hover:scale-105 hover:opacity-90" aria-label="Previous guide"><ArrowLeft size={18} /></button>
            <button type="button" onClick={next} className="grid h-11 w-11 place-items-center rounded-full border border-border bg-background text-foreground transition hover:scale-105 hover:bg-accent" aria-label="Next guide"><ArrowRight size={18} /></button>
            <p className="ml-2 text-xs tabular-nums text-muted-foreground">{String(activeIndex + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
