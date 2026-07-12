import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

type SettingsAccordionProps = {
  title: string;
  description: string;
  trailing?: ReactNode;
  children: ReactNode;
};

export default function SettingsAccordion({ title, description, trailing, children }: SettingsAccordionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const contentId = useId();

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="flex w-full items-center gap-4 px-4 py-4 text-left transition hover:bg-accent sm:px-5"
        aria-expanded={isOpen}
        aria-controls={contentId}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-card-foreground sm:text-base">{title}</span>
          <span className="mt-1 block text-sm text-muted-foreground">{description}</span>
        </span>
        {trailing ? <span className="shrink-0">{trailing}</span> : null}
        <ChevronDown
          size={18}
          className={`shrink-0 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>
      <div id={contentId} hidden={!isOpen} className="border-t border-border px-4 py-4 sm:px-5">
        {children}
      </div>
    </section>
  );
}
