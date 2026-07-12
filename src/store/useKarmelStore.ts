import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { toast } from "sonner";
import { DEFAULT_AVATAR_ID, type AvatarId } from "@/lib/avatars";
import { supabase } from "@/lib/supabase";

export type Role = "student" | "teacher";
export type TimerMode = "study" | "break";

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
  role: Role;
  avatarId: AvatarId;
};

type ProfileRow = {
  id: string;
  username?: string | null;
  full_name?: string | null;
  role?: Role | null;
  avatar_id?: AvatarId | null;
  selected_subjects?: string[] | null;
  last_seen_at?: string | null;
  grade?: number | null;
  level?: number | null;
  xp?: number | null;
  is_public?: boolean | null;
  followers_count?: number | null;
  following_count?: number | null;
};

/** A row returned from the public.past_papers table. */
export type PastPaper = {
  id: string;
  grade: number;
  subject: string;
  title?: string | null;
  paper_title?: string | null;
  year?: number | null;
  session?: string | null;
  month?: string | null;
  paper_number?: number | null;
  file_path?: string | null;
  pdf_storage_path?: string | null;
  memo_storage_path?: string | null;
  [key: string]: unknown;
};

export type UserProfile = {
  id: string;
  username: string;
  full_name: string;
  avatar_id: AvatarId;
  selected_subjects?: string[];
  last_seen_at?: string | null;
  grade: number;
  level: number;
  xp: number;
  is_public: boolean;
  followers_count: number;
  following_count: number;
  is_following?: boolean;
  follow_status?: FollowStatus;
};

export type FollowStatus = "pending" | "accepted" | "declined";

export type SocialProfile = UserProfile & {
  follow_status: FollowStatus;
  followRowId?: string;
};

type State = {
  isAuthed: boolean;
  userId: string | null;
  user: { id: string; email: string | null } | null;
  studentName: string;
  email: string | null;
  grade: number;
  level: number;
  xp: number;
  subjects: string[];
  role: Role;
  avatarId: AvatarId;
  username: string;
  is_public: boolean;
  followers_count: number;
  following_count: number;
  onlineUserIds: string[];
  notifiedOnlineUserIds: string[];
  isTimerRunning: boolean;
  timerMode: TimerMode;
  studyDurationMinutes: number;
  breakDurationMinutes: number;
  studyTimeLeft: number;
  breakTimeLeft: number;
  totalSecondsFocused: number;
  lastLevelUpAt: number | null;
  users: User[];
  lastSubject: string | null;
  lastMode: string | null;
  activePaper: PastPaper | null;
  activeStudyMode: string | null;
  activities: Activity[];
  searchResults: UserProfile[];
  isSearching: boolean;
  pendingIncomingRequests: SocialProfile[];
  friendsList: SocialProfile[];
  signup: (email: string, password: string, grade: number, studentName?: string, subjects?: string[], role?: Role, avatarId?: AvatarId) => Promise<{ ok: boolean; error?: string }>;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  signUp: (email: string, password: string, grade: number, studentName?: string, subjects?: string[], role?: Role, avatarId?: AvatarId) => Promise<{ ok: boolean; error?: string }>;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
  setStudent: (name: string, grade: number) => void;
  setLevel: (level: number) => void;
  setXp: (xp: number) => void;
  setTimerMode: (mode: TimerMode) => void;
  setStudyDuration: (minutes: number) => void;
  setBreakDuration: (minutes: number) => void;
  startTimer: () => void;
  pauseTimer: () => void;
  resetTimer: () => void;
  tickTimer: () => void;
  completeStudySession: (durationSeconds: number) => Promise<void>;
  setAvatar: (avatarId: AvatarId) => void;
  setSubjects: (subjects: string[]) => void;
  setLast: (subject: string, mode: string) => void;
  setActivePaper: (paper: PastPaper | null) => void;
  setActiveStudyMode: (mode: string | null) => void;
  addActivity: (a: Activity) => void;
  searchUsers: (query: string) => Promise<void>;
  followUser: (targetId: string) => Promise<{ ok: boolean; error?: string }>;
  acceptFriendRequest: (senderId: string) => Promise<{ ok: boolean; error?: string }>;
  declineFriendRequest: (senderId: string) => Promise<{ ok: boolean; error?: string }>;
  unfollowUser: (targetId: string) => Promise<{ ok: boolean; error?: string }>;
  updatePrivacySettings: (isPublic: boolean) => Promise<{ ok: boolean; error?: string }>;
  refreshNetworkData: () => Promise<void>;
  setOnlineUserIds: (onlineUserIds: string[]) => void;
  setNotifiedOnlineUserIds: (notifiedOnlineUserIds: string[]) => void;
  claimOnlineNotifications: (friendIds: string[]) => string[];
  startPresenceTracking: (
    payload: { userId: string; username: string; fullName: string; avatarId: AvatarId },
  ) => Promise<() => Promise<void>>;
  stopPresenceTracking: () => Promise<void>;
};

const normalizeName = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "Student";
  const [first] = trimmed.split(/\s+/);
  return first.charAt(0).toUpperCase() + first.slice(1);
};

const normalizeUsername = (value: string) => {
  const trimmed = value.trim().replace(/^@+/, "");
  if (!trimmed) return "student";
  return trimmed.toLowerCase().replace(/\s+/g, "_");
};

const hydrateStateFromProfile = (
  set: (partial: Partial<State>) => void,
  profile: ProfileRow | null,
  fallback: { email?: string | null; userId?: string | null; user?: { id: string; email: string | null } | null } = {},
) => {
  const fullName = normalizeName(profile?.full_name ?? "");
  const selectedSubjects = Array.isArray(profile?.selected_subjects) ? profile.selected_subjects.filter(Boolean) : [];
  const userRole: Role = profile?.role === "teacher" ? "teacher" : "student";
  const selectedAvatarId = (profile?.avatar_id as AvatarId | undefined) ?? DEFAULT_AVATAR_ID;
  const grade = Number(profile?.grade ?? 10);
  const level = Number(profile?.level ?? 1);
  const xp = Number(profile?.xp ?? 0);
  const username = profile?.username?.trim() ? profile.username : `@${normalizeUsername(fullName)}`;
  const followersCount = Number(profile?.followers_count ?? 0);
  const followingCount = Number(profile?.following_count ?? 0);

  set({
    isAuthed: Boolean(fallback.userId),
    userId: fallback.userId ?? null,
    user: fallback.user ?? null,
    email: fallback.email ?? null,
    grade: Number.isFinite(grade) ? grade : 10,
    level: Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1,
    xp: Number.isFinite(xp) ? Math.max(0, Math.floor(xp)) : 0,
    studentName: fullName,
    subjects: selectedSubjects,
    role: userRole,
    avatarId: selectedAvatarId,
    username,
    is_public: profile?.is_public ?? true,
    followers_count: Number.isFinite(followersCount) ? followersCount : 0,
    following_count: Number.isFinite(followingCount) ? followingCount : 0,
  });
};


const syncProfileToSupabase = async (userId: string | null, updates: Record<string, unknown>) => {
  if (!userId) return;
  const { error } = await supabase.from("profiles").update(updates).eq("id", userId);
  if (error) {
    console.error("Supabase profile update failed", error);
  }
};

const DEFAULT_STUDY_DURATION_MINUTES = 25;
const DEFAULT_BREAK_DURATION_MINUTES = 15;
const XP_PER_FOCUS_MINUTE = 10;

const clampTimerSeconds = (seconds: number) => Math.max(0, Math.floor(seconds));

const getTimerDefaults = () => ({
  isTimerRunning: false,
  timerMode: "study" as TimerMode,
  studyDurationMinutes: DEFAULT_STUDY_DURATION_MINUTES,
  breakDurationMinutes: DEFAULT_BREAK_DURATION_MINUTES,
  studyTimeLeft: DEFAULT_STUDY_DURATION_MINUTES * 60,
  breakTimeLeft: DEFAULT_BREAK_DURATION_MINUTES * 60,
  totalSecondsFocused: 0,
  lastLevelUpAt: null as number | null,
});

const dedupeIds = (ids: string[]) => [...new Set(ids.filter(Boolean))];

const getPresenceState = (channel: RealtimeChannel) => {
  const state = channel.presenceState() as Record<string, unknown[]>;
  return Object.keys(state);
};

const applyXpProgression = (currentLevel: number, currentXp: number, xpGain: number) => {
  let nextLevel = Math.max(1, Math.floor(currentLevel));
  let nextXp = Math.max(0, Math.floor(currentXp + xpGain));
  let leveledUp = false;

  while (nextXp >= nextLevel * 100) {
    nextXp -= nextLevel * 100;
    nextLevel += 1;
    leveledUp = true;
  }

  return {
    level: nextLevel,
    xp: nextXp,
    leveledUp,
  };
};


const PROFILE_SELECT = "id, username, full_name, avatar_id, role, selected_subjects, grade, level, xp, is_public, followers_count, following_count";
const PROFILE_WITH_PRESENCE_SELECT = `${PROFILE_SELECT}, last_seen_at`;

const loadLiveProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_WITH_PRESENCE_SELECT)
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as ProfileRow | null;
};

const FOLLOW_SELECT = "follower_id, following_id, status, created_at";

type FollowRow = {
  follower_id: string;
  following_id: string;
  status: FollowStatus;
  created_at?: string | null;
};

const getFollowRowKey = (row: Pick<FollowRow, "follower_id" | "following_id">) =>
  `${row.follower_id}-${row.following_id}`;

let presenceChannel: RealtimeChannel | null = null;
let presenceChannelUserId: string | null = null;
let presenceCleanup: (() => Promise<void>) | null = null;
let presenceLifecycleToken = 0;
let presenceStartQueue: Promise<void> = Promise.resolve();

const queuePresenceTask = async <T>(task: () => Promise<T>) => {
  const run = presenceStartQueue.then(task, task);
  presenceStartQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
};

const fetchProfilesByIds = async (ids: string[]) => {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map<string, ProfileRow>();

  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_WITH_PRESENCE_SELECT)
    .in("id", uniqueIds);

  if (error) {
    throw error;
  }

  return new Map<string, ProfileRow>((data ?? []).map((profile) => [profile.id, profile as ProfileRow]));
};

const toSocialProfile = (profile: ProfileRow, followStatus: FollowStatus, followRowId?: string): SocialProfile => ({
  id: profile.id,
  username: profile.username?.trim() ? profile.username : `@${normalizeUsername(profile.full_name ?? "")}`,
  full_name: normalizeName(profile.full_name ?? ""),
  avatar_id: (profile.avatar_id as AvatarId | undefined) ?? DEFAULT_AVATAR_ID,
  selected_subjects: Array.isArray(profile.selected_subjects) ? profile.selected_subjects.filter(Boolean) : undefined,
  last_seen_at: profile.last_seen_at ?? null,
  grade: Number(profile.grade ?? 10),
  level: Number(profile.level ?? 1) || 1,
  xp: Number(profile.xp ?? 0) || 0,
  is_public: Boolean(profile.is_public),
  followers_count: Number(profile.followers_count ?? 0) || 0,
  following_count: Number(profile.following_count ?? 0) || 0,
  follow_status: followStatus,
  followRowId,
});

const loadNetworkData = async (userId: string) => {
  try {
    const { data: followRows, error } = await supabase
      .from("follows")
      .select(FOLLOW_SELECT)
      .eq("following_id", userId)
      .eq("status", "pending");

    if (error) {
      throw error;
    }

    const pendingRows = followRows as FollowRow[];

    const senderIds = [...new Set(pendingRows.map((row) => row.follower_id).filter(Boolean))];
    let profileRows: ProfileRow[] = [];

    if (senderIds.length > 0) {
      const { data: senderProfiles, error: profileError } = await supabase
        .from("profiles")
        .select(PROFILE_SELECT)
        .in("id", senderIds);

      if (profileError) {
        throw profileError;
      }

      profileRows = (senderProfiles ?? []) as ProfileRow[];
    }

    const [outgoingAcceptedResult, incomingAcceptedResult] = await Promise.all([
      supabase
        .from("follows")
        .select(FOLLOW_SELECT)
        .eq("follower_id", userId)
        .eq("status", "accepted"),
      supabase
        .from("follows")
        .select(FOLLOW_SELECT)
        .eq("following_id", userId)
        .eq("status", "accepted"),
    ]);

    if (outgoingAcceptedResult.error) throw outgoingAcceptedResult.error;
    if (incomingAcceptedResult.error) throw incomingAcceptedResult.error;

    const acceptedRows = [
      ...((outgoingAcceptedResult.data ?? []) as FollowRow[]),
      ...((incomingAcceptedResult.data ?? []) as FollowRow[]),
    ];

    const acceptedProfiles = await fetchProfilesByIds(
      acceptedRows.map((row) => (row.follower_id === userId ? row.following_id : row.follower_id)),
    );
    const profileMap = new Map(profileRows.map((profile) => [profile.id, profile]));

    const pendingIncomingRequests = pendingRows
      .map((row) => {
        const profile = profileMap.get(row.follower_id) ?? null;
        return profile ? toSocialProfile(profile, row.status, getFollowRowKey(row)) : null;
      })
      .filter(Boolean) as SocialProfile[];

    const processedFriends = acceptedRows
      .map((row) => {
        const otherId = row.follower_id === userId ? row.following_id : row.follower_id;
        const profile = acceptedProfiles.get(otherId);
        return profile ? toSocialProfile(profile, row.status, getFollowRowKey(row)) : null;
      })
      .filter(Boolean) as SocialProfile[];

    const uniqueFriends = Array.from(new Map(processedFriends.map((friend) => [friend.id, friend])).values());

    return {
      pendingIncomingRequests,
      friendsList: uniqueFriends,
    };
  } catch (error) {
    console.error("loadNetworkData failed", error);
    throw error;
  }
};

const syncPresenceLists = (set: (partial: Partial<State> | ((state: State) => Partial<State>)) => void, onlineUserIds: string[]) => {
  const uniqueOnlineUserIds = dedupeIds(onlineUserIds);
  set((state) => ({
    onlineUserIds: uniqueOnlineUserIds,
    notifiedOnlineUserIds: state.notifiedOnlineUserIds.filter((id) => uniqueOnlineUserIds.includes(id)),
  }));
};

const stopPresenceTracking = async () => {
  presenceLifecycleToken += 1;

  const cleanup = presenceCleanup;
  presenceCleanup = null;

  if (cleanup) {
    await cleanup();
    return;
  }

  if (presenceChannel) {
    try {
      await supabase.removeChannel(presenceChannel);
    } catch (error) {
      console.error("removeChannel failed", error);
    }
  }

  presenceChannel = null;
  presenceChannelUserId = null;
  useKarmelStore.setState({ onlineUserIds: [] });
};

const startPresenceTracking = async (
  set: (partial: Partial<State>) => void,
  payload: { userId: string; username: string; fullName: string; avatarId: AvatarId },
): Promise<() => Promise<void>> => {
  if (!payload.userId) return async () => {};

  return queuePresenceTask(async () => {
    await stopPresenceTracking();

    const existingChannels = supabase.getChannels();
    const staleChannels = existingChannels.filter(
      (channel) => channel.topic === "realtime:online-users" || channel.topic.endsWith(":online-users"),
    );

    await Promise.all(
      staleChannels.map(async (channel) => {
        try {
          await supabase.removeChannel(channel);
        } catch (error) {
          console.error("removeChannel failed", error);
        }
      }),
    );

    const channel = supabase.channel("online-users", {
      config: {
        presence: {
          key: payload.userId,
        },
      },
    });

    presenceChannel = channel;
    presenceChannelUserId = payload.userId;
    const lifecycleToken = ++presenceLifecycleToken;

    const syncOnlineUsers = () => {
      syncPresenceLists(set, getPresenceState(channel));
    };

    channel.on("presence", { event: "sync" }, syncOnlineUsers);
    channel.on("presence", { event: "join" }, syncOnlineUsers);
    channel.on("presence", { event: "leave" }, syncOnlineUsers);

    channel.subscribe(async (status) => {
      if (lifecycleToken !== presenceLifecycleToken) {
        return;
      }

      if (status === "SUBSCRIBED") {
        await channel.track({
          user_id: payload.userId,
          username: payload.username,
          full_name: payload.fullName,
          avatar_id: payload.avatarId,
          active_at: new Date().toISOString(),
        });
        syncOnlineUsers();
      }
    });

    const cleanup = async () => {
      if (presenceChannel === channel) {
        presenceChannel = null;
        presenceChannelUserId = null;
        presenceCleanup = null;
        useKarmelStore.setState({ onlineUserIds: [] });
      }

      try {
        await channel.untrack();
      } catch (error) {
        console.error("presence untrack failed", error);
      }

      try {
        await supabase.removeChannel(channel);
      } catch (error) {
        console.error("removeChannel failed", error);
      }
    };

    presenceCleanup = cleanup;
    return cleanup;
  });
};

const getLoggedOutState = () => ({
  isAuthed: false,
  userId: null as string | null,
  user: null as { id: string; email: string | null } | null,
  studentName: "Student",
  email: null as string | null,
  grade: 10,
  level: 1,
  xp: 0,
  ...getTimerDefaults(),
  subjects: [] as string[],
  role: "student" as Role,
  avatarId: DEFAULT_AVATAR_ID,
  username: "",
  is_public: true,
  followers_count: 0,
  following_count: 0,
  onlineUserIds: [] as string[],
  notifiedOnlineUserIds: [] as string[],
  users: [] as User[],
  lastSubject: null as string | null,
  lastMode: null as string | null,
  activePaper: null as PastPaper | null,
  activeStudyMode: null as string | null,
  activities: [] as Activity[],
  searchResults: [] as UserProfile[],
  isSearching: false,
  pendingIncomingRequests: [] as SocialProfile[],
  friendsList: [] as SocialProfile[],
});

export const useKarmelStore = create<State>()(
  persist(
    (set, get) => ({
      isAuthed: false,
      userId: null,
      user: null,
      studentName: "Student",
      email: null,
      grade: 10,
      level: 1,
      xp: 0,
      ...getTimerDefaults(),
      subjects: [],
      role: "student",
      avatarId: DEFAULT_AVATAR_ID,
      username: "",
      is_public: true,
      followers_count: 0,
      following_count: 0,
      onlineUserIds: [],
      notifiedOnlineUserIds: [],
      users: [],
      lastSubject: null,
      lastMode: null,
      activePaper: null,
      activeStudyMode: null,
      activities: [],
      searchResults: [],
      isSearching: false,
      pendingIncomingRequests: [],
      friendsList: [],
      signup: async (email, password, grade, studentName, subjects, role, avatarId) => {
        const e = email.trim().toLowerCase();
        const name = normalizeName(studentName ?? "");
        const selectedSubjects = (subjects ?? []).filter(Boolean);
        const userRole: Role = role ?? "student";
        const selectedAvatarId = avatarId ?? DEFAULT_AVATAR_ID;

        const { data, error } = await supabase.auth.signUp({
          email: e,
          password,
          options: {
            data: {
              full_name: name,
              role: userRole,
              avatar_id: selectedAvatarId,
              selected_subjects: selectedSubjects,
              grade,
            },
          },
        });

        if (error || !data.user) {
          return { ok: false, error: error?.message ?? "Could not create your account." };
        }

        const liveProfile = await loadLiveProfile(data.user.id).catch(() => null);
        const fallbackProfile: ProfileRow = {
          id: data.user.id,
          username: `@${normalizeUsername(name)}`,
          full_name: name,
          role: userRole,
          avatar_id: selectedAvatarId,
          selected_subjects: selectedSubjects,
          grade,
          level: 1,
          xp: 0,
          is_public: true,
          followers_count: 0,
          following_count: 0,
        };

        hydrateStateFromProfile(set, liveProfile ?? fallbackProfile, { email: e, userId: data.user.id });
        set({ user: { id: data.user.id, email: data.user.email ?? e } });
        const networkData = await loadNetworkData(data.user.id).catch(() => ({
          pendingIncomingRequests: [],
          friendsList: [],
        }));
        set(networkData);
        set((s) => ({
          users: s.users.some((user) => user.email === e)
            ? s.users
            : [...s.users, { email: e, password, grade, studentName: name, subjects: selectedSubjects, role: userRole, avatarId: selectedAvatarId }],
        }));

        return { ok: true };
      },
      login: async (email, password) => {
        const e = email.trim().toLowerCase();
        const { data, error } = await supabase.auth.signInWithPassword({ email: e, password });
        if (error || !data.user) {
          return { ok: false, error: error?.message ?? "Invalid email or password." };
        }

        const profile = await loadLiveProfile(data.user.id).catch(() => null);
        const metadata = (data.user.user_metadata ?? {}) as Record<string, unknown>;
        const fallbackProfile: ProfileRow = {
          id: data.user.id,
          username: typeof metadata.username === "string" ? metadata.username : undefined,
          full_name: typeof metadata.full_name === "string" ? metadata.full_name : "Student",
          role: metadata.role === "teacher" ? "teacher" : "student",
          avatar_id: (metadata.avatar_id as AvatarId | undefined) ?? DEFAULT_AVATAR_ID,
          selected_subjects: Array.isArray(metadata.selected_subjects) ? (metadata.selected_subjects as string[]) : [],
          grade: Number(metadata.grade ?? 10),
          level: Number(metadata.level ?? 1),
          xp: Number(metadata.xp ?? 0),
          is_public: typeof metadata.is_public === "boolean" ? metadata.is_public : true,
          followers_count: Number(metadata.followers_count ?? 0),
          following_count: Number(metadata.following_count ?? 0),
        };

        hydrateStateFromProfile(set, profile ?? fallbackProfile, { email: e, userId: data.user.id });
        set({ user: { id: data.user.id, email: data.user.email ?? e } });
        const networkData = await loadNetworkData(data.user.id).catch(() => ({
          pendingIncomingRequests: [],
          friendsList: [],
        }));
        set(networkData);
        set((s) => ({
          users: s.users.some((user) => user.email === e)
            ? s.users
            : [
                ...s.users,
                {
                  email: e,
                  password,
                  grade: Number.isFinite(profile?.grade ?? fallbackProfile.grade ?? 10) ? Number(profile?.grade ?? fallbackProfile.grade ?? 10) : 10,
                  studentName: normalizeName(profile?.full_name ?? fallbackProfile.full_name ?? "Student"),
                  subjects: Array.isArray(profile?.selected_subjects) ? profile.selected_subjects.filter(Boolean) : fallbackProfile.selected_subjects ?? [],
                  role: profile?.role === "teacher" || fallbackProfile.role === "teacher" ? "teacher" : "student",
                  avatarId: (profile?.avatar_id as AvatarId | undefined) ?? fallbackProfile.avatar_id ?? DEFAULT_AVATAR_ID,
                },
              ],
        }));

        return { ok: true };
      },
      logout: async () => {
        await stopPresenceTracking();
        await supabase.auth.signOut();
        set({
          pendingIncomingRequests: [],
          friendsList: [],
          user: null,
          isAuthed: false,
          userId: null,
          email: null,
          onlineUserIds: [],
          notifiedOnlineUserIds: [],
          ...getTimerDefaults(),
        });
        void useKarmelStore.persist.clearStorage();
        window.location.reload();
      },
      signUp: async (email, password, grade, studentName, subjects, role, avatarId) => get().signup(email, password, grade, studentName, subjects, role, avatarId),
      signIn: async (email, password) => get().login(email, password),
      signOut: async () => get().logout(),
      refreshNetworkData: async () => {
        const currentUserId = get().userId;
        if (!currentUserId) {
          set({ pendingIncomingRequests: [], friendsList: [] });
          return;
        }

        try {
          const networkData = await loadNetworkData(currentUserId);
          set(networkData);
        } catch (error) {
          console.error("refreshNetworkData failed", error);
        }
      },
      setOnlineUserIds: (onlineUserIds) => {
        set({ onlineUserIds: dedupeIds(onlineUserIds) });
      },
      setNotifiedOnlineUserIds: (notifiedOnlineUserIds) => {
        set((state) => ({
          notifiedOnlineUserIds: dedupeIds([...state.notifiedOnlineUserIds, ...notifiedOnlineUserIds]),
        }));
      },
      claimOnlineNotifications: (friendIds) => {
        const currentState = get();
        const notifiedIds = new Set(currentState.notifiedOnlineUserIds);
        const claimedIds = dedupeIds(friendIds).filter((id) => !notifiedIds.has(id));

        if (claimedIds.length > 0) {
          set({
            notifiedOnlineUserIds: dedupeIds([...currentState.notifiedOnlineUserIds, ...claimedIds]),
          });
        }

        return claimedIds;
      },
      startPresenceTracking: async ({ userId, username, fullName, avatarId }) => {
        return startPresenceTracking(set, { userId, username, fullName, avatarId });
      },
      stopPresenceTracking: async () => {
        await stopPresenceTracking();
      },
      setStudent: (studentName, grade) => {
        const currentState = get();
        const nextName = normalizeName(studentName || "");
        set((s) => ({
          studentName: nextName,
          grade,
          users: s.email
            ? s.users.map((user) => (user.email === s.email ? { ...user, studentName: nextName, grade } : user))
            : s.users,
        }));
        void syncProfileToSupabase(currentState.userId, { full_name: nextName, grade });
      },
      setLevel: (level) => {
        set({ level: Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1 });
      },
      setXp: (xp) => {
        set({ xp: Number.isFinite(xp) ? Math.max(0, Math.floor(xp)) : 0 });
      },
      setTimerMode: (mode) => {
        set({ timerMode: mode });
      },
      setStudyDuration: (minutes) => {
        const nextMinutes = Math.max(1, Math.floor(minutes) || DEFAULT_STUDY_DURATION_MINUTES);
        set((state) => ({
          studyDurationMinutes: nextMinutes,
          studyTimeLeft:
            state.timerMode === "study" && !state.isTimerRunning
              ? nextMinutes * 60
              : state.studyTimeLeft,
        }));
      },
      setBreakDuration: (minutes) => {
        const nextMinutes = Math.max(1, Math.floor(minutes) || DEFAULT_BREAK_DURATION_MINUTES);
        set((state) => ({
          breakDurationMinutes: nextMinutes,
          breakTimeLeft:
            state.timerMode === "break" && !state.isTimerRunning
              ? nextMinutes * 60
              : state.breakTimeLeft,
        }));
      },
      startTimer: () => {
        const currentState = get();
        const isStudyMode = currentState.timerMode === "study";
        const currentTimeLeft = isStudyMode ? currentState.studyTimeLeft : currentState.breakTimeLeft;

        if (currentTimeLeft <= 0) {
          set({
            isTimerRunning: false,
            studyTimeLeft: isStudyMode ? currentState.studyDurationMinutes * 60 : currentState.studyTimeLeft,
            breakTimeLeft: !isStudyMode ? currentState.breakDurationMinutes * 60 : currentState.breakTimeLeft,
          });
          return;
        }

        set({ isTimerRunning: true });
      },
      pauseTimer: () => {
        set({ isTimerRunning: false });
      },
      resetTimer: () => {
        const currentState = get();
        set({
          isTimerRunning: false,
          studyTimeLeft: currentState.studyDurationMinutes * 60,
          breakTimeLeft: currentState.breakDurationMinutes * 60,
          totalSecondsFocused: 0,
        });
      },
      tickTimer: () => {
        const currentState = get();
        if (!currentState.isTimerRunning) return;

        if (currentState.timerMode === "study") {
          const nextTimeLeft = clampTimerSeconds(currentState.studyTimeLeft - 1);
          const nextFocusedSeconds = currentState.totalSecondsFocused + 1;

          if (nextTimeLeft <= 0) {
            set({
              isTimerRunning: false,
              timerMode: "break",
              studyTimeLeft: 0,
              breakTimeLeft: currentState.breakDurationMinutes * 60,
              totalSecondsFocused: nextFocusedSeconds,
            });
            toast("Focus block completed! Time for a break.", { duration: 10000 });
            void get().completeStudySession(nextFocusedSeconds);
            return;
          }

          set({
            studyTimeLeft: nextTimeLeft,
            totalSecondsFocused: nextFocusedSeconds,
          });
          return;
        }

        const nextTimeLeft = clampTimerSeconds(currentState.breakTimeLeft - 1);
        if (nextTimeLeft <= 0) {
          set({
            isTimerRunning: false,
            breakTimeLeft: 0,
            studyTimeLeft: currentState.studyDurationMinutes * 60,
            timerMode: "study",
          });
          toast("Break over! Time to focus.", { duration: 10000 });
          return;
        }

        set({ breakTimeLeft: nextTimeLeft });
      },
      completeStudySession: async (durationSeconds) => {
        const currentState = get();
        const currentUserId = currentState.userId;
        const focusedSeconds = Math.max(0, Math.floor(durationSeconds));
        const durationMinutes = Math.max(1, Math.round(focusedSeconds / 60));
        const xpGain = Math.max(XP_PER_FOCUS_MINUTE, durationMinutes * XP_PER_FOCUS_MINUTE);
        const progression = applyXpProgression(currentState.level, currentState.xp, xpGain);
        const finishedAt = new Date().toISOString();

        set({
          level: progression.level,
          xp: progression.xp,
          totalSecondsFocused: currentState.totalSecondsFocused,
          lastLevelUpAt: progression.leveledUp ? Date.now() : currentState.lastLevelUpAt,
          studyTimeLeft: currentState.studyDurationMinutes * 60,
          breakTimeLeft: currentState.breakDurationMinutes * 60,
          isTimerRunning: false,
          timerMode: "break",
        });

        if (!currentUserId) {
          return;
        }

        const sessionInsert = supabase.from("study_sessions").insert({
          user_id: currentUserId,
          duration_minutes: durationMinutes,
          session_type: "study",
          created_at: finishedAt,
        });

        const profileUpdate = syncProfileToSupabase(currentUserId, {
          xp: progression.xp,
          level: progression.level,
        });

        const [profileResult, sessionResult] = await Promise.allSettled([profileUpdate, sessionInsert]);

        if (profileResult.status === "rejected") {
          console.error("profile update failed", profileResult.reason);
        }
        if (sessionResult.status === "rejected") {
          console.error("study_sessions insert failed", sessionResult.reason);
        }
      },
      setAvatar: (avatarId) => {
        const currentState = get();
        set((s) => ({
          avatarId,
          users: s.email
            ? s.users.map((user) => (user.email === s.email ? { ...user, avatarId } : user))
            : s.users,
        }));
        void syncProfileToSupabase(currentState.userId, { avatar_id: avatarId });
      },
      setSubjects: (subjects) => {
        const currentState = get();
        const nextSubjects = subjects.filter(Boolean);
        set((s) => ({
          subjects: nextSubjects,
          users: s.email
            ? s.users.map((user) => (user.email === s.email ? { ...user, subjects: nextSubjects } : user))
            : s.users,
        }));
        void syncProfileToSupabase(currentState.userId, { selected_subjects: nextSubjects });
      },
      setLast: (lastSubject, lastMode) => set({ lastSubject, lastMode }),
      setActivePaper: (activePaper) => set({ activePaper }),
      setActiveStudyMode: (activeStudyMode) => set({ activeStudyMode }),
      addActivity: (a) =>
        set((s) => ({ activities: [a, ...s.activities].slice(0, 20) })),
      searchUsers: async (query) => {
        const searchTerm = query.trim();
        if (!searchTerm) {
          set({ searchResults: [], isSearching: false });
          return;
        }

        set({ isSearching: true });
        try {
          const currentUserId = get().userId;
          const safeTerm = searchTerm.replace(/%/g, "\\%").replace(/,/g, "\\,");
          const normalizedUsername = normalizeUsername(searchTerm);

          const [publicResult, privateResult, relationshipResult] = await Promise.all([
            supabase
              .from("profiles")
              .select(PROFILE_WITH_PRESENCE_SELECT)
              .eq("is_public", true)
              .or(`username.ilike.%${safeTerm}%,full_name.ilike.%${safeTerm}%`)
              .order("followers_count", { ascending: false })
              .limit(20),
            normalizedUsername
              ? supabase
                  .from("profiles")
                  .select(PROFILE_WITH_PRESENCE_SELECT)
                  .eq("is_public", false)
                  .or(`username.ilike.${normalizedUsername},username.ilike.@${normalizedUsername}`)
                  .limit(20)
              : Promise.resolve({ data: [], error: null as null }),
            currentUserId
              ? supabase
                  .from("follows")
                  .select("following_id, status")
                  .eq("follower_id", currentUserId)
              : Promise.resolve({ data: [], error: null as null }),
          ]);

          if (publicResult.error) throw publicResult.error;
          if (privateResult.error) throw privateResult.error;
          if (relationshipResult.error) throw relationshipResult.error;

          const profiles = [
            ...((publicResult.data ?? []) as ProfileRow[]),
            ...((privateResult.data ?? []) as ProfileRow[]),
          ];
          const uniqueProfiles = Array.from(new Map(profiles.map((profile) => [profile.id, profile])).values());
          const resultIds = uniqueProfiles.map((profile) => profile.id);

          let relationshipMap = new Map<string, FollowStatus>();
          if (currentUserId && resultIds.length > 0) {
            const relationRows = (relationshipResult.data ?? []) as Array<{ following_id: string; status: FollowStatus }>;
            const filteredRelations = relationRows.filter((row) => resultIds.includes(row.following_id));
            relationshipMap = new Map(filteredRelations.map((row) => [row.following_id, row.status]));
          }

          set({
            searchResults: uniqueProfiles.map((profile) => {
              const followStatus = relationshipMap.get(profile.id);
              return {
                id: profile.id,
                username: profile.username?.trim() ? profile.username : `@${normalizeUsername(profile.full_name ?? "")}`,
                full_name: normalizeName(profile.full_name ?? ""),
                avatar_id: (profile.avatar_id as AvatarId | undefined) ?? DEFAULT_AVATAR_ID,
                selected_subjects: Array.isArray(profile.selected_subjects) ? profile.selected_subjects.filter(Boolean) : undefined,
                last_seen_at: profile.last_seen_at ?? null,
                grade: Number(profile.grade ?? 10),
                level: Number(profile.level ?? 1) || 1,
                xp: Number(profile.xp ?? 0) || 0,
                is_public: Boolean(profile.is_public),
                followers_count: Number(profile.followers_count ?? 0) || 0,
                following_count: Number(profile.following_count ?? 0) || 0,
                follow_status: followStatus,
                is_following: followStatus === "accepted",
              };
            }),
          });
        } catch (error) {
          console.error("searchUsers failed", error);
          set({ searchResults: [] });
        } finally {
          set({ isSearching: false });
        }
      },
      followUser: async (targetId) => {
        try {
          const currentUserId = get().userId;
          if (!currentUserId) {
            return { ok: false, error: "You need to be logged in to follow users." };
          }

          const { error } = await supabase.from("follows").upsert({
            follower_id: currentUserId,
            following_id: targetId,
            status: "pending",
          }, {
            onConflict: "follower_id,following_id",
          });

          if (error) {
            throw error;
          }

          set((state) => ({
            searchResults: state.searchResults.map((user) =>
              user.id === targetId
                ? {
                    ...user,
                    follow_status: "pending",
                    is_following: false,
                    followers_count: user.followers_count,
                  }
                : user,
            ),
          }));

          await get().refreshNetworkData();

          return { ok: true };
        } catch (error) {
          console.error("followUser failed", error);
          return { ok: false, error: error instanceof Error ? error.message : "Failed to follow user" };
        }
      },
      acceptFriendRequest: async (senderId) => {
        try {
          const currentUserId = get().userId;
          if (!currentUserId) {
            return { ok: false, error: "You need to be logged in to accept requests." };
          }

          const { error } = await supabase
            .from("follows")
            .update({ status: "accepted" })
            .eq("follower_id", senderId)
            .eq("following_id", currentUserId)
            .eq("status", "pending");

          if (error) {
            throw error;
          }

          await get().refreshNetworkData();
          return { ok: true };
        } catch (error) {
          console.error("acceptFriendRequest failed", error);
          return { ok: false, error: error instanceof Error ? error.message : "Failed to accept request" };
        }
      },
      declineFriendRequest: async (senderId) => {
        try {
          const currentUserId = get().userId;
          if (!currentUserId) {
            return { ok: false, error: "You need to be logged in to decline requests." };
          }

          const { error } = await supabase
            .from("follows")
            .delete()
            .eq("follower_id", senderId)
            .eq("following_id", currentUserId)
            .eq("status", "pending");

          if (error) {
            throw error;
          }

          await get().refreshNetworkData();
          return { ok: true };
        } catch (error) {
          console.error("declineFriendRequest failed", error);
          return { ok: false, error: error instanceof Error ? error.message : "Failed to decline request" };
        }
      },
      unfollowUser: async (targetId) => {
        try {
          const currentUserId = get().userId;
          if (!currentUserId) {
            return { ok: false, error: "You need to be logged in to unfollow users." };
          }

          const { error } = await supabase
            .from("follows")
            .delete()
            .eq("follower_id", currentUserId)
            .eq("following_id", targetId)
            .eq("status", "accepted");

          if (error) {
            throw error;
          }

          set((state) => ({
            following_count: Math.max(0, state.following_count - 1),
            searchResults: state.searchResults.map((user) =>
              user.id === targetId ? { ...user, follow_status: undefined, is_following: false } : user,
            ),
          }));

          await get().refreshNetworkData();

          return { ok: true };
        } catch (error) {
          console.error("unfollowUser failed", error);
          return { ok: false, error: error instanceof Error ? error.message : "Failed to unfollow user" };
        }
      },
      updatePrivacySettings: async (isPublic) => {
        try {
          const currentState = get();
          if (!currentState.userId) {
            return { ok: false, error: "You need to be logged in to update privacy settings." };
          }

          const { error } = await supabase
            .from("profiles")
            .update({ is_public: isPublic })
            .eq("id", currentState.userId);

          if (error) {
            throw error;
          }

          const liveProfile = await loadLiveProfile(currentState.userId).catch(() => null);
          if (liveProfile) {
            hydrateStateFromProfile(set, liveProfile, {
              email: currentState.email,
              userId: currentState.userId,
            });
          } else {
            set({ is_public: isPublic });
          }

          return { ok: true };
        } catch (error) {
          console.error("updatePrivacySettings failed", error);
          return { ok: false, error: error instanceof Error ? error.message : "Failed to update privacy settings" };
        }
      },
    }),
    {
      name: "karmel-store",
      partialize: (state) => ({
        isAuthed: state.isAuthed,
        userId: state.userId,
        studentName: state.studentName,
        email: state.email,
        grade: state.grade,
        level: state.level,
        xp: state.xp,
        isTimerRunning: state.isTimerRunning,
        timerMode: state.timerMode,
        studyDurationMinutes: state.studyDurationMinutes,
        breakDurationMinutes: state.breakDurationMinutes,
        studyTimeLeft: state.studyTimeLeft,
        breakTimeLeft: state.breakTimeLeft,
        totalSecondsFocused: state.totalSecondsFocused,
        subjects: state.subjects,
        role: state.role,
        avatarId: state.avatarId,
        username: state.username,
        is_public: state.is_public,
        followers_count: state.followers_count,
        following_count: state.following_count,
        lastSubject: state.lastSubject,
        lastMode: state.lastMode,
        activePaper: state.activePaper,
        activeStudyMode: state.activeStudyMode,
        activities: state.activities,
        users: state.users,
        user: state.user,
      }),
    },
  ),
);

void (async () => {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (session?.user) {
    const profileData = await loadLiveProfile(session.user.id).catch(() => null);
    hydrateStateFromProfile(useKarmelStore.setState, profileData, {
      email: session.user.email,
      userId: session.user.id,
      user: { id: session.user.id, email: session.user.email ?? null },
    });
    const networkData = await loadNetworkData(session.user.id).catch(() => ({
      pendingIncomingRequests: [],
      friendsList: [],
    }));
    useKarmelStore.setState(networkData);
  }
})();

supabase.auth.onAuthStateChange((_event, session) => {
  if (session?.user) {
    void (async () => {
      const profileData = await loadLiveProfile(session.user.id).catch(() => null);
      hydrateStateFromProfile(useKarmelStore.setState, profileData, {
        email: session.user.email,
        userId: session.user.id,
        user: { id: session.user.id, email: session.user.email ?? null },
      });
      const networkData = await loadNetworkData(session.user.id).catch(() => ({
        pendingIncomingRequests: [],
        friendsList: [],
      }));
      useKarmelStore.setState(networkData);
    })();
      } else {
        void stopPresenceTracking();
        useKarmelStore.setState({
          isAuthed: false,
          userId: null,
          user: null,
          email: null,
          onlineUserIds: [],
          notifiedOnlineUserIds: [],
          ...getTimerDefaults(),
          username: "",
          is_public: true,
      followers_count: 0,
      following_count: 0,
      level: 1,
      xp: 0,
      pendingIncomingRequests: [],
      friendsList: [],
    });
  }
});

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
