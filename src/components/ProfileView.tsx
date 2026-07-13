import { useEffect, useState } from "react";
import { X, Settings } from "lucide-react";
import { useKarmelStore, type SocialProfile, type UserProfile } from "@/store/useKarmelStore";
import { DEFAULT_AVATAR_ID, getAvatarOption, type AvatarId } from "@/lib/avatars";
import { supabase } from "@/lib/supabase";

interface ProfileViewProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  isCurrentUser: boolean;
  onSettingsClick: () => void;
  onFollowChange?: (userId: string, isFollowing: boolean) => void;
}

type ConnectionView = "followers" | "following";

type ConnectionProfileRow = {
  id: string;
  username?: string | null;
  full_name?: string | null;
  avatar_id?: AvatarId | null;
  selected_subjects?: string[] | null;
  last_seen_at?: string | null;
  grade?: number | null;
  education_level?: "high_school" | "university" | null;
  institution_name?: string | null;
  course_of_study?: string | null;
  year_of_study?: string | null;
  level?: number | null;
  xp?: number | null;
  is_public?: boolean | null;
  followers_count?: number | null;
  following_count?: number | null;
};

const normalizeDisplayUsername = (username: string) => {
  const trimmed = username.trim();
  if (!trimmed) return "@student";
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
};

const toConnectionProfile = (profile: ConnectionProfileRow): SocialProfile => ({
  id: profile.id,
  username: normalizeDisplayUsername(profile.username ?? profile.full_name ?? ""),
  full_name: profile.full_name?.trim() ? profile.full_name : "Student",
  avatar_id: profile.avatar_id ?? DEFAULT_AVATAR_ID,
  selected_subjects: Array.isArray(profile.selected_subjects) ? profile.selected_subjects.filter(Boolean) : undefined,
  last_seen_at: profile.last_seen_at ?? null,
  grade: Number(profile.grade ?? Number.NaN),
  education_level: profile.education_level,
  institution_name: profile.institution_name,
  course_of_study: profile.course_of_study,
  year_of_study: profile.year_of_study,
  level: Number(profile.level ?? 1) || 1,
  xp: Number(profile.xp ?? 0) || 0,
  is_public: Boolean(profile.is_public),
  followers_count: Number(profile.followers_count ?? 0) || 0,
  following_count: Number(profile.following_count ?? 0) || 0,
  follow_status: "accepted",
});

const buildConnectionQuery = async (userId: string, view: ConnectionView) => {
  const relationColumn = view === "followers" ? "following_id" : "follower_id";
  const targetColumn = view === "followers" ? "follower_id" : "following_id";

  const { data: followRows, error: followError } = await supabase
    .from("follows")
    .select("follower_id, following_id, created_at, status")
    .eq(relationColumn, userId)
    .eq("status", "accepted")
    .order("created_at", { ascending: false });

  if (followError) {
    throw followError;
  }

  const ids = (followRows ?? []).map((row) => row[targetColumn]).filter(Boolean);
  if (ids.length === 0) {
    return [] as SocialProfile[];
  }

  const { data: profileRows, error: profileError } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_id, selected_subjects, last_seen_at, grade, education_level, institution_name, course_of_study, year_of_study, level, xp, is_public, followers_count, following_count")
    .in("id", ids);

  if (profileError) {
    throw profileError;
  }

  const profileMap = new Map<string, ConnectionProfileRow>(
    ((profileRows ?? []) as ConnectionProfileRow[]).map((profile) => [profile.id, profile]),
  );

  return ids
    .map((id) => profileMap.get(id))
    .filter(Boolean)
    .map((profile) => toConnectionProfile(profile as ConnectionProfileRow));
};

export default function ProfileView({
  isOpen,
  onClose,
  user: initialUser,
  isCurrentUser,
  onSettingsClick,
  onFollowChange,
}: ProfileViewProps) {
  const currentUserSubjects = useKarmelStore((s) => s.subjects);
  const currentUserLevel = useKarmelStore((s) => s.level);
  const following_count = useKarmelStore((s) => s.following_count);
  const onlineUserIds = useKarmelStore((s) => s.onlineUserIds);
  const followUser = useKarmelStore((s) => s.followUser);
  const unfollowUser = useKarmelStore((s) => s.unfollowUser);
  const [isAvatarPreviewOpen, setIsAvatarPreviewOpen] = useState(false);
  const [connectionView, setConnectionView] = useState<ConnectionView | null>(null);
  const [connectionItems, setConnectionItems] = useState<SocialProfile[]>([]);
  const [isConnectionLoading, setIsConnectionLoading] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [fetchedProfile, setFetchedProfile] = useState<UserProfile | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [profileFetchError, setProfileFetchError] = useState<string | null>(null);
  const user = fetchedProfile ?? initialUser;
  const requestStatus = user ? (user as UserProfile & { follow_status?: "pending" | "accepted" | "declined" }).follow_status : undefined;
  const isFollowing = requestStatus === "accepted";
  const canViewConnections = isCurrentUser || Boolean(user?.is_public) || isFollowing;
  const activeConnectionLabel = connectionView === "followers" ? "Followers" : "Following";

  useEffect(() => {
    const userId = initialUser?.id;
    if (!userId) {
      setFetchedProfile(null);
      setIsProfileLoading(false);
      return;
    }

    let cancelled = false;
    setIsProfileLoading(true);
    setProfileFetchError(null);

    void supabase
      .from("profiles")
      .select("id, username, full_name, avatar_id, selected_subjects, grade, education_level, institution_name, course_of_study, year_of_study, level, xp, is_public, followers_count, following_count")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setProfileFetchError(error.message);
          setFetchedProfile(null);
        } else if (data) {
          // Keep relationship state supplied by the parent while refreshing academic data.
          const rawGrade = (data as { grade?: unknown }).grade;
          setFetchedProfile({
            ...initialUser,
            ...(data as UserProfile),
            grade: rawGrade === null || rawGrade === undefined || rawGrade === "" ? Number.NaN : Number(rawGrade),
          });
        } else {
          setFetchedProfile(null);
        }
        setIsProfileLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [initialUser?.id]);

  useEffect(() => {
    if (!isOpen || !user) {
      setIsAvatarPreviewOpen(false);
      setConnectionView(null);
      setConnectionItems([]);
      setConnectionError(null);
      setIsConnectionLoading(false);
      return;
    }

    setIsAvatarPreviewOpen(false);
    setConnectionView(null);
    setConnectionItems([]);
    setConnectionError(null);
    setIsConnectionLoading(false);
  }, [isOpen, user?.id]);

  useEffect(() => {
    if (!isOpen || !user || !connectionView) return;

    if (!canViewConnections) {
      setConnectionItems([]);
      setConnectionError(null);
      setIsConnectionLoading(false);
      return;
    }

    let cancelled = false;

    const loadConnections = async () => {
      setIsConnectionLoading(true);
      setConnectionError(null);

      try {
        const items = await buildConnectionQuery(user.id, connectionView);
        if (!cancelled) {
          setConnectionItems(items);
        }
      } catch (error) {
        if (!cancelled) {
          setConnectionItems([]);
          setConnectionError(error instanceof Error ? error.message : "Could not load connections.");
        }
      } finally {
        if (!cancelled) {
          setIsConnectionLoading(false);
        }
      }
    };

    void loadConnections();

    return () => {
      cancelled = true;
    };
  }, [canViewConnections, connectionView, isOpen, user?.id]);

  if (!isOpen || !user) return null;
  if (isProfileLoading && fetchedProfile?.id !== initialUser?.id) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm">
        <p className="text-sm text-white/60">Loading profile…</p>
      </div>
    );
  }

  const avatarOption = getAvatarOption(user.avatar_id);
  const normalizedUsername = String(user.username ?? "").trim();
  const displayUsername = normalizedUsername ? (normalizedUsername.startsWith("@") ? normalizedUsername : `@${normalizedUsername}`) : "@student";
  const isPending = requestStatus === "pending";
  const level = isCurrentUser ? currentUserLevel : user.level ?? 1;
  const canViewSubjects = isCurrentUser || isFollowing;
  const isOnline = onlineUserIds.includes(user.id);
  const isUniversityStudent = user.education_level === "university";
  const isHighSchoolStudent = !isUniversityStudent;
  const hasGrade = Number.isFinite(user.grade);
  const hasUniversityDetails = Boolean(user.institution_name || user.course_of_study || user.year_of_study);

  const openConnections = (view: ConnectionView) => {
    setConnectionView(view);
  };

  const handleFollowClick = async () => {
    if (isPending) return;
    if (isFollowing) {
      const res = await unfollowUser(user.id);
      if (res.ok) {
        onFollowChange?.(user.id, false);
      }
    } else {
      const res = await followUser(user.id);
      if (res.ok) {
        onFollowChange?.(user.id, true);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 px-4 py-6 sm:py-8 backdrop-blur-sm transition-all duration-300">
      <div
        className={`mx-auto w-full max-w-xl rounded-3xl border border-white/10 bg-zinc-950/95 shadow-2xl shadow-black/50 transition-all duration-300 ${
          isOpen ? "translate-y-0 scale-100" : "translate-y-4 scale-95"
        }`}
      >
        {/* Header with Close Button */}
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5 sm:p-6">
          <div className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
            aria-label="Close profile"
          >
            <X size={16} />
          </button>
        </div>

        {/* Profile Content */}
        <div className="p-5 sm:p-6">
          {/* Avatar and Name Section */}
          <div className="relative flex flex-col items-center gap-4 overflow-hidden rounded-2xl py-3">
            <button
              type="button"
              onClick={() => setIsAvatarPreviewOpen(true)}
              className={`h-24 w-24 overflow-hidden rounded-full bg-white/5 transition-transform duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-white/40 ${
                isOnline ? "ring-2 ring-green-500 ring-offset-2 ring-offset-slate-900" : "border border-white/10"
              }`}
              aria-label="Preview avatar"
            >
              <img
                src={avatarOption.image}
                alt={user.full_name}
                className="h-full w-full object-cover"
              />
            </button>

            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-semibold text-white">{user.full_name}</h2>
                {isCurrentUser && (
                  <button
                    type="button"
                    onClick={onSettingsClick}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
                    aria-label="Open settings"
                  >
                    <Settings size={16} />
                  </button>
                )}
              </div>
              <p className="text-sm text-white/50">{displayUsername}</p>
            </div>
          </div>

          {/* Stats Row */}
          <div className={`mt-6 grid grid-cols-2 gap-3 ${isUniversityStudent ? "sm:grid-cols-3" : "sm:grid-cols-4"}`}>
            <button
              type="button"
              onClick={() => openConnections("followers")}
              className="flex flex-col items-center gap-1 rounded-2xl border border-white/10 bg-white/5 p-4 text-center transition hover:border-white/20 hover:bg-white/10"
              aria-label="View followers"
            >
              <p className="text-lg font-semibold text-white">{user.followers_count}</p>
              <p className="text-xs uppercase tracking-[0.2em] text-white/45">Followers</p>
            </button>
            <button
              type="button"
              onClick={() => openConnections("following")}
              className="flex flex-col items-center gap-1 rounded-2xl border border-white/10 bg-white/5 p-4 text-center transition hover:border-white/20 hover:bg-white/10"
              aria-label="View following"
            >
              <p className="text-lg font-semibold text-white">
                {isCurrentUser ? following_count : (user as UserProfile & { following_count?: number }).following_count ?? 0}
              </p>
              <p className="text-xs uppercase tracking-[0.2em] text-white/45">Following</p>
            </button>
            {isHighSchoolStudent && hasGrade && <div className="flex flex-col items-center gap-1 rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
              <p className="text-lg font-semibold text-white">{user.grade}</p>
              <p className="text-xs uppercase tracking-[0.2em] text-white/45">Grade</p>
            </div>}
            <div className="flex flex-col items-center gap-1 rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
              <p className="text-lg font-semibold text-white">{level}</p>
              <p className="text-xs uppercase tracking-[0.2em] text-white/45">Level</p>
            </div>
          </div>

          {/* Grade and Subjects Section */}
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm font-medium text-white/80 mb-3">Academic Profile</p>
            {isUniversityStudent ? <>
              <p className="text-xs text-white/50 mb-2">Institution: <span className="font-medium text-white">{user.institution_name || "Not provided"}</span></p>
              <p className="text-xs text-white/50 mb-2">Course: <span className="font-medium text-white">{user.course_of_study || "Not provided"}</span></p>
              <p className="text-xs text-white/50 mb-2">Year: <span className="font-medium text-white">{user.year_of_study || "Not provided"}</span></p>
            </> : isHighSchoolStudent && hasGrade ? <p className="text-xs text-white/50 mb-2">
              Grade: <span className="font-medium text-white">{user.grade}</span>
            </p> : !hasGrade && !hasUniversityDetails ? <p className="text-xs text-white/50 mb-2">Academic information not provided</p> : null}
            <p className="text-xs text-white/50 mb-2">
              Level: <span className="font-medium text-white">{level}</span>
            </p>

            {canViewSubjects && (isCurrentUser ? currentUserSubjects : user.selected_subjects ?? []).length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {(isCurrentUser ? currentUserSubjects : user.selected_subjects ?? []).map((subject) => (
                  <div
                    key={subject}
                    className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/90"
                  >
                    {subject}
                  </div>
                ))}
              </div>
            )}

            {!canViewSubjects && (
              <p className="mt-3 text-xs text-white/40 italic">Connect with this student to see their subjects.</p>
            )}
          </div>

          {/* Action Button */}
          {!isCurrentUser && (
            <button
              type="button"
              onClick={handleFollowClick}
              disabled={isPending}
              className={`mt-6 w-full rounded-full px-6 py-3 text-sm font-medium transition ${
                isFollowing
                  ? "border border-white/20 bg-white/5 text-white/80 hover:bg-white/10"
                  : isPending
                    ? "cursor-not-allowed border border-white/10 bg-white/10 text-white/45"
                    : "border border-white/20 bg-white text-black hover:bg-white/90"
              }`}
            >
              {isFollowing ? "Unfriend" : isPending ? "Request Sent" : "Send Request"}
            </button>
          )}
        </div>
      </div>

      {isAvatarPreviewOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm"
          onClick={() => setIsAvatarPreviewOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-white/10 bg-zinc-950/95 p-4 shadow-2xl shadow-black/50"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-white/40">Avatar preview</p>
                <h3 className="mt-2 text-lg font-semibold text-white">{user.full_name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAvatarPreviewOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
                aria-label="Close avatar preview"
              >
                <X size={16} />
              </button>
            </div>
            <div className="mt-5 flex justify-center">
              <div className="h-56 w-56 overflow-hidden rounded-full border border-white/10 bg-white/5 shadow-lg shadow-black/30 sm:h-64 sm:w-64">
                <img src={avatarOption.image} alt={user.full_name} className="h-full w-full object-cover" />
              </div>
            </div>
            <p className="mt-4 text-center text-sm text-white/50">Tap outside the image to close.</p>
          </div>
        </div>
      ) : null}

      {connectionView ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-sm">
          <div className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/95 shadow-2xl shadow-black/50">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5 sm:p-6">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-white/40">{activeConnectionLabel}</p>
                <h3 className="mt-2 text-xl font-semibold text-white">{user.full_name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setConnectionView(null)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
                aria-label="Close connections"
              >
                <X size={16} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
              {!canViewConnections ? (
                <div className="flex min-h-[280px] items-center justify-center rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
                  <div className="max-w-md">
                    <p className="text-xs uppercase tracking-[0.3em] text-white/40">Private profile</p>
                    <h4 className="mt-3 text-2xl font-semibold text-white">Connections are hidden</h4>
                    <p className="mt-3 text-sm leading-6 text-white/50">
                      You can only view this profile&apos;s followers and following list when it is public or when
                      you are friends.
                    </p>
                  </div>
                </div>
              ) : isConnectionLoading ? (
                <div className="flex min-h-[280px] items-center justify-center">
                  <div className="relative h-10 w-10">
                    <div className="absolute inset-0 rounded-full border border-white/10" />
                    <div className="absolute inset-0 rounded-full border-t border-white animate-spin" />
                  </div>
                </div>
              ) : connectionError ? (
                <div className="flex min-h-[280px] items-center justify-center rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
                  <p className="text-sm text-white/50">{connectionError}</p>
                </div>
              ) : connectionItems.length === 0 ? (
                <div className="flex min-h-[280px] items-center justify-center rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
                  <div>
                    <h4 className="text-2xl font-semibold text-white">
                      No {connectionView === "followers" ? "followers" : "following"} yet
                    </h4>
                    <p className="mt-3 text-sm text-white/50">
                      This list will appear here once people connect with this profile.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {connectionItems.map((item) => {
                    const avatar = getAvatarOption(item.avatar_id);
                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:bg-white/[0.06]"
                      >
                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/5">
                          <img src={avatar.image} alt={item.full_name} className="h-full w-full object-cover" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium text-white">{item.full_name}</p>
                            {!item.is_public ? (
                              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/55">
                                Private
                              </span>
                            ) : null}
                          </div>
                          <p className="truncate text-xs text-white/50">{item.username}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
