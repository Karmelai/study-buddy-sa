import { useState, type FormEvent } from "react";
import { Search, X, UserPlus, UserCheck } from "lucide-react";
import { useKarmelStore, type UserProfile } from "@/store/useKarmelStore";
import { getAvatarOption } from "@/lib/avatars";
import ProfileView from "./ProfileView";

interface FriendsDiscoveryProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FriendsDiscovery({ isOpen, onClose }: FriendsDiscoveryProps) {
  const [query, setQuery] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [isProfilePageOpen, setIsProfilePageOpen] = useState(false);
  const [selectedProfileUser, setSelectedProfileUser] = useState<UserProfile | null>(null);
  const searchUsers = useKarmelStore((s) => s.searchUsers);
  const searchResults = useKarmelStore((s) => s.searchResults);
  const isSearching = useKarmelStore((s) => s.isSearching);
  const searchError = useKarmelStore((s) => s.searchError);
  const followUser = useKarmelStore((s) => s.followUser);
  const unfollowUser = useKarmelStore((s) => s.unfollowUser);

  const handleSearchSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      setHasSearched(false);
      return;
    }

    setHasSearched(true);
    await searchUsers(trimmed);
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (!value.trim()) {
      setHasSearched(false);
      setSelectedProfileUser(null);
    }
  };

  const handleFollow = async (user: UserProfile) => {
    const isFollowing = user.follow_status === "accepted";
    if (isFollowing) {
      await unfollowUser(user.id);
      return;
    }

    const res = await followUser(user.id);
    if (res.ok) {
      setSelectedProfileUser((prev) => (prev && prev.id === user.id ? { ...prev, follow_status: "pending" } : prev));
    }
  };

  const handleOpenProfile = (user: UserProfile) => {
    setSelectedProfileUser({ ...user, follow_status: user.follow_status });
    setIsProfilePageOpen(true);
  };

  const handleFollowChangeFromProfile = (userId: string, isFollowing: boolean) => {
    if (isFollowing) {
      setSelectedProfileUser((prev) => (prev ? { ...prev, follow_status: "pending" } : prev));
    } else {
      setSelectedProfileUser((prev) => (prev ? { ...prev, follow_status: undefined } : prev));
    }
  };

  const trimmedQuery = query.trim();
  const showPlaceholder = trimmedQuery.length === 0;
  const showResults = hasSearched && trimmedQuery.length > 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 px-4 py-6 backdrop-blur-sm transition-all duration-300 sm:py-8">
      <div className="mx-auto flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/95 shadow-2xl shadow-black/50">
        <div className="shrink-0 border-b border-white/10 p-5 sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/40">Study Network</p>
              <h2 className="mt-2 text-xl font-semibold sm:text-2xl">Add Friends & Study</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
              aria-label="Close discovery"
            >
              <X size={16} />
            </button>
          </div>

          <form className="flex items-center gap-3" onSubmit={handleSearchSubmit}>
            <div className="relative flex-1">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder="Search by name or unique username..."
                className="w-full rounded-xl border border-white/10 bg-black/40 py-3 pl-10 pr-4 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
            >
              <Search size={16} />
              Search
            </button>
          </form>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {isSearching ? (
            <div className="flex items-center justify-center py-16">
              <div className="relative h-10 w-10">
                <div className="absolute inset-0 rounded-full border border-white/10" />
                <div className="absolute inset-0 rounded-full border-t border-white animate-spin" />
              </div>
            </div>
          ) : showPlaceholder ? (
            <div className="flex h-full flex-col items-center justify-center px-6 py-16 text-center">
              <h3 className="mt-4 max-w-lg text-lg font-semibold text-white">
                Search for classmates by name or unique username to start studying together!
              </h3>
              <p className="mt-2 max-w-md text-sm text-white/45">
                Private profiles only appear when you know the exact username.
              </p>
            </div>
          ) : showResults && searchError ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <p className="text-sm text-rose-200">Could not search students.</p>
              <p className="mt-2 text-xs text-white/45">{searchError}</p>
            </div>
          ) : showResults && searchResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <p className="text-sm text-white/50">No students found matching that name</p>
            </div>
          ) : showResults ? (
            <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6">
              {searchResults.map((user) => {
                const isFollowing = user.follow_status === "accepted";
                const isPending = user.follow_status === "pending";
                const avatarOption = getAvatarOption(user.avatar_id);

                return (
                  <div
                    key={user.id}
                    className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 shadow-lg shadow-black/20 transition hover:bg-white/[0.05]"
                  >
                    <button
                      type="button"
                      onClick={() => handleOpenProfile(user)}
                      className="flex w-full items-center gap-3 text-left transition hover:opacity-90"
                    >
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/5">
                        <img src={avatarOption.image} alt={user.full_name} className="h-full w-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium text-white">{user.full_name}</p>
                          {!user.is_public ? (
                            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/55">
                              Private
                            </span>
                          ) : null}
                        </div>
                        <p className="truncate text-xs text-white/50">{user.username}</p>
                        <p className="mt-0.5 text-xs text-white/40">
                          Grade {user.grade} • Level {user.level ?? 1} • {user.followers_count} followers
                        </p>
                      </div>
                    </button>

                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleFollow(user)}
                        disabled={isPending}
                        className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                          isFollowing
                            ? "border border-white/20 bg-white/5 text-white/70 hover:bg-white/10"
                            : isPending
                              ? "cursor-not-allowed border border-white/10 bg-white/10 text-white/45"
                              : "border border-white/20 bg-white text-black hover:bg-white/90"
                        }`}
                      >
                        {isFollowing ? (
                          <>
                            <UserCheck size={14} />
                            Unfriend
                          </>
                        ) : isPending ? (
                          <>
                            <UserCheck size={14} />
                            Requested
                          </>
                        ) : (
                          <>
                            <UserPlus size={14} />
                            Send Request
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      <ProfileView
        isOpen={isProfilePageOpen}
        onClose={() => setIsProfilePageOpen(false)}
        user={selectedProfileUser}
        isCurrentUser={false}
        onSettingsClick={() => {}}
        onFollowChange={handleFollowChangeFromProfile}
      />
    </div>
  );
}
