export const PRESENCE_ONLINE_WINDOW_MS = 90 * 1000;

export const isRecentlySeen = (lastSeenAt?: string | null) => {
  if (!lastSeenAt) return false;
  const timestamp = Date.parse(lastSeenAt);
  if (Number.isNaN(timestamp)) return false;
  return Date.now() - timestamp < PRESENCE_ONLINE_WINDOW_MS;
};

export const formatLastSeen = (lastSeenAt?: string | null) => {
  if (!lastSeenAt) return "Last seen: unknown";
  const timestamp = Date.parse(lastSeenAt);
  if (Number.isNaN(timestamp)) return "Last seen: unknown";

  const diffMs = Date.now() - timestamp;
  if (diffMs < PRESENCE_ONLINE_WINDOW_MS) {
    return "Online now";
  }

  const minutes = Math.max(1, Math.floor(diffMs / 60_000));
  if (minutes < 60) {
    return `Last seen ${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `Last seen ${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  return `Last seen ${days}d ago`;
};
