export const PRESENCE_ONLINE_WINDOW_MS = 90 * 1000;

export const isRecentlySeen = (lastSeenAt?: string | null) => {
  if (!lastSeenAt) return false;
  const timestamp = Date.parse(lastSeenAt);
  if (Number.isNaN(timestamp)) return false;
  return Date.now() - timestamp < PRESENCE_ONLINE_WINDOW_MS;
};
