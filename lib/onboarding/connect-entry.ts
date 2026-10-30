/**
 * Whether /onboarding/automation should open the connected hub
 * instead of the first-time wizard.
 */
export function shouldEnterConnectHub(input: {
  hasActiveToken: boolean;
  status: string;
}): boolean {
  return (
    input.hasActiveToken &&
    (input.status === "done" || input.status === "partial")
  );
}
