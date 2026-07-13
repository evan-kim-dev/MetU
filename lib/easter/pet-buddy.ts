export type PetBuddyKind = "cat" | "dog";

const CAT_KEYS = ["고양이", "냥이", "야옹", "cat", "kitten", "kitty"];
const DOG_KEYS = ["강아지", "멍멍", "puppy", "doggo", "dog"];

function includesAny(text: string, keys: string[]): boolean {
  const lower = text.toLowerCase();
  return keys.some((key) => lower.includes(key.toLowerCase()));
}

/** 프로필 소개에서 커서 펫(고양이)만 — 강아지는 프로필 카드 전용 */
export function detectCursorPetsFromBio(
  bio: string | null | undefined
): PetBuddyKind[] {
  const text = bio?.trim() ?? "";
  if (!text) return [];
  const pets: PetBuddyKind[] = [];
  if (includesAny(text, CAT_KEYS)) pets.push("cat");
  return pets;
}

/** 프로필 카드 안에서 움직이는 강아지 */
export function hasDogBuddyInBio(bio: string | null | undefined): boolean {
  return includesAny(bio?.trim() ?? "", DOG_KEYS);
}

/** @deprecated 커서+카드 통합 감지 — 호환용 */
export function detectPetBuddiesFromBio(bio: string | null | undefined): PetBuddyKind[] {
  const text = bio?.trim() ?? "";
  if (!text) return [];

  const pets: PetBuddyKind[] = [];
  if (includesAny(text, CAT_KEYS)) pets.push("cat");
  if (includesAny(text, DOG_KEYS)) pets.push("dog");
  return pets;
}

export const PET_BUDDY_SRC: Record<PetBuddyKind, string> = {
  cat: "/easter/cat.gif",
  dog: "/easter/dog.gif",
};

export const PET_BUDDY_LABEL: Record<PetBuddyKind, string> = {
  cat: "고양이",
  dog: "강아지",
};
