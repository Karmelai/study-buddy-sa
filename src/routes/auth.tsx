import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { STARTER_AVATAR_OPTIONS, DEFAULT_AVATAR_ID, getAvatarOption, type AvatarId } from "@/lib/avatars";
import { getSubjectConfigForGrade, useKarmelStore } from "@/store/useKarmelStore";

type Search = { mode?: "login" | "signup" };
type EducationLevel = "high_school" | "university";

const INSTITUTIONS = [
  "Belgium Campus iTversity",
  "University of Pretoria",
  "Northwest University",
  "University of Cape Town",
];

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    mode: s.mode === "signup" ? "signup" : "login",
  }),
  head: () => ({ meta: [{ title: "Sign in — KARMEL" }] }),
  component: Auth,
});

function Auth() {
  const { mode } = useSearch({ from: "/auth" });
  const navigate = useNavigate();
  const signup = useKarmelStore((s) => s.signup);
  const login = useKarmelStore((s) => s.login);

  const isSignup = mode === "signup";

  const [email, setEmail] = useState("");
  const [studentName, setStudentName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [grade, setGrade] = useState<number | null>(null);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [role, setRole] = useState<"student" | "teacher">("student");
  const [educationLevel, setEducationLevel] = useState<EducationLevel>("high_school");
  const [institutionName, setInstitutionName] = useState("");
  const [courseOfStudy, setCourseOfStudy] = useState("");
  const [yearOfStudy, setYearOfStudy] = useState("");
  const [customSubject, setCustomSubject] = useState("");
  const [selectedAvatarId, setSelectedAvatarId] = useState<AvatarId>(DEFAULT_AVATAR_ID);
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const subjectConfig = useMemo(() => getSubjectConfigForGrade(grade ?? 10), [grade]);
  const highSchoolSubjects = useMemo(() => Array.from(new Set([
    ...subjectConfig.subjects,
    ...subjectConfig.coreSubjects,
    ...subjectConfig.electiveGroups.flatMap((group) => group.subjects),
  ])), [subjectConfig]);

  const setMode = (m: "login" | "signup") => {
    setError(null);
    navigate({ to: "/auth", search: { mode: m } });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    if (!email.trim() || !password) {
      setError("Please fill in all required fields.");
      setIsSubmitting(false);
      return;
    }
    if (isSignup && !studentName.trim()) {
      setError("Please enter your first name or username.");
      setIsSubmitting(false);
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Please enter a valid email address.");
      setIsSubmitting(false);
      return;
    }
    if (isSignup) {
      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        setIsSubmitting(false);
        return;
      }
      if (password !== confirm) {
        setError("Passwords do not match.");
        setIsSubmitting(false);
        return;
      }
      if (role === "student" && educationLevel === "university") {
        if (!institutionName || !courseOfStudy.trim() || !yearOfStudy) {
          setError("Please complete your university details.");
          setIsSubmitting(false);
          return;
        }
      }
      if (!isUniversityStudent && grade === null) {
        setError("Please select a grade.");
        setIsSubmitting(false);
        return;
      }
      const res = await signup(email, password, grade, studentName, selectedSubjects, role, selectedAvatarId, {
        educationLevel: role === "student" ? educationLevel : undefined,
        institutionName: role === "student" && educationLevel === "university" ? institutionName : undefined,
        courseOfStudy: role === "student" && educationLevel === "university" ? courseOfStudy.trim() : undefined,
        yearOfStudy: role === "student" && educationLevel === "university" ? yearOfStudy : undefined,
      });
      if (!res.ok) {
        setError(res.error ?? "Could not sign up.");
        setIsSubmitting(false);
        return;
      }
    } else {
      const res = await login(email, password);
      if (!res.ok) {
        setError(res.error ?? "Could not log in.");
        setIsSubmitting(false);
        return;
      }
    }
    navigate({ to: "/study" });
  };

  const selectedAvatar = getAvatarOption(selectedAvatarId);
  const isUniversityStudent = role === "student" && educationLevel === "university";

  const addCustomSubject = () => {
    const subject = customSubject.trim();
    if (!subject) return;
    setSelectedSubjects((current) => current.includes(subject) ? current : [...current, subject]);
    setCustomSubject("");
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6 pt-16 pb-10 sm:pt-20">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-2xl font-semibold tracking-wide">KARMEL</h1>
          <p className="text-white/50 text-sm mt-2">Your AI study coach</p>
        </div>

        {isSignup ? (
          <div className="mb-6 flex flex-col items-center">
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsAvatarPickerOpen((prev) => !prev)}
              className="group flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] transition-all duration-200 hover:scale-105 hover:border-white/30 hover:bg-white/10"
              aria-label="Choose avatar"
            >
              {selectedAvatarId === DEFAULT_AVATAR_ID ? (
                <Plus size={22} className="text-white/70" />
              ) : (
                <img src={selectedAvatar.image} alt={selectedAvatar.label} className="h-full w-full object-cover" />
              )}
            </button>

            {isAvatarPickerOpen ? (
              <div className="absolute left-1/2 top-full z-20 mt-3 w-72 -translate-x-1/2 rounded-2xl border border-white/10 bg-zinc-950/95 p-3 shadow-2xl shadow-black/50">
                <p className="mb-3 text-center text-[11px] uppercase tracking-[0.25em] text-white/40">Choose your avatar</p>
                <div className="grid grid-cols-3 gap-2">
                  {STARTER_AVATAR_OPTIONS.map((option) => {
                    const isSelected = selectedAvatarId === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          setSelectedAvatarId(option.id);
                          setIsAvatarPickerOpen(false);
                        }}
                        className={`flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border transition-all duration-200 ${
                          isSelected ? "border-white/80" : "border-white/10 hover:border-white/30"
                        }`}
                        aria-label={option.label}
                      >
                        <img src={option.image} alt={option.label} className="h-full w-full object-cover" />
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
            <p className="mt-3 text-[11px] uppercase tracking-[0.25em] text-white/40">Tap to pick an avatar</p>
          </div>
        ) : null}

        <div className="flex border border-white/10 rounded-lg p-1 mb-8 text-sm">
          <button
            onClick={() => setMode("login")}
            className={`flex-1 py-2 rounded-md transition ${
              !isSignup ? "bg-white text-black" : "text-white/60 hover:text-white"
            }`}
          >
            Login
          </button>
          <button
            onClick={() => setMode("signup")}
            className={`flex-1 py-2 rounded-md transition ${
              isSignup ? "bg-white text-black" : "text-white/60 hover:text-white"
            }`}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <Field label="Email">
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="you@example.com"
            />
          </Field>

          {isSignup && (
            <Field label="First Name or Username">
              <input
                type="text"
                autoComplete="given-name"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className="input"
                placeholder="Thabo"
              />
            </Field>
          )}

          <Field label="Password">
            <input
              type="password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="••••••••"
            />
          </Field>

          {isSignup && (
            <>
              <Field label="Confirm Password">
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="input"
                  placeholder="••••••••"
                />
              </Field>


              <Field label="I am a">
                <div className="flex border border-white/10 rounded-lg p-1 text-sm">
                  <button
                    type="button"
                    onClick={() => setRole("student")}
                    className={`flex-1 py-2 rounded-md transition ${
                      role === "student" ? "bg-white text-black" : "text-white/60 hover:text-white"
                    }`}
                  >
                    Student
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole("teacher")}
                    className={`flex-1 py-2 rounded-md transition ${
                      role === "teacher" ? "bg-white text-black" : "text-white/60 hover:text-white"
                    }`}
                  >
                    Teacher
                  </button>
                </div>
              </Field>

              {role === "student" && (
                <Field label="I am in">
                  <div className="flex border border-white/10 rounded-lg p-1 text-sm">
                    <button
                      type="button"
                      onClick={() => {
                        setEducationLevel("high_school");
                        setSelectedSubjects([]);
                      }}
                      className={`flex-1 py-2 rounded-md transition ${educationLevel === "high_school" ? "bg-white text-black" : "text-white/60 hover:text-white"}`}
                    >
                      High School
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEducationLevel("university");
                        setSelectedSubjects([]);
                      }}
                      className={`flex-1 py-2 rounded-md transition ${educationLevel === "university" ? "bg-white text-black" : "text-white/60 hover:text-white"}`}
                    >
                      University
                    </button>
                  </div>
                </Field>
              )}

              {!isUniversityStudent && (
                <Field label="Grade">
                  <select
                    value={grade ?? ""}
                    onChange={(e) => {
                      setGrade(Number(e.target.value));
                      setSelectedSubjects([]);
                    }}
                    className="input"
                  >
                    <option value="" disabled className="bg-black">Select your grade</option>
                    {[8, 9, 10, 11, 12].map((g) => (
                      <option key={g} value={g} className="bg-black">Grade {g}</option>
                    ))}
                  </select>
                </Field>
              )}

              {isUniversityStudent ? (
                <div className="space-y-4">
                  <Field label="Institution">
                    <select value={institutionName} onChange={(e) => setInstitutionName(e.target.value)} className="input">
                      <option value="" className="bg-black">Select your institution</option>
                      {INSTITUTIONS.map((institution) => <option key={institution} value={institution} className="bg-black">{institution}</option>)}
                    </select>
                  </Field>
                  <Field label="Course of study">
                    <input value={courseOfStudy} onChange={(e) => setCourseOfStudy(e.target.value)} className="input" placeholder="BSc Computer Science" />
                  </Field>
                  <Field label="Year of study">
                    <select value={yearOfStudy} onChange={(e) => setYearOfStudy(e.target.value)} className="input">
                      <option value="" className="bg-black">Select your year</option>
                      {["1", "2", "3", "4+"].map((year) => <option key={year} value={year} className="bg-black">Year {year}</option>)}
                    </select>
                  </Field>
                  <Field label="Your subjects">
                    <p className="mb-3 text-xs text-white/50">Add the modules or subjects you are currently studying.</p>
                    <div className="flex gap-2">
                      <input value={customSubject} onChange={(e) => setCustomSubject(e.target.value)} onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); addCustomSubject(); }
                      }} className="input" placeholder="Database Design" />
                      <button type="button" onClick={addCustomSubject} className="rounded-lg border border-white/15 px-4 text-sm text-white hover:bg-white/10">Add</button>
                    </div>
                    {selectedSubjects.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedSubjects.map((subject) => (
                          <button key={subject} type="button" onClick={() => setSelectedSubjects((current) => current.filter((entry) => entry !== subject))} className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-white hover:bg-white/20" aria-label={`Remove ${subject}`}>
                            {subject} ×
                          </button>
                        ))}
                      </div>
                    )}
                  </Field>
                </div>
              ) : (
              <Field label="Choose your subjects">
                <p className="text-xs text-white/50 mb-3">
                  Choose each subject from the dropdown. Your selections will be saved to the account.
                </p>
                <select
                  value=""
                  onChange={(event) => {
                    const subject = event.target.value;
                    if (subject) setSelectedSubjects((current) => current.includes(subject) ? current : [...current, subject]);
                  }}
                  className="input"
                >
                  <option value="" className="bg-black">Select a subject</option>
                  {highSchoolSubjects.map((subject) => (
                    <option key={subject} value={subject} className="bg-black" disabled={selectedSubjects.includes(subject)}>
                      {subject}{selectedSubjects.includes(subject) ? " (selected)" : ""}
                    </option>
                  ))}
                </select>
                {selectedSubjects.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedSubjects.map((subject) => (
                      <button key={subject} type="button" onClick={() => setSelectedSubjects((current) => current.filter((entry) => entry !== subject))} className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-white hover:bg-white/20" aria-label={`Remove ${subject}`}>
                        {subject} ×
                      </button>
                    ))}
                  </div>
                )}
                <p className="mt-3 text-xs text-white/40">Selected: {selectedSubjects.length || 0}</p>
              </Field>
              )}
            </>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg py-3 font-medium transition disabled:cursor-not-allowed disabled:bg-white/55 disabled:text-black/60 bg-white text-black hover:bg-white/90"
          >
            {isSubmitting ? (isSignup ? "Creating Account..." : "Logging In...") : isSignup ? "Create account" : "Log in"}
          </button>
        </form>

        <p className="text-center text-sm text-white/50 mt-6">
          {isSignup ? "Already have an account?" : "New to KARMEL?"}{" "}
          <button
            onClick={() => setMode(isSignup ? "login" : "signup")}
            className="text-white underline underline-offset-4"
          >
            {isSignup ? "Log in" : "Sign up"}
          </button>
        </p>
      </div>

      <style>{`
        .input {
          width: 100%;
          background: transparent;
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 0.5rem;
          padding: 0.75rem 1rem;
          font-size: 0.875rem;
          color: white;
          outline: none;
        }
        .input:focus { border-color: rgba(255,255,255,0.5); }
        .input::placeholder { color: rgba(255,255,255,0.3); }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-widest text-white/40 mb-2">{label}</span>
      {children}
    </label>
  );
}
