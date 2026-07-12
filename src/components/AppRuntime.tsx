import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useKarmelStore } from "@/store/useKarmelStore";

export default function AppRuntime() {
  const isAuthed = useKarmelStore((state) => state.isAuthed);
  const userId = useKarmelStore((state) => state.userId);
  const username = useKarmelStore((state) => state.username);
  const studentName = useKarmelStore((state) => state.studentName);
  const avatarId = useKarmelStore((state) => state.avatarId);
  const isTimerRunning = useKarmelStore((state) => state.isTimerRunning);
  const onlineUserIds = useKarmelStore((state) => state.onlineUserIds);
  const friendsList = useKarmelStore((state) => state.friendsList);
  const startPresenceTracking = useKarmelStore((state) => state.startPresenceTracking);
  const stopPresenceTracking = useKarmelStore((state) => state.stopPresenceTracking);
  const tickTimer = useKarmelStore((state) => state.tickTimer);
  const claimOnlineNotifications = useKarmelStore((state) => state.claimOnlineNotifications);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthed || !userId) return;

    void supabase
      .from("profiles")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", userId)
      .then(({ error }) => {
        if (error) console.error("last seen update failed", error);
      });
  }, [isAuthed, userId]);

  useEffect(() => {
    let active = true;
    let cleanup: (() => Promise<void>) | null = null;

    if (!isAuthed || !userId || typeof window === "undefined") {
      void stopPresenceTracking();
      return;
    }

    void (async () => {
      try {
        cleanup = await startPresenceTracking({
          userId,
          username,
          fullName: studentName,
          avatarId,
        });
        if (!active) await cleanup();
      } catch (error) {
        console.error("startPresenceTracking failed", error);
      }
    })();

    return () => {
      active = false;
      void (async () => {
        try {
          if (cleanup) {
            await cleanup();
            return;
          }
          await stopPresenceTracking();
        } catch (error) {
          console.error("presence effect cleanup failed", error);
        }
      })();
    };
  }, [
    avatarId,
    isAuthed,
    startPresenceTracking,
    stopPresenceTracking,
    studentName,
    userId,
    username,
  ]);

  useEffect(() => {
    if (!isAuthed || !isTimerRunning || typeof window === "undefined") return;

    const interval = window.setInterval(tickTimer, 1000);
    return () => window.clearInterval(interval);
  }, [isAuthed, isTimerRunning, tickTimer]);

  useEffect(() => {
    if (!isAuthed || onlineUserIds.length === 0) return;

    const onlineIds = new Set(onlineUserIds);
    const newlyOnlineFriends = friendsList.filter((friend) => onlineIds.has(friend.id));
    const claimedIds = new Set(
      claimOnlineNotifications(newlyOnlineFriends.map((friend) => friend.id)),
    );

    newlyOnlineFriends
      .filter((friend) => claimedIds.has(friend.id))
      .slice(0, 3)
      .forEach((friend) => {
        toast(`${friend.full_name} is online`, {
          description: "Tap to open your Friends page.",
          duration: 10000,
          action: {
            label: "Open",
            onClick: () => navigate({ to: "/friends" }),
          },
        });
      });
  }, [claimOnlineNotifications, friendsList, isAuthed, navigate, onlineUserIds]);

  return null;
}
