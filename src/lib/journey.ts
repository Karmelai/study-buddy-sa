import type { AvatarId } from "@/lib/avatars";

export type JourneyReward = {
  id: string;
  name: string;
  type: "sticker";
  image: string;
  unlockLevel: number;
  avatarId: AvatarId;
};

export const JOURNEY_REWARDS: JourneyReward[] = [
  { id: "sticker-free", name: "Free Sticker", type: "sticker", image: "", avatarId: "default", unlockLevel: 1 },
  { id: "sticker-1", name: "Sticker 1", type: "sticker", image: "/avatars/avatar-one.png", avatarId: "avatar-one", unlockLevel: 2 },
  { id: "sticker-2", name: "Sticker 2", type: "sticker", image: "/avatars/avatar-two.png", avatarId: "avatar-two", unlockLevel: 4 },
  { id: "sticker-3", name: "Sticker 3", type: "sticker", image: "/avatars/avatar-three.png", avatarId: "avatar-three", unlockLevel: 6 },
  { id: "sticker-4", name: "Sticker 4", type: "sticker", image: "/avatars/avatar-four.png", avatarId: "avatar-four", unlockLevel: 10 },
  { id: "sticker-5", name: "Sticker 5", type: "sticker", image: "/avatars/avatar-five.png", avatarId: "avatar-five", unlockLevel: 14 },
  { id: "sticker-6", name: "Sticker 6", type: "sticker", image: "/avatars/avatar-six.png", avatarId: "avatar-six", unlockLevel: 18 },
  { id: "sticker-7", name: "Sticker 7", type: "sticker", image: "/avatars/avatar-seven.png", avatarId: "avatar-seven", unlockLevel: 22 },
  { id: "sticker-8", name: "Sticker 8", type: "sticker", image: "/avatars/avatar-eight.png", avatarId: "avatar-eight", unlockLevel: 26 },
  { id: "sticker-9", name: "Sticker 9", type: "sticker", image: "/avatars/avatar-nine.png", avatarId: "avatar-nine", unlockLevel: 30 },
  { id: "sticker-10", name: "Sticker 10", type: "sticker", image: "/avatars/avatar-ten.png", avatarId: "avatar-ten", unlockLevel: 34 },
  { id: "sticker-11", name: "Sticker 11", type: "sticker", image: "/avatars/avatar-eleven.png", avatarId: "avatar-eleven", unlockLevel: 38 },
  { id: "sticker-12", name: "Sticker 12", type: "sticker", image: "/avatars/avatar-twelve.png", avatarId: "avatar-twelve", unlockLevel: 42 },
];

export const getJourneyReward = (id?: string | null) => JOURNEY_REWARDS.find((reward) => reward.id === id);
export const getJourneyRewardForAvatar = (avatarId?: AvatarId | null) => JOURNEY_REWARDS.find((reward) => reward.avatarId === avatarId);
export const xpRequiredForNextLevel = (level: number) => Math.max(1, Math.floor(level)) * 100;
export const getJourneyPosition = (level: number, xp: number) => Math.max(1, level) + Math.min(1, Math.max(0, xp) / xpRequiredForNextLevel(level));
