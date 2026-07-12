import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Check, Menu, X } from "lucide-react";
import { AVATAR_OPTIONS, DEFAULT_AVATAR_ID, getAvatarOption, type AvatarId } from "@/lib/avatars";
import { getSubjectConfigForGrade, useKarmelStore } from "@/store/useKarmelStore";
import { useTheme, type Theme } from "@/hooks/use-theme";
import ProfileView from "./ProfileView";
import SettingsAccordion from "./SettingsAccordion";

const PROFILE_SETTINGS_KEY = "karmel-profile-settings";
const NAME_CHANGE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const GRADE_CHANGE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const STANDARD_THEMES: Theme[] = ["default", "high-contrast", "light", "purple", "midnight", "ocean", "sunset", "springbok"];
const DYNAMIC_THEMES: Theme[] = ["aurora", "glassmorphism", "synthwave", "stardust"];
const THEME_LABELS: Record<Theme, string> = {
  default: "Default",
  "high-contrast": "High Contrast",
  light: "Light",
  purple: "Purple",
  midnight: "Midnight",
  ocean: "Ocean",
  sunset: "Sunset",
  springbok: "Springbok",
  aurora: "Aurora",
  glassmorphism: "Glassmorphism",
  synthwave: "Synthwave",
  stardust: "Stardust",
};
const formatRemainingTime = (ms: number) => {
  if (ms <= 0) return "";
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) {
    return `${days} day${days === 1 ? "" : "s"}, ${hours} hour${hours === 1 ? "" : "s"}`;
  }
  return `${hours} hour${hours === 1 ? "" : "s"}`;
};

export default function AppShell({ children }: { children: ReactNode }) {
  const { theme, setTheme } = useTheme();
  const isAuthed = useKarmelStore((s) => s.isAuthed);
  const userId = useKarmelStore((s) => s.userId);
  const logout = useKarmelStore((s) => s.logout);
  const studentName = useKarmelStore((s) => s.studentName);
  const username = useKarmelStore((s) => s.username);
  const avatarId = useKarmelStore((s) => s.avatarId);
  const grade = useKarmelStore((s) => s.grade);
  const level = useKarmelStore((s) => s.level);
  const subjects = useKarmelStore((s) => s.subjects);
  const is_public = useKarmelStore((s) => s.is_public);
  const pendingIncomingRequests = useKarmelStore((s) => s.pendingIncomingRequests);
  const updatePrivacySettings = useKarmelStore((s) => s.updatePrivacySettings);
  const setStudent = useKarmelStore((s) => s.setStudent);
  const setAvatar = useKarmelStore((s) => s.setAvatar);
  const setSubjects = useKarmelStore((s) => s.setSubjects);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [isProfilePageOpen, setIsProfilePageOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [draftName, setDraftName] = useState(studentName);
  const [draftSubjects, setDraftSubjects] = useState<string[]>(subjects);
  const [draftGrade, setDraftGrade] = useState<number>(grade);
  const [draftAvatarId, setDraftAvatarId] = useState<AvatarId>(avatarId);
  const [draftIsPublic, setDraftIsPublic] = useState(is_public);
  const [lastNameChangeTimestamp, setLastNameChangeTimestamp] = useState<number | null>(null);
  const [lastGradeChangeTimestamp, setLastGradeChangeTimestamp] = useState<number | null>(null);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const availableSubjects = getSubjectConfigForGrade(grade).subjects;
  const isNameCooldownActive = Boolean(lastNameChangeTimestamp && Date.now() - lastNameChangeTimestamp < NAME_CHANGE_COOLDOWN_MS);
  const isGradeCooldownActive = Boolean(lastGradeChangeTimestamp && Date.now() - lastGradeChangeTimestamp < GRADE_CHANGE_COOLDOWN_MS);
  const nameCooldownRemainingMs = lastNameChangeTimestamp
    ? NAME_CHANGE_COOLDOWN_MS - (Date.now() - lastNameChangeTimestamp)
    : 0;
  const gradeCooldownRemainingMs = lastGradeChangeTimestamp
    ? GRADE_CHANGE_COOLDOWN_MS - (Date.now() - lastGradeChangeTimestamp)
    : 0;
  const nameCooldownMessage = isNameCooldownActive && nameCooldownRemainingMs > 0
    ? `You can only change your name once every 7 days. Remaining: ${formatRemainingTime(nameCooldownRemainingMs)}.`
    : null;
  const gradeCooldownMessage = isGradeCooldownActive && gradeCooldownRemainingMs > 0
    ? `You can only change your grade once every 7 days. Remaining: ${formatRemainingTime(gradeCooldownRemainingMs)}.`
    : null;
  const hasNameChanged = draftName.trim() !== studentName.trim();
  const selectedAvatar = getAvatarOption(avatarId);
  const hasGradeChanged = draftGrade !== grade;

  useEffect(() => {
    if (!isAuthed && pathname !== "/auth") {
      navigate({ to: "/auth", search: { mode: "login" } });
    }
  }, [isAuthed, pathname, navigate]);

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(PROFILE_SETTINGS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as {
          name?: string;
          subjects?: string[];
          grade?: number;
          lastNameChangeTimestamp?: number | null;
          lastGradeChangeTimestamp?: number | null;
        };
        setDraftName(parsed.name ?? studentName);
        setDraftSubjects(parsed.subjects ?? subjects);
        setDraftGrade(parsed.grade ?? grade);
        setDraftAvatarId((parsed as { avatarId?: AvatarId }).avatarId ?? avatarId);
        setLastNameChangeTimestamp(parsed.lastNameChangeTimestamp ?? null);
        setLastGradeChangeTimestamp(parsed.lastGradeChangeTimestamp ?? null);
      } else {
        setDraftName(studentName);
        setDraftSubjects(subjects);
        setDraftGrade(grade);
        setDraftAvatarId(avatarId);
        setLastNameChangeTimestamp(null);
        setLastGradeChangeTimestamp(null);
      }
    } catch {
      setDraftName(studentName);
      setDraftSubjects(subjects);
      setDraftGrade(grade);
      setDraftAvatarId(avatarId);
    }
  }, [studentName, subjects, grade]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload = {
      name: draftName,
      subjects: draftSubjects,
      grade: draftGrade,
      avatarId: draftAvatarId,
      lastNameChangeTimestamp,
      lastGradeChangeTimestamp,
    };
    window.localStorage.setItem(PROFILE_SETTINGS_KEY, JSON.stringify(payload));
  }, [draftName, draftSubjects, draftGrade, draftAvatarId, lastNameChangeTimestamp, lastGradeChangeTimestamp]);

  const handleApplyProfile = () => {
    const nextName = !isNameCooldownActive && hasNameChanged ? draftName.trim() || "Student" : studentName;
    const nextGrade = !isGradeCooldownActive && hasGradeChanged ? draftGrade : grade;
    const nextSubjects = draftSubjects.filter(Boolean);

    if (!isNameCooldownActive && hasNameChanged) {
      setLastNameChangeTimestamp(Date.now());
    }
    if (!isGradeCooldownActive && hasGradeChanged) {
      setLastGradeChangeTimestamp(Date.now());
    }

    if (draftIsPublic !== is_public) {
      void updatePrivacySettings(draftIsPublic);
    }

    setStudent(nextName, nextGrade);
    setAvatar(draftAvatarId);
    setSubjects(nextSubjects);
    setIsProfileOpen(false);
  };

  const handleLogout = () => {
    logout();
    setIsProfileOpen(false);
    navigate({ to: "/auth", search: { mode: "login" } });
  };

  const toggleSubject = (subject: string) => {
    setDraftSubjects((prev) =>
      prev.includes(subject) ? prev.filter((entry) => entry !== subject) : [...prev, subject],
    );
  };

  if (!isAuthed) return null;

  return (
    <div className="h-screen overflow-hidden bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-30 shrink-0 border-b border-border bg-background/95 backdrop-blur">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="font-semibold tracking-wide text-lg">
            KARMEL
          </Link>
          <nav className="hidden items-center gap-4 text-sm text-muted-foreground sm:flex">
            <Link to="/" activeProps={{ className: "text-foreground" }} activeOptions={{ exact: true }}>
              Home
            </Link>
            <Link to="/study" activeProps={{ className: "text-foreground" }}>
              Study
            </Link>
            <Link to="/timer" activeProps={{ className: "text-foreground" }}>
              Timer
            </Link>
            <Link to="/papers" activeProps={{ className: "text-foreground" }}>
              Past Papers
            </Link>
            <Link to="/friends" activeProps={{ className: "text-foreground" }} className="relative">
              Friends
              {pendingIncomingRequests.length > 0 ? (
                <span className="absolute -right-3 -top-2 min-w-5 rounded-full bg-white px-1.5 py-0.5 text-[10px] font-semibold text-black">
                  {pendingIncomingRequests.length}
                </span>
              ) : null}
            </Link>
          </nav>
          <div className="relative flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsMobileNavOpen((open) => !open)}
              className="inline-flex h-10 w-10 items-center justify-center text-foreground transition hover:text-muted-foreground sm:hidden"
              aria-label={isMobileNavOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-haspopup="menu"
              aria-expanded={isMobileNavOpen}
            >
              {isMobileNavOpen ? <X size={16} /> : <Menu size={16} />}
            </button>
            <button
              type="button"
              onClick={() => setIsProfilePageOpen(true)}
              className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-border bg-card text-foreground transition hover:bg-accent"
              aria-label="Open profile"
            >
              {avatarId === DEFAULT_AVATAR_ID ? (
                <span className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">ME</span>
              ) : (
                <img src={selectedAvatar.image} alt={selectedAvatar.label} className="h-full w-full object-cover" />
              )}
            </button>
            <div
              className={`absolute right-0 top-[calc(100%+0.75rem)] z-40 w-56 overflow-hidden rounded-2xl border border-border bg-popover/95 text-popover-foreground shadow-2xl shadow-black/50 backdrop-blur-xl transition-all duration-200 sm:hidden ${
                isMobileNavOpen ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0"
              }`}
              role="menu"
              aria-label="Mobile navigation"
            >
              <div className="border-b border-border px-4 py-3">
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Navigate</p>
              </div>
              <div className="flex flex-col p-2 text-sm text-muted-foreground">
                <Link
                  to="/"
                  activeProps={{ className: "bg-white/10 text-white" }}
                  activeOptions={{ exact: true }}
                  onClick={() => setIsMobileNavOpen(false)}
                  className="rounded-xl px-3 py-3 transition hover:bg-white/10"
                >
                  Home
                </Link>
                <Link
                  to="/study"
                  activeProps={{ className: "bg-white/10 text-white" }}
                  onClick={() => setIsMobileNavOpen(false)}
                  className="rounded-xl px-3 py-3 transition hover:bg-white/10"
                >
                  Study
                </Link>
                <Link
                  to="/timer"
                  activeProps={{ className: "bg-white/10 text-white" }}
                  onClick={() => setIsMobileNavOpen(false)}
                  className="rounded-xl px-3 py-3 transition hover:bg-white/10"
                >
                  Timer
                </Link>
                <Link
                  to="/papers"
                  activeProps={{ className: "bg-white/10 text-white" }}
                  onClick={() => setIsMobileNavOpen(false)}
                  className="rounded-xl px-3 py-3 transition hover:bg-white/10"
                >
                  Past Papers
                </Link>
                <Link
                  to="/friends"
                  activeProps={{ className: "bg-white/10 text-white" }}
                  onClick={() => setIsMobileNavOpen(false)}
                  className="rounded-xl px-3 py-3 transition hover:bg-white/10"
                >
                  Friends
                </Link>
              </div>
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1 min-h-0 flex flex-col overflow-y-auto overflow-x-hidden">{children}</main>

      <ProfileView
        isOpen={isProfilePageOpen}
        onClose={() => setIsProfilePageOpen(false)}
        user={
          isProfilePageOpen
            ? {
                id: userId || "",
                username: username,
                full_name: studentName,
                avatar_id: avatarId,
                selected_subjects: subjects,
                grade: grade,
                level: level,
                xp: useKarmelStore.getState().xp,
                is_public: is_public,
                followers_count: useKarmelStore.getState().followers_count,
                following_count: useKarmelStore.getState().following_count,
              }
            : null
        }
        isCurrentUser={true}
        onSettingsClick={() => {
          setIsProfilePageOpen(false);
          setIsProfileOpen(true);
        }}
      />

      <div
        className={`fixed inset-0 z-50 overflow-y-auto bg-black/75 px-4 py-6 sm:py-8 backdrop-blur-sm transition-all duration-300 ${
          isProfileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div
          className={`mx-auto w-full max-w-xl rounded-3xl border border-border bg-popover/95 p-5 text-popover-foreground shadow-2xl shadow-black/50 transition-all duration-300 sm:p-6 ${
            isProfileOpen ? "translate-y-0 scale-100" : "translate-y-4 scale-95"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Profile settings</p>
              <h2 className="mt-2 text-xl font-semibold sm:text-2xl">Personalise your workspace</h2>
            </div>
            <button
              type="button"
              onClick={() => setIsProfileOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition hover:bg-accent hover:text-foreground"
              aria-label="Close profile settings"
            >
              <X size={16} />
            </button>
          </div>

          <div className="mt-6 space-y-5 sm:mt-7">
            <SettingsAccordion
              title="Name customization"
              description="Update how your name appears across the dashboard."
              trailing={<span className="rounded-full border border-border bg-background px-3 py-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">{isNameCooldownActive ? "Locked" : "Open"}</span>}
            >
              <label className="block text-sm text-muted-foreground">
                Display name
                <input
                  type="text"
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  disabled={isNameCooldownActive}
                  className="mt-2 w-full rounded-lg border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Enter your name"
                />
              </label>
              {nameCooldownMessage ? (
                <p className="mt-3 text-sm text-muted-foreground">{nameCooldownMessage}</p>
              ) : null}
            </SettingsAccordion>

            <SettingsAccordion title="Appearance" description="Choose the colour theme for your study workspace.">
              <div className="space-y-5">
                {[
                  { label: "Standard Themes", options: STANDARD_THEMES },
                  { label: "Dynamic Styles", options: DYNAMIC_THEMES },
                ].map((group) => (
                  <div key={group.label}>
                    <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{group.label}</p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {group.options.map((option) => {
                  const selected = theme === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setTheme(option)}
                      className={`rounded-xl border px-3 py-3 text-left text-sm transition ${
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-foreground hover:bg-accent"
                      }`}
                    >
                      <span className="block font-medium">{THEME_LABELS[option]}</span>
                      {selected ? <span className="mt-1 block text-xs opacity-80">Active</span> : null}
                    </button>
                  );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </SettingsAccordion>

            <SettingsAccordion
              title="Grade selection"
              description="Adjust the grade used for your subject options and study guidance."
              trailing={<span className="rounded-full border border-border bg-background px-3 py-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">{isGradeCooldownActive ? "Locked" : "Open"}</span>}
            >
              <label className="block text-sm text-muted-foreground">
                Grade
                <select
                  value={draftGrade}
                  onChange={(event) => setDraftGrade(Number(event.target.value))}
                  disabled={isGradeCooldownActive}
                  className="mt-2 w-full rounded-lg border border-input bg-background px-4 py-3 text-sm text-foreground focus:border-ring focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {Array.from({ length: 5 }, (_, index) => 8 + index).map((value) => (
                    <option key={value} value={value}>
                      Grade {value}
                    </option>
                  ))}
                </select>
              </label>
              {gradeCooldownMessage ? (
                <p className="mt-3 text-sm text-muted-foreground">{gradeCooldownMessage}</p>
              ) : null}
            </SettingsAccordion>

            <SettingsAccordion title="Avatar selection" description="Choose a character that will appear in the header and your profile.">
              <div className="grid grid-cols-3 gap-3">
                {AVATAR_OPTIONS.map((option) => {
                  const isSelected = draftAvatarId === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setDraftAvatarId(option.id)}
                      className={`flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border transition-all duration-200 ${
                        isSelected ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/60"
                      }`}
                      aria-label={option.label}
                    >
                      {option.id === DEFAULT_AVATAR_ID ? (
                        <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Default</span>
                      ) : (
                        <img src={option.image} alt={option.label} className="h-full w-full object-cover" />
                      )}
                    </button>
                  );
                })}
              </div>
            </SettingsAccordion>

            <SettingsAccordion title="Subject selection manager" description="Choose which subjects appear in your active study tools.">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {availableSubjects.map((subject) => {
                  const selected = draftSubjects.includes(subject);
                  return (
                    <button
                      key={subject}
                      type="button"
                      onClick={() => toggleSubject(subject)}
                      className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition ${
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-foreground hover:border-primary/60 hover:bg-accent"
                      }`}
                    >
                      <span>{subject}</span>
                      {selected ? <Check size={16} /> : null}
                    </button>
                  );
                })}
              </div>
            </SettingsAccordion>

            <SettingsAccordion title="Account privacy" description="Control whether other students can find you in the study network.">
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setDraftIsPublic(true)}
                  className={`w-full text-left flex items-center justify-between rounded-xl border px-4 py-3 text-sm transition ${
                    draftIsPublic
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground hover:border-primary/60 hover:bg-accent"
                  }`}
                >
                  <div>
                    <p className="font-medium">Public Account</p>
                    <p className="text-xs opacity-70">Visible in global search</p>
                  </div>
                  {draftIsPublic ? <Check size={16} /> : null}
                </button>

                <button
                  type="button"
                  onClick={() => setDraftIsPublic(false)}
                  className={`w-full text-left flex items-center justify-between rounded-xl border px-4 py-3 text-sm transition ${
                    !draftIsPublic
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground hover:border-primary/60 hover:bg-accent"
                  }`}
                >
                  <div>
                    <p className="font-medium">Private Account</p>
                    <p className="text-xs opacity-70">Hidden from search</p>
                  </div>
                  {!draftIsPublic ? <Check size={16} /> : null}
                </button>
              </div>
            </SettingsAccordion>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              Log out
            </button>
            <button
              type="button"
              onClick={handleApplyProfile}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              Apply Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
