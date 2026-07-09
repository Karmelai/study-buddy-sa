import { X, Settings } from "lucide-react";
import { useKarmelStore, type UserProfile } from "@/store/useKarmelStore";
import { getAvatarOption } from "@/lib/avatars";

interface ProfileViewProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  isCurrentUser: boolean;
  onSettingsClick: () => void;
  onFollowChange?: (userId: string, isFollowing: boolean) => void;
}

const ONLINE_WINDOW_MS = 20 * 60 * 1000;

const isRecentlySeen = (lastSeenAt?: string | null) => {
  if (!lastSeenAt) return false;
  const timestamp = Date.parse(lastSeenAt);
  if (Number.isNaN(timestamp)) return false;
  return Date.now() - timestamp < ONLINE_WINDOW_MS;
};

export default function ProfileView({
  isOpen,
  onClose,
  user,
  isCurrentUser,
  onSettingsClick,
  onFollowChange,
}: ProfileViewProps) {
  const currentUserSubjects = useKarmelStore((s) => s.subjects);
  const currentUserLevel = useKarmelStore((s) => s.level);
  const following_count = useKarmelStore((s) => s.following_count);
  const followUser = useKarmelStore((s) => s.followUser);
  const unfollowUser = useKarmelStore((s) => s.unfollowUser);

  if (!isOpen || !user) return null;

  const avatarOption = getAvatarOption(user.avatar_id);
  const requestStatus = (user as UserProfile & { follow_status?: "pending" | "accepted" | "declined" }).follow_status;
  const isFollowing = requestStatus === "accepted";
  const isPending = requestStatus === "pending";
  const level = isCurrentUser ? currentUserLevel : user.level ?? 1;
  const canViewSubjects = isCurrentUser || isFollowing;
  const isOnline = isRecentlySeen(user.last_seen_at);

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
          <div className="flex flex-col items-center gap-4">
            <div
              className={`h-20 w-20 overflow-hidden rounded-full bg-white/5 ${
                isOnline ? "ring-2 ring-green-500 ring-offset-2 ring-offset-slate-900" : "border border-white/10"
              }`}
            >
              <img
                src={avatarOption.image}
                alt={user.full_name}
                className="h-full w-full object-cover"
              />
            </div>

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
              <p className="text-sm text-white/50">@{user.username}</p>
            </div>
          </div>

          {/* Stats Row */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="flex flex-col items-center gap-1 rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
              <p className="text-lg font-semibold text-white">{user.followers_count}</p>
              <p className="text-xs uppercase tracking-[0.2em] text-white/45">Followers</p>
            </div>
            <div className="flex flex-col items-center gap-1 rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
              <p className="text-lg font-semibold text-white">
                {isCurrentUser ? following_count : (user as UserProfile & { following_count?: number }).following_count ?? 0}
              </p>
              <p className="text-xs uppercase tracking-[0.2em] text-white/45">Following</p>
            </div>
            <div className="flex flex-col items-center gap-1 rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
              <p className="text-lg font-semibold text-white">{user.grade}</p>
              <p className="text-xs uppercase tracking-[0.2em] text-white/45">Grade</p>
            </div>
            <div className="flex flex-col items-center gap-1 rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
              <p className="text-lg font-semibold text-white">{level}</p>
              <p className="text-xs uppercase tracking-[0.2em] text-white/45">Level</p>
            </div>
          </div>

          {/* Grade and Subjects Section */}
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm font-medium text-white/80 mb-3">Academic Profile</p>
            <p className="text-xs text-white/50 mb-2">
              Grade: <span className="font-medium text-white">{user.grade}</span>
            </p>
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
    </div>
  );
}
