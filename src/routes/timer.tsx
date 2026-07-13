import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import { useKarmelStore } from "@/store/useKarmelStore";

export const Route = createFileRoute("/timer")({
  head: () => ({ meta: [{ title: "Study Timer - KARMEL" }] }),
  component: StudyTimerPage,
});

type TimerPhase = "focus" | "break" | "break-pending";

const formatClock = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
};

const getProgress = (timeLeft: number, durationMinutes: number) => {
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

  const [phase, setPhase] = useState<TimerPhase>(timerMode === "break" ? "break-pending" : "focus");
  const [isEditingDuration, setIsEditingDuration] = useState(false);
  const [durationInput, setDurationInput] = useState("");
  const previousRunningRef = useRef(isTimerRunning);
  const previousTimerModeRef = useRef(timerMode);
  const previousPhaseRef = useRef<TimerPhase>(phase);
  const lastAnnouncedLevelUpAtRef = useRef<number | null>(null);

  const isRecoveryPhase = phase === "break" || phase === "break-pending";
  const activeTimeLeft = isRecoveryPhase ? breakTimeLeft : studyTimeLeft;
  const activeDurationMinutes = isRecoveryPhase ? breakDurationMinutes : studyDurationMinutes;
  const progress =
    phase === "break-pending" ? 0 : getProgress(activeTimeLeft, activeDurationMinutes);
  const circleRadius = 146;
  const circleCircumference = 2 * Math.PI * circleRadius;
  const circleOffset = circleCircumference - (progress / 100) * circleCircumference;
  const accentClass = isRecoveryPhase ? "text-rose-200" : "text-emerald-200";
  const accentStroke = isRecoveryPhase ? "#fda4af" : "#6ee7b7";
  const phaseLabel =
    phase === "break-pending"
      ? "RECOVERY READY"
      : phase === "break"
        ? "RECOVERY BLOCK"
        : "FOCUS BLOCK";

  useEffect(() => {
    if (isEditingDuration) return;
    setDurationInput(String(activeDurationMinutes));
  }, [activeDurationMinutes, isEditingDuration]);

  useEffect(() => {
    const focusJustFinished =
      previousTimerModeRef.current === "study" &&
      previousRunningRef.current &&
      !isTimerRunning &&
      timerMode === "break";
    const breakJustFinished =
      previousPhaseRef.current === "break" &&
      previousRunningRef.current &&
      !isTimerRunning &&
      timerMode === "break" &&
      breakTimeLeft <= 0;

    if (focusJustFinished) {
      setPhase("break-pending");
      previousPhaseRef.current = "break-pending";
    } else if (breakJustFinished) {
      setTimerMode("study");
      setStudyDuration(studyDurationMinutes);
      setPhase("focus");
      previousPhaseRef.current = "focus";
    } else if (timerMode === "study" && phase !== "focus") {
      setPhase("focus");
      previousPhaseRef.current = "focus";
    } else if (timerMode === "break" && isTimerRunning && phase !== "break") {
      setPhase("break");
      previousPhaseRef.current = "break";
    } else {
      previousPhaseRef.current = phase;
    }

    previousRunningRef.current = isTimerRunning;
    previousTimerModeRef.current = timerMode;
  }, [
    breakTimeLeft,
    isTimerRunning,
    phase,
    setStudyDuration,
    setTimerMode,
    studyDurationMinutes,
    timerMode,
  ]);

  useEffect(() => {
    if (!lastLevelUpAt) return;
    if (lastAnnouncedLevelUpAtRef.current === lastLevelUpAt) return;
    lastAnnouncedLevelUpAtRef.current = lastLevelUpAt;
    toast.success("Level Up!", {
      description: "You cleared a study block and leveled up.",
      duration: 4000,
    });
  }, [lastLevelUpAt]);

  const beginDurationEdit = () => {
    if (isTimerRunning) return;
    setDurationInput(String(activeDurationMinutes));
    setIsEditingDuration(true);
  };

  const applyDurationEdit = () => {
    const parsed = Number.parseInt(durationInput, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setDurationInput(String(activeDurationMinutes));
      setIsEditingDuration(false);
      return;
    }

    if (isRecoveryPhase) {
      setTimerMode("break");
      setBreakDuration(parsed);
    } else {
      setTimerMode("study");
      setStudyDuration(parsed);
    }

    setIsEditingDuration(false);
  };

  const startCurrentPhase = () => {
    if (phase === "break-pending") return;
    setTimerMode(isRecoveryPhase ? "break" : "study");
    startTimer();
  };

  const startBreak = () => {
    setTimerMode("break");
    setPhase("break");
    startTimer();
  };

  const skipBreak = () => {
    pauseTimer();
    setTimerMode("study");
    setStudyDuration(studyDurationMinutes);
    setPhase("focus");
  };

  const resetCurrentPhase = () => {
    pauseTimer();

    if (isRecoveryPhase) {
      setTimerMode("break");
      setBreakDuration(breakDurationMinutes);
      setPhase(phase === "break-pending" ? "break-pending" : "break");
      return;
    }

    setTimerMode("study");
    setStudyDuration(studyDurationMinutes);
    setPhase("focus");
  };

  return (
    <AppShell>
      <div className="relative flex-1">
        <div className="relative mx-auto flex min-h-full w-full max-w-5xl flex-col px-4 py-6 pb-24 sm:px-6 sm:py-8 sm:pb-10">
          <section className="flex min-h-[calc(100vh-9rem)] flex-col items-center justify-center gap-8 px-4 py-8 sm:px-8">
            <div className="flex flex-col items-center gap-5 text-center">
              <p className={`text-xs font-medium uppercase tracking-[0.35em] ${accentClass}`}>
                &mdash; {phaseLabel} &mdash;
              </p>

              <div className="relative grid h-[min(78vw,24rem)] w-[min(78vw,24rem)] place-items-center">
                <svg
                  className="absolute inset-0 h-full w-full -rotate-90"
                  viewBox="0 0 340 340"
                  aria-hidden="true"
                >
                  <circle
                    cx="170"
                    cy="170"
                    r={circleRadius}
                    fill="none"
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth="10"
                  />
                  <circle
                    cx="170"
                    cy="170"
                    r={circleRadius}
                    fill="none"
                    stroke={accentStroke}
                    strokeLinecap="round"
                    strokeWidth="10"
                    strokeDasharray={circleCircumference}
                    strokeDashoffset={circleOffset}
                    className="transition-[stroke-dashoffset] duration-500 ease-out"
                  />
                </svg>

                <div className="relative flex flex-col items-center">
                  {isEditingDuration ? (
                    <label className="flex flex-col items-center gap-2">
                      <input
                        autoFocus
                        type="number"
                        min={1}
                        step={1}
                        value={durationInput}
                        onBlur={applyDurationEdit}
                        onChange={(event) => setDurationInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") applyDurationEdit();
                          if (event.key === "Escape") setIsEditingDuration(false);
                        }}
                        className="w-40 border-0 border-b border-white/20 bg-transparent px-2 py-1 text-center font-mono text-5xl font-semibold text-white outline-none transition focus:border-white/60 sm:w-48 sm:text-6xl"
                      />
                      <span className="text-xs uppercase tracking-[0.25em] text-white/40">
                        minutes
                      </span>
                    </label>
                  ) : (
                    <button
                      type="button"
                      onClick={beginDurationEdit}
                      disabled={isTimerRunning}
                      className="font-mono text-5xl font-semibold tracking-normal text-white transition enabled:hover:text-white/80 disabled:cursor-default sm:text-7xl"
                      aria-label={`Edit ${isRecoveryPhase ? "break" : "focus"} duration`}
                    >
                      {formatClock(activeTimeLeft)}
                    </button>
                  )}
                  <p className="mt-3 text-sm text-white/45">{activeDurationMinutes} min</p>
                </div>
              </div>

              {phase === "break-pending" ? (
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={startBreak}
                    className="rounded-lg bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-white/90"
                  >
                    Start Break
                  </button>
                  <button
                    type="button"
                    onClick={skipBreak}
                    className="rounded-lg border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10"
                  >
                    Skip Break
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={isTimerRunning ? pauseTimer : startCurrentPhase}
                    className="grid h-12 w-12 place-items-center rounded-full bg-white text-black transition hover:bg-white/90"
                    aria-label={isTimerRunning ? "Pause timer" : "Start timer"}
                    title={isTimerRunning ? "Pause" : "Start"}
                  >
                    {isTimerRunning ? <Pause size={18} /> : <Play size={18} />}
                  </button>
                  <button
                    type="button"
                    onClick={resetCurrentPhase}
                    className="grid h-12 w-12 place-items-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white/10"
                    aria-label="Reset timer"
                    title="Reset"
                  >
                    <RotateCcw size={18} />
                  </button>
                </div>
              )}
            </div>

            <div className="text-sm text-white/45">
              Total focused:{" "}
              <span className="text-white">{Math.floor(totalSecondsFocused / 60)} min</span>
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
