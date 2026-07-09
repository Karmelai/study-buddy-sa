export type AvatarId = "default" | "avatar-one" | "avatar-two";

export type AvatarOption = {
  id: AvatarId;
  label: string;
  image: string;
};

export const AVATAR_OPTIONS: AvatarOption[] = [
  { id: "default", label: "Default", image: "/avatars/default.png" },
  { id: "avatar-one", label: "Avatar One", image: "/avatars/avatar-one.png" },
  { id: "avatar-two", label: "Avatar Two", image: "/avatars/avatar-two.png" },
];

export const DEFAULT_AVATAR_ID: AvatarId = "default";

export const getAvatarOption = (avatarId?: string | null) => {
  return AVATAR_OPTIONS.find((option) => option.id === avatarId) ?? AVATAR_OPTIONS[0];
};
