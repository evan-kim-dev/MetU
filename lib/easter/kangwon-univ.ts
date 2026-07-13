/** 도착지 이스터에그: 강원대 → 대학원 입시 모집요강 */
export const KANGWON_GRAD_ADMISSION_URL =
  "https://adgraduate.kangwon.ac.kr/adgraduate/admission/guideline03.do#a";

export function isKangwonUniversityDestination(
  destination: string | null | undefined
): boolean {
  const text = (destination ?? "").trim().toLowerCase().replace(/\s+/g, "");
  if (!text) return false;
  return (
    text.includes("강원대학교") ||
    text.includes("강원대") ||
    text.includes("kangwonnationaluniversity") ||
    text.includes("kangwonuniversity")
  );
}
