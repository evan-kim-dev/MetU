export function buildCurl(opts: {
  origin: string;
  token?: string;
  path?: "/api/ingest/notification" | "/api/ingest/sms";
}): string {
  const path = opts.path ?? "/api/ingest/notification";
  const url = `${opts.origin.replace(/\/$/, "")}${path}`;
  const token = opts.token ?? "<연결 코드>";
  const body =
    path === "/api/ingest/sms"
      ? '{\\"text\\":\\"MTU-TEST 연결 확인\\"}'
      : '{\\"app\\":\\"TestApp\\",\\"title\\":\\"결제\\",\\"body\\":\\"MTU-TEST 연결 확인\\"}';
  return `curl -X POST "${url}" -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" -d "${body}"`;
}

export function buildNotificationBody(): string {
  return `{"app":"<알림 앱 이름>","title":"<알림 제목>","body":"<알림 텍스트>"}`;
}

export function buildSmsBody(): string {
  return `{"text":"MTU-TEST 연결 확인","receivedAt":"2026-10-31T12:00:00+09:00"}`;
}

export const DEV_SNIPPET_ENDPOINTS = {
  notification: "/api/ingest/notification",
  sms: "/api/ingest/sms",
} as const;
