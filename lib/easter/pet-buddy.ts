export type PetBuddyKind = "cat" | "dog";

const CAT_KEYS = ["고양이", "냥이", "야옹", "cat", "kitten", "kitty"];
const DOG_KEYS = ["강아지", "멍멍", "puppy", "doggo", "dog"];

function includesAny(text: string, keys: string[]): boolean {
  const lower = text.toLowerCase();
  return keys.some((key) => lower.includes(key.toLowerCase()));
}

/** 프로필 소개에서 커서 펫 이스터에그 종류를 추출 */
export function detectPetBuddiesFromBio(bio: string | null | undefined): PetBuddyKind[] {
  const text = bio?.trim() ?? "";
  if (!text) return [];

  const pets: PetBuddyKind[] = [];
  if (includesAny(text, CAT_KEYS)) pets.push("cat");
  if (includesAny(text, DOG_KEYS)) pets.push("dog");
  return pets;
}

export const PET_BUDDY_SRC: Record<PetBuddyKind, string> = {
  cat: "/easter/cat.png",
  dog: "/easter/dog.png",
};

export const PET_BUDDY_LABEL: Record<PetBuddyKind, string> = {
  cat: "고양이",
  dog: "강아지",
};
