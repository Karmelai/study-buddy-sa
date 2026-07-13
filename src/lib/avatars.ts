export type AvatarId =
  | "default"
  | "avatar-one"
  | "avatar-two"
  | "avatar-three"
  | "avatar-four"
  | "avatar-five"
  | "avatar-six"
  | "avatar-seven"
  | "avatar-eight"
  | "avatar-nine"
  | "avatar-ten"
  | "avatar-eleven"
  | "avatar-twelve";

export type AvatarOption = {
  id: AvatarId;
  label: string;
  image: string;
};

export const AVATAR_OPTIONS: AvatarOption[] = [
  { id: "default", label: "Default", image: "/avatars/default.svg" },
  { id: "avatar-one", label: "Avatar One", image: "/avatars/avatar-one.png" },
  { id: "avatar-two", label: "Avatar Two", image: "/avatars/avatar-two.png" },
  { id: "avatar-three", label: "Avatar Three", image: "/avatars/avatar-three.png" },
  { id: "avatar-four", label: "Avatar Four", image: "/avatars/avatar-four.png" },
  { id: "avatar-five", label: "Avatar Five", image: "/avatars/avatar-five.png" },
  { id: "avatar-six", label: "Avatar Six", image: "/avatars/avatar-six.png" },
  { id: "avatar-seven", label: "Avatar Seven", image: "/avatars/avatar-seven.png" },
  { id: "avatar-eight", label: "Avatar Eight", image: "/avatars/avatar-eight.png" },
  { id: "avatar-nine", label: "Avatar Nine", image: "/avatars/avatar-nine.png" },
  { id: "avatar-ten", label: "Avatar Ten", image: "/avatars/avatar-ten.png" },
  { id: "avatar-eleven", label: "Avatar Eleven", image: "/avatars/avatar-eleven.png" },
  { id: "avatar-twelve", label: "Avatar Twelve", image: "/avatars/avatar-twelve.png" },
];

export const STARTER_AVATAR_OPTIONS = AVATAR_OPTIONS.filter((option) => option.id === "default");

export const DEFAULT_AVATAR_ID: AvatarId = "default";

export const getAvatarOption = (avatarId?: string | null) => {
  return AVATAR_OPTIONS.find((option) => option.id === avatarId) ?? AVATAR_OPTIONS[0];
};
