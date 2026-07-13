import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, CheckCircle2, LockKeyhole, Unlock } from "lucide-react";
import AppShell from "@/components/AppShell";
import { getJourneyPosition, JOURNEY_REWARDS, type JourneyReward, xpRequiredForNextLevel } from "@/lib/journey";
import { useKarmelStore } from "@/store/useKarmelStore";

export const Route = createFileRoute("/journey")({
  head: () => ({ meta: [{ title: "Journey - KARMEL" }] }),
  component: JourneyPage,
});

const RewardArtwork = ({ reward, muted = false }: { reward: JourneyReward; muted?: boolean }) =>
  reward.image ? <img src={reward.image} alt="" className={`h-full w-full object-cover ${muted ? "grayscale opacity-80" : ""}`} /> : <span className="text-[10px] font-semibold tracking-[0.2em] text-muted-foreground">ME</span>;

function JourneyPage() {
  const level = useKarmelStore((s) => s.level);
  const xp = useKarmelStore((s) => s.xp);
  const avatarId = useKarmelStore((s) => s.avatarId);
  const unlocked = useKarmelStore((s) => s.unlockedJourneyRewards);
  const claimReward = useKarmelStore((s) => s.claimJourneyReward);
  const equipReward = useKarmelStore((s) => s.equipJourneyReward);
  const [selected, setSelected] = useState<JourneyReward | null>(null);
  const [revealed, setRevealed] = useState<JourneyReward | null>(null);
  const [celebrated, setCelebrated] = useState<{ reward: JourneyReward; newlyUnlocked: boolean } | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  const roadRewards = JOURNEY_REWARDS.filter((reward) => reward.id !== "sticker-free");

  const position = getJourneyPosition(level, xp);
  const nextReward = roadRewards.find((reward) => reward.unlockLevel > level) ?? null;
  const previousRewardIndex = roadRewards.reduce((lastIndex, reward, index) => reward.unlockLevel <= position ? index : lastIndex, -1);
  const previousMilestone = previousRewardIndex >= 0 ? roadRewards[previousRewardIndex].unlockLevel : 1;
  const nextMilestone = roadRewards[previousRewardIndex + 1]?.unlockLevel ?? Math.max(level + 1, previousMilestone + 1);
  const betweenMilestones = Math.min(1, Math.max(0, (position - previousMilestone) / (nextMilestone - previousMilestone)));
  const roadProgress = previousRewardIndex < 0 ? 0 : Math.min(100, ((previousRewardIndex + betweenMilestones) / (roadRewards.length - 1)) * 100);
  const isEquipped = (reward: JourneyReward) =>
    reward.avatarId === avatarId;

  useEffect(() => {
    if (!celebrated) return;
    const timeout = window.setTimeout(() => setCelebrated(null), 1600);
    return () => window.clearTimeout(timeout);
  }, [celebrated]);

  const handleClaim = async () => {
    if (!selected) return;
    setIsWorking(true);
    const result = await claimReward(selected.id);
    setIsWorking(false);
    if (result.ok) {
      setRevealed(selected);
      setSelected(null);
    }
  };
  const handleEquip = async (reward: JourneyReward) => {
    const newlyUnlocked = revealed?.id === reward.id;
    setIsWorking(true);
    const result = await equipReward(reward.id);
    setIsWorking(false);
    if (result.ok) {
      setSelected(null);
      setRevealed(null);
      setCelebrated({ reward, newlyUnlocked });
    }
  };

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <section className="rounded-3xl border border-border bg-card p-6 sm:p-8">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Your study road</p>
          <div className="mt-3 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div><h1 className="text-3xl font-semibold">Journey</h1><p className="mt-2 max-w-xl text-sm text-muted-foreground">Study, level up, and unlock new stickers.</p></div>
            <div className="rounded-2xl border border-border bg-background/40 px-4 py-3 sm:text-right"><p className="text-sm font-medium">Level {level}</p><p className="mt-1 text-xs text-muted-foreground">{xp} / {xpRequiredForNextLevel(level)} XP to Level {level + 1}</p></div>
          </div>
          <div className="mt-6 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${(xp / xpRequiredForNextLevel(level)) * 100}%` }} /></div>
          {nextReward ? <p className="mt-3 text-sm text-muted-foreground">Next reward: <span className="font-medium text-foreground">{nextReward.name}</span> at Level {nextReward.unlockLevel}</p> : <p className="mt-3 text-sm text-muted-foreground">Every Journey reward is within reach.</p>}
        </section>

        <section className="mt-6 rounded-3xl border border-border bg-card p-5 sm:p-8">
          <div className="relative py-5 sm:h-[32rem] sm:py-0">
            <div className="absolute bottom-5 left-8 top-5 w-1 rounded-full bg-muted sm:hidden" />
            <div className="absolute left-7 top-5 w-1 rounded-full bg-primary transition-[height] duration-500 motion-reduce:transition-none sm:hidden" style={{ height: `${roadProgress}%` }} />
            <svg className="absolute inset-0 hidden h-full w-full sm:block" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">
              <path d="M100 100H900V300H100V500H300" fill="none" stroke="currentColor" className="text-muted" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M100 100H900V300H100V500H300" fill="none" stroke="currentColor" className="text-primary transition-[stroke-dashoffset] duration-500 motion-reduce:transition-none" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" pathLength="100" strokeDasharray="100" strokeDashoffset={100 - roadProgress} />
            </svg>
            <div className="relative flex flex-col gap-7 sm:grid sm:h-full sm:grid-cols-5 sm:grid-rows-3">
              {roadRewards.map((reward, index) => {
                const isUnlocked = reward.id === "sticker-free" || unlocked.includes(reward.id);
                const available = level >= reward.unlockLevel && !isUnlocked;
                const locked = !isUnlocked && !available;
                const gridColumn = index < 5 ? index + 1 : index < 10 ? 10 - index : index - 9;
                const gridRow = index < 5 ? 1 : index < 10 ? 2 : 3;
                return <button key={reward.id} type="button" onClick={() => setSelected(reward)} style={{ gridColumn, gridRow }} className="group relative flex min-w-0 items-center gap-4 text-left sm:justify-self-center sm:self-center sm:flex-col sm:gap-2 sm:text-center">
                  <span className={`relative z-10 grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border-2 bg-card shadow-lg transition group-hover:scale-105 sm:h-[4.5rem] sm:w-[4.5rem] ${isEquipped(reward) ? "border-primary ring-4 ring-primary/20" : isUnlocked ? "border-primary/70" : available ? "border-amber-300" : "border-border"}`}><RewardArtwork reward={reward} muted={locked} /></span>
                  <span className="min-w-0 sm:w-full"><span className="block text-sm font-medium">Level {reward.unlockLevel}</span><span className={`mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full border ${locked ? "border-border text-muted-foreground" : available ? "border-amber-300/40 text-amber-300" : "border-primary/40 text-primary"}`} aria-label={locked ? "Locked" : available ? "Ready to unlock" : isEquipped(reward) ? "Equipped" : "Unlocked"}>{locked ? <LockKeyhole size={11} /> : available ? <Unlock size={11} /> : isEquipped(reward) ? <Check size={11} /> : <CheckCircle2 size={11} />}</span></span>
                </button>;
              })}
            </div>
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">Progress from Level {previousMilestone} toward Level {nextMilestone}: {Math.round(betweenMilestones * 100)}%</p>
        </section>

        <section className="mt-6"><h2 className="text-lg font-semibold">Stickers unlocked</h2><div className="mt-3 flex flex-wrap gap-3">{JOURNEY_REWARDS.filter((reward) => reward.id === "sticker-free" || unlocked.includes(reward.id)).map((reward) => <button key={reward.id} type="button" onClick={() => setSelected(reward)} className="grid h-16 w-16 place-items-center overflow-hidden rounded-full border border-border bg-card transition hover:scale-105 sm:h-[4.5rem] sm:w-[4.5rem]"><RewardArtwork reward={reward} /></button>)}</div></section>
      </div>

      {selected && <RewardModal reward={selected} level={level} unlocked={selected.id === "sticker-free" || unlocked.includes(selected.id)} equipped={isEquipped(selected)} isWorking={isWorking} onClose={() => setSelected(null)} onClaim={handleClaim} onEquip={() => handleEquip(selected)} />}
      {revealed && <RevealModal reward={revealed} isWorking={isWorking} onClose={() => setRevealed(null)} onEquip={() => handleEquip(revealed)} />}
      {celebrated && <StickerCelebration reward={celebrated.reward} newlyUnlocked={celebrated.newlyUnlocked} />}
    </AppShell>
  );
}

function RewardModal({ reward, level, unlocked, equipped, isWorking, onClose, onClaim, onEquip }: { reward: JourneyReward; level: number; unlocked: boolean; equipped: boolean; isWorking: boolean; onClose: () => void; onClaim: () => void; onEquip: () => void }) {
  const available = level >= reward.unlockLevel;
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose} role="presentation"><div className="flex flex-col items-center" onClick={(event) => event.stopPropagation()}><div className="h-64 w-64"><RewardArtwork reward={reward} /></div>{unlocked ? <button disabled={equipped || isWorking} onClick={onEquip} className="mt-5 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50">{equipped ? "Equipped" : "Equip"}</button> : available ? <button disabled={isWorking} onClick={onClaim} className="mt-5 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50">Unlock</button> : null}</div></div>;
}

function RevealModal({ reward, isWorking, onClose, onEquip }: { reward: JourneyReward; isWorking: boolean; onClose: () => void; onEquip: () => void }) {
  return <div className="fixed inset-0 z-[60] grid place-items-center bg-black/75 p-4 text-center backdrop-blur-sm"><div className="animate-in zoom-in-95 fade-in duration-300 motion-reduce:animate-none"><p className="text-sm font-medium text-white">New sticker unlocked</p><div className="mx-auto mt-4 h-64 w-64"><RewardArtwork reward={reward} /></div><div className="mt-6 grid gap-3 sm:grid-cols-2"><button disabled={isWorking} onClick={onEquip} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground">Equip</button><button onClick={onClose} className="rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-medium text-white">Continue</button></div></div></div>;
}

function StickerCelebration({ reward, newlyUnlocked }: { reward: JourneyReward; newlyUnlocked: boolean }) {
  return <div className="fixed inset-0 z-[70] grid place-items-center bg-black/75 p-4 text-center backdrop-blur-sm" role="status" aria-live="polite"><div className="animate-in zoom-in-95 fade-in duration-300 motion-reduce:animate-none"><p className="text-lg font-semibold text-white">{newlyUnlocked ? "New sticker unlocked" : "Sticker equipped"}</p><p className="mt-1 text-sm text-white/65">{reward.name}</p><div className="mx-auto mt-5 h-48 w-48 animate-[pulse_1s_ease-in-out_1] motion-reduce:animate-none"><RewardArtwork reward={reward} /></div><p className="mt-5 text-xs text-white/45">Returning to your Journey…</p></div></div>;
}
