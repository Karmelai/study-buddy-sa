import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Activity = {
  id: string;
  type: "study" | "pastpaper";
  subject: string;
  topic?: string;
  score?: number;
  weakTopics?: string[];
  at: number;
};

type State = {
  studentName: string;
  grade: number;
  lastSubject: string | null;
  lastMode: string | null;
  activities: Activity[];
  setStudent: (name: string, grade: number) => void;
  setLast: (subject: string, mode: string) => void;
  addActivity: (a: Activity) => void;
};

export const useKarmelStore = create<State>()(
  persist(
    (set) => ({
      studentName: "Student",
      grade: 10,
      lastSubject: null,
      lastMode: null,
      activities: [],
      setStudent: (studentName, grade) => set({ studentName, grade }),
      setLast: (lastSubject, lastMode) => set({ lastSubject, lastMode }),
      addActivity: (a) =>
        set((s) => ({ activities: [a, ...s.activities].slice(0, 20) })),
    }),
    { name: "karmel-store" },
  ),
);

export const SUBJECTS = [
  "Mathematics",
  "Physical Sciences",
  "Life Sciences",
  "English",
  "Afrikaans",
  "Accounting",
  "Business Studies",
  "Geography",
  "History",
  "Economics",
];
