import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, TimerReset } from "lucide-react";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import { useKarmelStore } from "@/store/useKarmelStore";

export const Route = createFileRoute("/timer")({
  head: () => ({ meta: [{ title: "Study Timer - KARMEL" }] }),
  component: StudyTimerPage,
});

const formatClock = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
};

const getStudyProgress = (timeLeft: number, durationMinutes: number) => {
  const total = Math.max(1, durationMinutes * 60);
  return Math.min(100, Math.max(0, 100 - (timeLeft / total) * 100));
};

function StudyTimerPage() {
  const isTimerRunning = useKarmelStore((s) => s.isTimerRunning);
  const timerMode = useKarmelStore((s) => s.timerMode);
  const studyDurationMinutes = useKarmelStore((s) => s.studyDurationMinutes);
  const breakDurationMinutes = useKarmelStore((s) => s.breakDurationMinutes);
  const studyTimeLeft = useKarmelStore((s) => s.studyTimeLeft);
  const breakTimeLeft = useKarmelStore((s) => s.breakTimeLeft);
  const totalSecondsFocused = useKarmelStore((s) => s.totalSecondsFocused);
  const lastLevelUpAt = useKarmelStore((s) => s.lastLevelUpAt);
  const setTimerMode = useKarmelStore((s) => s.setTimerMode);
  const setStudyDuration = useKarmelStore((s) => s.setStudyDuration);
  const setBreakDuration = useKarmelStore((s) => s.setBreakDuration);
  const startTimer = useKarmelStore((s) => s.startTimer);
  const pauseTimer = useKarmelStore((s) => s.pauseTimer);
  const resetTimer = useKarmelStore((s) => s.resetTimer);

  const [studyInput, setStudyInput] = useState(String(studyDurationMinutes));
  const lastAnnouncedLevelUpAtRef = useRef<number | null>(null);

  useEffect(() => {
    setStudyInput(String(studyDurationMinutes));
  }, [studyDurationMinutes]);

  useEffect(() => {
    if (!lastLevelUpAt) return;
    if (lastAnnouncedLevelUpAtRef.current === lastLevelUpAt) return;
    lastAnnouncedLevelUpAtRef.current = lastLevelUpAt;
    toast.success("Level Up!", {
      description: "You cleared a study block and leveled up.",
      duration: 4000,
    });
  }, [lastLevelUpAt]);

  const applyStudyDuration = () => {
    const parsed = Number.parseInt(studyInput, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setStudyInput(String(studyDurationMinutes));
      return;
    }

    setStudyDuration(parsed);
  };

  return (
    <AppShell>
      <div className="relative flex-1">
        <div className="relative mx-auto flex min-h-full w-full max-w-6xl flex-col gap-6 px-4 py-6 pb-24 sm:px-6 sm:py-8 sm:pb-10">
          <section className="flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-transparent p-2 sm:p-3">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[11px] uppercase tracking-[0.3em] text-white/50">
                  <TimerReset size={13} />
                  Study Timer
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <button
                type="button"
                onClick={() => setTimerMode("study")}
                className={`group relative overflow-hidden rounded-[2rem] border p-5 text-left transition ${
                  timerMode === "study"
                    ? "border-emerald-300/50 bg-emerald-300/10 shadow-[0_0_0_1px_rgba(110,231,183,0.18)]"
                    : "border-white/10 bg-transparent hover:border-emerald-300/30"
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/10 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
                <div className="relative flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-white/40">Study</p>
                    <h2 className="mt-2 text-sm font-medium text-white/70">Current focus block</h2>
                  </div>
                </div>
                <div className="relative mt-8 flex items-end justify-between gap-4">
                  <div className="font-mono text-6xl font-semibold tracking-tight text-white sm:text-7xl">
                    {formatClock(studyTimeLeft)}
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-right text-xs text-white/45">
                    {studyDurationMinutes} min
                  </div>
                </div>
                <div className="relative mt-5 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-300 to-lime-300 transition-all duration-300"
                    style={{ width: `${getStudyProgress(studyTimeLeft, studyDurationMinutes)}%` }}
                  />
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTimerMode("break")}
                className={`group relative overflow-hidden rounded-[2rem] border p-5 text-left transition ${
                  timerMode === "break"
                    ? "border-red-300/50 bg-red-300/10 shadow-[0_0_0_1px_rgba(252,165,165,0.2)]"
                    : "border-white/10 bg-transparent hover:border-red-300/30"
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
                <div className="relative flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-white/40">Break</p>
                    <h2 className="mt-2 text-sm font-medium text-white/70">Recovery block</h2>
                  </div>
                </div>
                <div className="relative mt-8 flex items-end justify-between gap-4">
                  <div className="font-mono text-6xl font-semibold tracking-tight text-white sm:text-7xl">
                    {formatClock(breakTimeLeft)}
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-right text-xs text-white/45">
                    {breakDurationMinutes} min
                  </div>
                </div>
                <div className="relative mt-5 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-red-400 to-rose-500 transition-all duration-300"
                    style={{ width: `${getStudyProgress(breakTimeLeft, breakDurationMinutes)}%` }}
                  />
                </div>
              </button>
            </div>

            <div className="flex flex-col gap-3 rounded-[2rem] border border-white/10 bg-transparent p-4 sm:p-5">
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <label className="block">
                  <span className="mb-2 block text-sm text-white/55">Study minutes</span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={studyInput}
                    onChange={(event) => setStudyInput(event.target.value)}
                    onBlur={applyStudyDuration}
                    className="w-full rounded-2xl border border-emerald-300/15 bg-black/40 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-emerald-300/35"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm text-white/55">Break minutes</span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={breakDurationMinutes}
                    onChange={(event) => setBreakDuration(Number(event.target.value))}
                    className="w-full rounded-2xl border border-red-300/15 bg-black/40 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-red-300/35"
                  />
                </label>
                <button
                  type="button"
                  onClick={startTimer}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-medium text-black transition hover:bg-white/90"
                >
                  <Play size={15} />
                  Start
                </button>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={pauseTimer}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
                >
                  <Pause size={15} />
                  Pause
                </button>
                <button
                  type="button"
                  onClick={resetTimer}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
                >
                  <RotateCcw size={15} />
                  Reset
                </button>
                <div className="mt-1 text-sm text-white/45 sm:ml-auto sm:mt-0">
                  Total focused: <span className="text-white">{Math.floor(totalSecondsFocused / 60)} min</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
