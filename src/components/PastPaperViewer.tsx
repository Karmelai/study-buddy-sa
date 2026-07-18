import { useCallback, useMemo, useRef, useState } from "react";
import { BookOpenText, FileText, LoaderCircle, Send } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Keep the worker on precisely the same PDF.js version bundled by react-pdf.
// This avoids Vite resolving a stale, separately cached worker version.
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

type ActiveView = "paper" | "memo";

type Highlight = {
  text: string;
  x: number;
  y: number;
};

type Props = {
  pdfUrl: string;
  memoUrl?: string;
  showMemoToggle: boolean;
  onSendHighlight: (text: string) => void;
  onExit: () => void;
};

export function PastPaperViewer({ pdfUrl, memoUrl, showMemoToggle, onSendHighlight, onExit }: Props) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const scrollPositions = useRef<Record<ActiveView, number>>({ paper: 0, memo: 0 });
  const [activeView, setActiveView] = useState<ActiveView>("paper");
  const [pageCount, setPageCount] = useState(0);
  const [highlight, setHighlight] = useState<Highlight | null>(null);
  const canShowMemo = showMemoToggle && Boolean(memoUrl);
  const activeUrl = activeView === "memo" && canShowMemo ? memoUrl! : pdfUrl;

  const pages = useMemo(
    () => Array.from({ length: pageCount }, (_, index) => index + 1),
    [pageCount],
  );

  const captureSelection = useCallback(() => {
    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    if (!selection || !range || selection.isCollapsed || !viewerRef.current) {
      setHighlight(null);
      return;
    }
    if (!viewerRef.current.contains(range.commonAncestorContainer)) {
      setHighlight(null);
      return;
    }

    const text = selection.toString().replace(/\s+/g, " ").trim();
    if (!text) {
      setHighlight(null);
      return;
    }

    const rect = range.getBoundingClientRect();
    setHighlight({ text, x: rect.left + rect.width / 2, y: rect.top - 8 });
  }, []);

  const sendHighlight = () => {
    if (!highlight) return;
    onSendHighlight(highlight.text);
    window.getSelection()?.removeAllRanges();
    setHighlight(null);
  };

  const switchView = (view: ActiveView) => {
    scrollPositions.current[activeView] = viewerRef.current?.scrollTop ?? 0;
    setPageCount(0);
    setActiveView(view);
    setHighlight(null);
    window.getSelection()?.removeAllRanges();
  };

  return (
    <section className="relative min-h-0 overflow-hidden bg-muted/20">
      <div className="absolute right-4 top-4 z-20 flex flex-col items-center gap-2">
        {canShowMemo && (
        <div className="rounded-xl border border-border bg-background/95 p-1 shadow-lg backdrop-blur">
          <div className="relative grid grid-cols-2 text-xs font-medium">
            <span className={`absolute inset-y-0 w-1/2 rounded-lg bg-primary transition-transform duration-300 ${activeView === "memo" ? "translate-x-full" : "translate-x-0"}`} />
            <button type="button" onClick={() => switchView("paper")} className={`relative z-10 flex items-center justify-center gap-1 rounded-lg px-3 py-2 transition-colors ${activeView === "paper" ? "text-primary-foreground" : "text-muted-foreground"}`}>
              <FileText size={14} />Question Paper
            </button>
            <button type="button" onClick={() => switchView("memo")} className={`relative z-10 flex items-center justify-center gap-1 rounded-lg px-3 py-2 transition-colors ${activeView === "memo" ? "text-primary-foreground" : "text-muted-foreground"}`}>
              <BookOpenText size={14} />Memorandum
            </button>
          </div>
        </div>
        )}
        <button type="button" onClick={onExit} className="rounded-full border border-border bg-background/80 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur transition hover:text-foreground">Exit Session</button>
      </div>

      <div ref={viewerRef} onMouseUp={captureSelection} onKeyUp={captureSelection} className="h-full overflow-auto px-4 pb-8 pt-16 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Document
          key={activeUrl}
          file={activeUrl}
          loading={<div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center text-muted-foreground"><span className="grid h-11 w-11 place-items-center rounded-2xl border border-border bg-background shadow-sm"><LoaderCircle className="animate-spin text-primary" size={21} /></span><div><p className="text-sm font-medium text-foreground">Loading {activeView === "memo" ? "Memorandum" : "Question Paper"}</p><p className="mt-1 text-xs">Please wait a moment…</p></div></div>}
          error={<p className="p-6 text-sm text-destructive">We could not load this PDF.</p>}
          onLoadSuccess={({ numPages }) => {
            setPageCount(numPages);
            requestAnimationFrame(() => requestAnimationFrame(() => {
              if (viewerRef.current) viewerRef.current.scrollTop = scrollPositions.current[activeView];
            }));
          }}
        >
          <div className="mx-auto w-fit space-y-4">
            {pages.map((pageNumber) => <Page key={pageNumber} pageNumber={pageNumber} width={760} renderTextLayer renderAnnotationLayer className="overflow-hidden rounded-lg shadow-lg" />)}
          </div>
        </Document>
      </div>

      {highlight && (
        <button type="button" onClick={sendHighlight} style={{ left: highlight.x, top: highlight.y, transform: "translate(-50%, -100%)" }} className="fixed z-50 flex items-center gap-1.5 rounded-full bg-primary px-3 py-2 text-xs font-medium text-primary-foreground shadow-xl transition hover:scale-105">
          <Send size={13} />Send to KARMEL
        </button>
      )}
    </section>
  );
}
