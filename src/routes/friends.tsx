import { createFileRoute } from "@tanstack/react-router";
import AppShell from "@/components/AppShell";
import FriendsHub from "@/components/FriendsHub";

export const Route = createFileRoute("/friends")({
  head: () => ({
    meta: [
      { title: "Friends — KARMEL" },
      { name: "description", content: "Manage study friends and incoming requests." },
    ],
  }),
  component: FriendsPage,
});

function FriendsPage() {
  return (
    <AppShell>
      <FriendsHub />
    </AppShell>
  );
}
