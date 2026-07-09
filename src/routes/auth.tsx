import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { AVATAR_OPTIONS, DEFAULT_AVATAR_ID, getAvatarOption, type AvatarId } from "@/lib/avatars";
import { getSubjectConfigForGrade, useKarmelStore } from "@/store/useKarmelStore";

type Search = { mode?: "login" | "signup" };

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
  const [grade, setGrade] = useState(10);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [role, setRole] = useState<"student" | "teacher">("student");
  const [selectedAvatarId, setSelectedAvatarId] = useState<AvatarId>(DEFAULT_AVATAR_ID);
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const subjectConfig = useMemo(() => getSubjectConfigForGrade(grade), [grade]);

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
      const res = await signup(email, password, grade, studentName, selectedSubjects, role, selectedAvatarId);
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
                  {AVATAR_OPTIONS.map((option) => {
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


              <Field label="Grade">
                <select
                  value={grade}
                  onChange={(e) => {
                    setGrade(Number(e.target.value));
                    setSelectedSubjects([]);
                  }}
                  className="input"
                >
                  {[8, 9, 10, 11, 12].map((g) => (
                    <option key={g} value={g} className="bg-black">
                      Grade {g}
                    </option>
                  ))}
                </select>
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



              <Field label="Choose your subjects">
                <p className="text-xs text-white/50 mb-3">
                  Pick the subjects that apply to your learner. These will be saved to the account and reused in Study and Past Papers.
                </p>
                <div className="space-y-3">
                  {subjectConfig.type === "fet" && (
                    <div className="rounded-lg border border-white/10 p-3">
                      <p className="text-xs uppercase tracking-widest text-white/40">Core and elective options</p>
                      <div className="mt-2 grid grid-cols-1 gap-2">
                        {subjectConfig.coreSubjects.map((subject) => {
                          const selected = selectedSubjects.includes(subject);
                          return (
                            <button
                              key={subject}
                              type="button"
                              onClick={() => {
                                setSelectedSubjects((prev) =>
                                  prev.includes(subject)
                                    ? prev.filter((entry) => entry !== subject)
                                    : [...prev, subject],
                                );
                              }}
                              className={`rounded-md border px-3 py-2 text-left text-sm ${
                                selected ? "border-white bg-white text-black" : "border-white/10"
                              }`}
                            >
                              {subject}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {subjectConfig.type === "fet" && subjectConfig.electiveGroups.map((group) => (
                    <div key={group.title} className="rounded-lg border border-white/10 p-3">
                      <p className="text-xs uppercase tracking-widest text-white/40">{group.title}</p>
                      <div className="mt-2 grid grid-cols-1 gap-2">
                        {group.subjects.map((subject) => {
                          const selected = selectedSubjects.includes(subject);
                          return (
                            <button
                              key={subject}
                              type="button"
                              onClick={() => {
                                setSelectedSubjects((prev) =>
                                  prev.includes(subject)
                                    ? prev.filter((entry) => entry !== subject)
                                    : [...prev, subject],
                                );
                              }}
                              className={`rounded-md border px-3 py-2 text-left text-sm ${
                                selected ? "border-white bg-white text-black" : "border-white/10"
                              }`}
                            >
                              {subject}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {subjectConfig.type === "senior" && (
                    <div className="grid grid-cols-1 gap-2">
                      {subjectConfig.subjects.map((subject) => {
                        const selected = selectedSubjects.includes(subject);
                        return (
                          <button
                            key={subject}
                            type="button"
                            onClick={() => {
                              setSelectedSubjects((prev) =>
                                prev.includes(subject)
                                  ? prev.filter((entry) => entry !== subject)
                                  : [...prev, subject],
                              );
                            }}
                            className={`rounded-md border px-3 py-2 text-left text-sm ${
                              selected ? "border-white bg-white text-black" : "border-white/10"
                            }`}
                          >
                            {subject}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <p className="mt-3 text-xs text-white/40">Selected: {selectedSubjects.length || 0}</p>
              </Field>
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
