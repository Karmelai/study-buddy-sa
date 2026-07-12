import { useEffect, useState } from "react";
import { CheckCircle2, Search, Users, XCircle } from "lucide-react";
import { getAvatarOption } from "@/lib/avatars";
import { formatLastSeen } from "@/lib/presence";
import { useKarmelStore, type SocialProfile } from "@/store/useKarmelStore";
import FriendsDiscovery from "./FriendsDiscovery";
import ProfileView from "./ProfileView";

const ProfileRow = ({ user, isOnline }: { user: SocialProfile; isOnline: boolean }) => {
  const avatar = getAvatarOption(user.avatar_id);

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <div
        className={`h-12 w-12 shrink-0 overflow-hidden rounded-full bg-white/5 ${
          isOnline ? "ring-2 ring-green-500 ring-offset-2 ring-offset-slate-900" : "border border-white/10"
        }`}
      >
        <img src={avatar.image} alt={user.full_name} className="h-full w-full object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{user.full_name}</p>
        <p className="truncate text-xs text-white/45">{user.username}</p>
        {isOnline ? (
          <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
            Online
          </p>
        ) : (
          <p className="mt-0.5 text-xs text-white/35">{formatLastSeen(user.last_seen_at)}</p>
        )}
      </div>
    </div>
  );
};

export default function FriendsHub() {
  const [selectedFriend, setSelectedFriend] = useState<SocialProfile | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isDiscoveryOpen, setIsDiscoveryOpen] = useState(false);
  const pendingIncomingRequests = useKarmelStore((s) => s.pendingIncomingRequests);
  const friendsList = useKarmelStore((s) => s.friendsList);
  const onlineUserIds = useKarmelStore((s) => s.onlineUserIds);
  const refreshNetworkData = useKarmelStore((s) => s.refreshNetworkData);
  const acceptFriendRequest = useKarmelStore((s) => s.acceptFriendRequest);
  const declineFriendRequest = useKarmelStore((s) => s.declineFriendRequest);

  useEffect(() => {
    void refreshNetworkData();
  }, [refreshNetworkData]);

  const handleAccept = async (senderId: string) => {
    await acceptFriendRequest(senderId);
  };

  const handleDecline = async (senderId: string) => {
    await declineFriendRequest(senderId);
  };

  const handleOpenFriendProfile = (user: SocialProfile) => {
    setSelectedFriend(user);
    setIsProfileOpen(true);
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      <section className="rounded-[2rem] border border-white/10 bg-zinc-950/80 p-6 shadow-2xl shadow-black/20 sm:p-8">
        <div className="flex flex-col gap-6 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-white/35">Friends Network</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Manage requests and study friends</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/50">
              Accept incoming requests, decline the ones you do not know, and keep your study circle clean.
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-3 sm:items-end">
            <button
              type="button"
              onClick={() => setIsDiscoveryOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90"
            >
              <Search size={16} />
              Search friends
            </button>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/75">
              <Users size={16} />
              {friendsList.length} friends
              {pendingIncomingRequests.length > 0 ? (
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-black">
                  {pendingIncomingRequests.length} pending
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Incoming Requests</h2>
                <p className="mt-1 text-sm text-white/45">Students waiting for your approval.</p>
              </div>
              {pendingIncomingRequests.length > 0 ? (
                <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-black">
                  {pendingIncomingRequests.length}
                </div>
              ) : null}
            </div>

            <div className="mt-4 space-y-3">
              {pendingIncomingRequests.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center">
                  <p className="text-sm text-white/45">No pending requests right now.</p>
                </div>
              ) : (
                pendingIncomingRequests.map((user) => (
                  <div key={user.id} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <ProfileRow user={user} isOnline={onlineUserIds.includes(user.id)} />
                    <div className="mt-3 flex flex-wrap gap-2 sm:justify-end">
                      <button
                        type="button"
                        onClick={() => handleAccept(user.id)}
                        className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-black transition hover:bg-emerald-300"
                      >
                        <CheckCircle2 size={16} />
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDecline(user.id)}
                        className="inline-flex items-center gap-2 rounded-full border border-red-400/25 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-500/20"
                      >
                        <XCircle size={16} />
                        Decline
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div>
              <h2 className="text-lg font-semibold text-white">My Friends</h2>
              <p className="mt-1 text-sm text-white/45">See who was last active in your study circle.</p>
            </div>

            <div className="mt-4 grid gap-3">
              {friendsList.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center">
                  <p className="text-sm text-white/45">No friends yet. Accept a request to get started.</p>
                </div>
              ) : (
                friendsList.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => handleOpenFriendProfile(user)}
                    className="w-full text-left transition hover:opacity-90 focus:outline-none"
                  >
                    <ProfileRow user={user} isOnline={onlineUserIds.includes(user.id)} />
                  </button>
                ))
              )}
            </div>
          </section>
        </div>
      </section>

      <ProfileView
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        user={selectedFriend}
        isCurrentUser={false}
        onSettingsClick={() => {}}
      />

      <FriendsDiscovery isOpen={isDiscoveryOpen} onClose={() => setIsDiscoveryOpen(false)} />
    </div>
  );
}
