export function formatPartyBudgetPerPerson(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return trimmed.includes("만원") ? trimmed : `${trimmed}만원`;
}
