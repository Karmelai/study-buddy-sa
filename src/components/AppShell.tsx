import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Menu, X } from "lucide-react";
import { AVATAR_OPTIONS, DEFAULT_AVATAR_ID, getAvatarOption, type AvatarId } from "@/lib/avatars";
import { getSubjectConfigForGrade, useKarmelStore } from "@/store/useKarmelStore";
import { toast } from "sonner";
import ProfileView from "./ProfileView";

const PROFILE_SETTINGS_KEY = "karmel-profile-settings";
const NAME_CHANGE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const GRADE_CHANGE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const FRIEND_PRESENCE_POLL_MS = 60 * 1000;
const ONLINE_WINDOW_MS = 20 * 60 * 1000;

const formatRemainingTime = (ms: number) => {
  if (ms <= 0) return "";
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) {
    return `${days} day${days === 1 ? "" : "s"}, ${hours} hour${hours === 1 ? "" : "s"}`;
  }
  return `${hours} hour${hours === 1 ? "" : "s"}`;
};

const isRecentlySeen = (lastSeenAt?: string | null) => {
  if (!lastSeenAt) return false;
  const timestamp = Date.parse(lastSeenAt);
  if (Number.isNaN(timestamp)) return false;
  return Date.now() - timestamp < ONLINE_WINDOW_MS;
};

export default function AppShell({ children }: { children: ReactNode }) {
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
  const updateUserPresence = useKarmelStore((s) => s.updateUserPresence);
  const markOffline = useKarmelStore((s) => s.markOffline);
  const refreshNetworkData = useKarmelStore((s) => s.refreshNetworkData);
  const friendsList = useKarmelStore((s) => s.friendsList);
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
  const seenOnlineFriendIdsRef = useRef<Set<string> | null>(null);

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
    if (!isAuthed || !userId) return;
    if (typeof window === "undefined") return;

    const inactivityLimitMs = 20 * 60 * 1000;
    const heartbeatMs = 3 * 60 * 1000;
    let isIdle = false;
    let heartbeatTimer: ReturnType<typeof window.setInterval> | null = null;
    let inactivityTimer: ReturnType<typeof window.setTimeout> | null = null;

    const clearTimers = () => {
      if (heartbeatTimer) {
        window.clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      if (inactivityTimer) {
        window.clearTimeout(inactivityTimer);
        inactivityTimer = null;
      }
    };

    const startHeartbeat = () => {
      if (heartbeatTimer) return;
      heartbeatTimer = window.setInterval(() => {
        void updateUserPresence();
      }, heartbeatMs);
    };

    const markIdle = () => {
      isIdle = true;
      if (heartbeatTimer) {
        window.clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
    };

    const resetInactivityTimer = () => {
      if (inactivityTimer) {
        window.clearTimeout(inactivityTimer);
      }
      inactivityTimer = window.setTimeout(markIdle, inactivityLimitMs);
    };

    const registerActivity = () => {
      if (isIdle) {
        isIdle = false;
        startHeartbeat();
        void updateUserPresence();
      }
      resetInactivityTimer();
    };

    void updateUserPresence();
    startHeartbeat();
    resetInactivityTimer();

    window.addEventListener("click", registerActivity, true);
    window.addEventListener("keydown", registerActivity, true);

    return () => {
      clearTimers();
      window.removeEventListener("click", registerActivity, true);
      window.removeEventListener("keydown", registerActivity, true);
    };
  }, [isAuthed, userId, updateUserPresence]);

  useEffect(() => {
    if (!isAuthed || !userId) return;
    if (typeof window === "undefined") return;

    const goOffline = () => {
      void markOffline();
    };

    window.addEventListener("pagehide", goOffline);
    window.addEventListener("beforeunload", goOffline);
    window.addEventListener("offline", goOffline);

    return () => {
      window.removeEventListener("pagehide", goOffline);
      window.removeEventListener("beforeunload", goOffline);
      window.removeEventListener("offline", goOffline);
    };
  }, [isAuthed, userId, markOffline]);

  useEffect(() => {
    if (!isAuthed || !userId) return;
    if (typeof window === "undefined") return;

    let cancelled = false;

    const syncPresence = async () => {
      await refreshNetworkData();
      if (cancelled) return;

      const onlineIds = new Set(
        useKarmelStore
          .getState()
          .friendsList.filter((friend) => isRecentlySeen(friend.last_seen_at))
          .map((friend) => friend.id),
      );

      if (seenOnlineFriendIdsRef.current === null) {
        seenOnlineFriendIdsRef.current = onlineIds;
        return;
      }

      const previousOnlineIds = seenOnlineFriendIdsRef.current;
      seenOnlineFriendIdsRef.current = onlineIds;

      const newlyOnlineFriends = useKarmelStore
        .getState()
        .friendsList.filter(
          (friend) => onlineIds.has(friend.id) && !previousOnlineIds.has(friend.id),
        );

      newlyOnlineFriends.slice(0, 3).forEach((friend) => {
        toast(`${friend.full_name} is online`, {
          description: "Tap to open your Friends page.",
          duration: 4000,
          action: {
            label: "Open",
            onClick: () => navigate({ to: "/friends" }),
          },
        });
      });
    };

    void syncPresence();
    const interval = window.setInterval(() => {
      void syncPresence();
    }, FRIEND_PRESENCE_POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [isAuthed, userId, navigate, refreshNetworkData]);

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

  useEffect(() => {
    if (!isAuthed) {
      seenOnlineFriendIdsRef.current = null;
      return;
    }

    seenOnlineFriendIdsRef.current = new Set(
      friendsList.filter((friend) => isRecentlySeen(friend.last_seen_at)).map((friend) => friend.id),
    );
  }, [friendsList, isAuthed]);

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
    <div className="h-screen overflow-hidden bg-black text-white flex flex-col">
      <header className="sticky top-0 z-30 shrink-0 border-b border-white/10 bg-black/95 backdrop-blur">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="font-semibold tracking-wide text-lg">
            KARMEL
          </Link>
          <nav className="hidden gap-4 text-sm text-white/60 items-center sm:flex">
            <Link to="/" activeProps={{ className: "text-white" }} activeOptions={{ exact: true }}>
              Home
            </Link>
            <Link to="/study" activeProps={{ className: "text-white" }}>
              Study
            </Link>
            <Link to="/papers" activeProps={{ className: "text-white" }}>
              Past Papers
            </Link>
            <Link to="/friends" activeProps={{ className: "text-white" }} className="relative">
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
              className="inline-flex h-10 w-10 items-center justify-center text-white transition hover:text-white/80 sm:hidden"
              aria-label={isMobileNavOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-haspopup="menu"
              aria-expanded={isMobileNavOpen}
            >
              {isMobileNavOpen ? <X size={16} /> : <Menu size={16} />}
            </button>
            <button
              type="button"
              onClick={() => setIsProfilePageOpen(true)}
              className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
              aria-label="Open profile"
            >
              {avatarId === DEFAULT_AVATAR_ID ? (
                <span className="text-[11px] uppercase tracking-[0.25em] text-white/70">ME</span>
              ) : (
                <img src={selectedAvatar.image} alt={selectedAvatar.label} className="h-full w-full object-cover" />
              )}
            </button>
            <div
              className={`absolute right-0 top-[calc(100%+0.75rem)] z-40 w-56 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/95 shadow-2xl shadow-black/50 backdrop-blur-xl transition-all duration-200 sm:hidden ${
                isMobileNavOpen ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0"
              }`}
              role="menu"
              aria-label="Mobile navigation"
            >
              <div className="border-b border-white/10 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.25em] text-white/40">Navigate</p>
              </div>
              <div className="flex flex-col p-2 text-sm text-white/80">
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
          className={`mx-auto w-full max-w-xl rounded-3xl border border-white/10 bg-zinc-950/95 p-5 shadow-2xl shadow-black/50 transition-all duration-300 sm:p-6 ${
            isProfileOpen ? "translate-y-0 scale-100" : "translate-y-4 scale-95"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/40">Profile settings</p>
              <h2 className="mt-2 text-xl font-semibold sm:text-2xl">Personalise your workspace</h2>
            </div>
            <button
              type="button"
              onClick={() => setIsProfileOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
              aria-label="Close profile settings"
            >
              <X size={16} />
            </button>
          </div>

          <div className="mt-6 space-y-5 sm:mt-7">
            <section className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-medium sm:text-lg">Name customization</h3>
                  <p className="mt-1 text-sm text-white/50">Update how your name appears across the dashboard.</p>
                </div>
                <div className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/50">
                  {isNameCooldownActive ? "Locked" : "Open"}
                </div>
              </div>

              <label className="mt-4 block text-sm text-white/60">
                Display name
                <input
                  type="text"
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  disabled={isNameCooldownActive}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Enter your name"
                />
              </label>
              {nameCooldownMessage ? (
                <p className="mt-3 text-sm text-white/55">{nameCooldownMessage}</p>
              ) : null}
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-medium sm:text-lg">Grade selection</h3>
                  <p className="mt-1 text-sm text-white/50">Adjust the grade used for your subject options and study guidance.</p>
                </div>
                <div className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/50">
                  {isGradeCooldownActive ? "Locked" : "Open"}
                </div>
              </div>

              <label className="mt-4 block text-sm text-white/60">
                Grade
                <select
                  value={draftGrade}
                  onChange={(event) => setDraftGrade(Number(event.target.value))}
                  disabled={isGradeCooldownActive}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white focus:border-white/30 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {Array.from({ length: 5 }, (_, index) => 8 + index).map((value) => (
                    <option key={value} value={value} className="bg-black text-white">
                      Grade {value}
                    </option>
                  ))}
                </select>
              </label>
              {gradeCooldownMessage ? (
                <p className="mt-3 text-sm text-white/55">{gradeCooldownMessage}</p>
              ) : null}
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
              <div>
                <h3 className="text-base font-medium sm:text-lg">Avatar selection</h3>
                <p className="mt-1 text-sm text-white/50">Choose a character that will appear in the header and your profile.</p>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                {AVATAR_OPTIONS.map((option) => {
                  const isSelected = draftAvatarId === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setDraftAvatarId(option.id)}
                      className={`flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border transition-all duration-200 ${
                        isSelected ? "border-white/80" : "border-white/10 hover:border-white/30"
                      }`}
                      aria-label={option.label}
                    >
                      {option.id === DEFAULT_AVATAR_ID ? (
                        <span className="text-[10px] uppercase tracking-[0.25em] text-white/70">Default</span>
                      ) : (
                        <img src={option.image} alt={option.label} className="h-full w-full object-cover" />
                      )}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
              <div>
                <h3 className="text-base font-medium sm:text-lg">Subject selection manager</h3>
                <p className="mt-1 text-sm text-white/50">Choose which subjects appear in your active study tools.</p>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {availableSubjects.map((subject) => {
                  const selected = draftSubjects.includes(subject);
                  return (
                    <button
                      key={subject}
                      type="button"
                      onClick={() => toggleSubject(subject)}
                      className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition ${
                        selected
                          ? "border-white/20 bg-white text-black"
                          : "border-white/10 bg-black/30 text-white/80 hover:border-white/20"
                      }`}
                    >
                      <span>{subject}</span>
                      {selected ? <Check size={16} /> : null}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
              <div>
                <h3 className="text-base font-medium sm:text-lg">Account Privacy</h3>
                <p className="mt-1 text-sm text-white/50">Control whether other students can find you in the study network.</p>
              </div>

              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  onClick={() => setDraftIsPublic(true)}
                  className={`w-full text-left flex items-center justify-between rounded-xl border px-4 py-3 text-sm transition ${
                    draftIsPublic
                      ? "border-white/20 bg-white text-black"
                      : "border-white/10 bg-black/30 text-white/80 hover:border-white/20"
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
                      ? "border-white/20 bg-white text-black"
                      : "border-white/10 bg-black/30 text-white/80 hover:border-white/20"
                  }`}
                >
                  <div>
                    <p className="font-medium">Private Account</p>
                    <p className="text-xs opacity-70">Hidden from search</p>
                  </div>
                  {!draftIsPublic ? <Check size={16} /> : null}
                </button>
              </div>
            </section>
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
              className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-zinc-200"
            >
              Apply Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
