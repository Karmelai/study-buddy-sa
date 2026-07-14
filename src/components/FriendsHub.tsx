import { useEffect, useState } from "react";
import { CheckCircle2, Inbox, Search, Users, XCircle } from "lucide-react";
import { getAvatarOption } from "@/lib/avatars";
import { formatLastSeen } from "@/lib/presence";
import { useKarmelStore, type SocialProfile } from "@/store/useKarmelStore";
import FriendsDiscovery from "./FriendsDiscovery";
import ProfileView from "./ProfileView";

const ProfileRow = ({ user, isOnline }: { user: SocialProfile; isOnline: boolean }) => {
  const avatar = getAvatarOption(user.avatar_id);

  return (
    <div className="relative flex min-h-16 items-center gap-3 overflow-hidden py-3">
      <div className={`relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-white/5 transition-transform duration-200 ease-out group-hover:rotate-6 group-hover:scale-110 group-active:scale-100 ${isOnline ? "ring-1 ring-white/60" : "border border-white/10"}`}>
        <img src={avatar.image} alt={user.full_name} className="h-full w-full object-cover transition-transform duration-200 group-hover:-rotate-6 group-hover:scale-110" />
        <span className={`absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full border-2 border-zinc-950 ${isOnline ? "bg-white" : "bg-white/25"}`} aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{user.full_name}</p>
        <p className="truncate text-xs text-white/45">{user.username}</p>
        {isOnline ? (
          <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-white/75">
            <span className="h-1.5 w-1.5 rounded-full bg-white" aria-hidden="true" />
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
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-5 border-b border-white/10 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-white/35">Friends Network</p>
            <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Manage requests and study friends</h1>
          </div>
          <div className="flex w-full items-center gap-3 sm:w-auto">
            <span className="friends-count min-w-0 flex-1 text-right text-sm text-white/50 sm:flex-none sm:text-left">
              {friendsList.length} {friendsList.length === 1 ? "friend" : "friends"}
              {pendingIncomingRequests.length > 0 ? ` · ${pendingIncomingRequests.length} pending` : ""}
            </span>
            <button
              type="button"
              onClick={() => setIsDiscoveryOpen(true)}
              className="friends-search-trigger inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-white/15 bg-white px-3.5 py-2 text-sm font-medium text-black transition hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-white/60 focus:ring-offset-2 focus:ring-offset-black"
            >
              <Search size={16} />
              Search friends
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <section className="flex min-h-80 flex-col rounded-xl border border-white/10 bg-white/[0.02] p-5 sm:p-6">
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

            <div className={`mt-4 ${pendingIncomingRequests.length === 0 ? "flex flex-1" : "space-y-3"}`}>
              {pendingIncomingRequests.length === 0 ? (
                <div className="flex h-full w-full flex-col items-center justify-center px-4 text-center">
                  <Inbox size={20} className="text-white/35" aria-hidden="true" />
                  <p className="mt-3 text-sm text-white/45">No pending requests. New requests will appear here.</p>
                </div>
              ) : (
                pendingIncomingRequests.map((user) => (
                  <div key={user.id} className="border-b border-white/10 py-2 last:border-b-0 sm:flex sm:items-center sm:gap-4">
                    <ProfileRow user={user} isOnline={onlineUserIds.includes(user.id)} />
                    <div className="mb-2 flex shrink-0 flex-wrap gap-2 sm:mb-0 sm:justify-end">
                      <button
                        type="button"
                        onClick={() => handleAccept(user.id)}
                        className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-sm font-medium text-black transition hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-white/60"
                      >
                        <CheckCircle2 size={16} />
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDecline(user.id)}
                        className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3.5 py-2 text-sm font-medium text-white/75 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/60"
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

          <section className="flex min-h-80 flex-col rounded-xl border border-white/10 bg-white/[0.02] p-5 sm:p-6">
            <div>
              <h2 className="text-lg font-semibold text-white">My Friends</h2>
              <p className="mt-1 text-sm text-white/45">See who was last active in your study circle.</p>
            </div>

            <div className="mt-4 flex-1">
              {friendsList.length === 0 ? (
                <div className="flex h-full min-h-48 flex-col items-center justify-center border-y border-dashed border-white/10 px-4 text-center">
                  <Users size={20} className="text-white/35" aria-hidden="true" />
                  <p className="mt-3 text-sm font-medium text-white/70">No friends yet</p>
                  <p className="mt-1 text-sm text-white/40">Accept a request to get started.</p>
                </div>
              ) : (
                friendsList.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => handleOpenFriendProfile(user)}
                    className="group w-full border-b border-white/10 text-left transition-all duration-200 last:border-b-0 hover:translate-x-1 hover:bg-white/[0.06] active:translate-x-0 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white/60"
                  >
                    <ProfileRow user={user} isOnline={onlineUserIds.includes(user.id)} />
                  </button>
                ))
              )}
            </div>
          </section>
        </div>

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
