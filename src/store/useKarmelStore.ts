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

export type User = {
  email: string;
  password: string;
  grade: number;
  studentName: string;
  subjects: string[];
};

type State = {
  isAuthed: boolean;
  studentName: string;
  email: string | null;
  grade: number;
  subjects: string[];
  users: User[];
  lastSubject: string | null;
  lastMode: string | null;
  activities: Activity[];
  signup: (email: string, password: string, grade: number, studentName?: string, subjects?: string[]) => { ok: boolean; error?: string };
  login: (email: string, password: string) => { ok: boolean; error?: string };
  logout: () => void;
  setStudent: (name: string, grade: number) => void;
  setSubjects: (subjects: string[]) => void;
  setLast: (subject: string, mode: string) => void;
  addActivity: (a: Activity) => void;
};

const normalizeName = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "Student";
  const [first] = trimmed.split(/\s+/);
  return first.charAt(0).toUpperCase() + first.slice(1);
};

export const useKarmelStore = create<State>()(
  persist(
    (set, get) => ({
      isAuthed: false,
      studentName: "Student",
      email: null,
      grade: 10,
      subjects: [],
      users: [],
      lastSubject: null,
      lastMode: null,
      activities: [],
      signup: (email, password, grade, studentName, subjects) => {
        const e = email.trim().toLowerCase();
        if (get().users.some((u) => u.email === e)) {
          return { ok: false, error: "An account with that email already exists." };
        }
        const name = normalizeName(studentName ?? "");
        const selectedSubjects = (subjects ?? []).filter(Boolean);
        const user: User = { email: e, password, grade, studentName: name, subjects: selectedSubjects };
        set((s) => ({
          users: [...s.users, user],
          isAuthed: true,
          email: e,
          grade,
          studentName: name,
          subjects: selectedSubjects,
        }));
        return { ok: true };
      },
      login: (email, password) => {
        const e = email.trim().toLowerCase();
        const user = get().users.find((u) => u.email === e);
        if (!user || user.password !== password) {
          return { ok: false, error: "Invalid email or password." };
        }
        set({
          isAuthed: true,
          email: user.email,
          grade: user.grade,
          studentName: normalizeName(user.studentName ?? ""),
          subjects: user.subjects ?? [],
        });
        return { ok: true };
      },
      logout: () => set({ isAuthed: false, email: null }),
      setStudent: (studentName, grade) => set({ studentName, grade }),
      setSubjects: (subjects) => {
        const nextSubjects = subjects.filter(Boolean);
        set((s) => ({
          subjects: nextSubjects,
          users: s.email
            ? s.users.map((user) => (user.email === s.email ? { ...user, subjects: nextSubjects } : user))
            : s.users,
        }));
      },
      setLast: (lastSubject, lastMode) => set({ lastSubject, lastMode }),
      addActivity: (a) =>
        set((s) => ({ activities: [a, ...s.activities].slice(0, 20) })),
    }),
    { name: "karmel-store" },
  ),
);

export type SubjectConfig = {
  type: "senior" | "fet";
  subjects: string[];
  coreSubjects: string[];
  electiveGroups: Array<{ title: string; subjects: string[] }>;
};

const SENIOR_PHASE_SUBJECTS = [
  "Mathematics",
  "Natural Sciences (Physics & Biology)",
  "Social Sciences (History & Geography)",
  "Economic and Management Sciences (EMS)",
  "Technology",
  "Life Orientation (LO)",
  "Creative Arts",
  "English HL",
  "Afrikaans HL",
  "isiZulu HL",
  "English FAL",
  "Afrikaans FAL",
  "isiZulu FAL",
];

const FET_CORE_SUBJECTS = [
  "Mathematics",
  "Mathematical Literacy",
  "Life Orientation (LO)",
  "English HL",
  "Afrikaans HL",
  "isiZulu HL",
  "English FAL",
  "Afrikaans FAL",
  "isiZulu FAL",
];

const FET_ELECTIVE_GROUPS = [
  { title: "Sciences", subjects: ["Physical Sciences", "Life Sciences"] },
  { title: "Commerce", subjects: ["Accounting", "Business Studies", "Economics"] },
  { title: "Technology", subjects: ["Information Technology (IT)", "Computer Applications Technology (CAT)"] },
  { title: "Humanities", subjects: ["History", "Geography", "Religion Studies"] },
  {
    title: "Vocational / Practical",
    subjects: [
      "Engineering Graphics and Design (EGD)",
      "Tourism",
      "Consumer Studies",
      "Hospitality Studies",
      "Agricultural Sciences",
    ],
  },
];

export const getSubjectConfigForGrade = (grade: number): SubjectConfig => {
  if (grade >= 8 && grade <= 9) {
    return {
      type: "senior",
      subjects: SENIOR_PHASE_SUBJECTS,
      coreSubjects: [],
      electiveGroups: [],
    };
  }

  if (grade >= 10 && grade <= 12) {
    return {
      type: "fet",
      subjects: [
        ...FET_CORE_SUBJECTS,
        ...FET_ELECTIVE_GROUPS.flatMap((group) => group.subjects),
      ],
      coreSubjects: FET_CORE_SUBJECTS,
      electiveGroups: FET_ELECTIVE_GROUPS,
    };
  }

  return getSubjectConfigForGrade(10);
};

export const SUBJECTS = getSubjectConfigForGrade(10).subjects;
