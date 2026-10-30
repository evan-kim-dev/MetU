import { describe, expect, it } from "vitest";

import {
  buildCurl,
  buildNotificationBody,
  buildSmsBody,
} from "@/lib/onboarding/dev-snippets";

describe("dev-snippets", () => {
  it("curl uses single space after Bearer", () => {
    const curl = buildCurl({
      origin: "https://example.com",
      token: "metu-AAAA-BBBB-CCCC-DDDD",
    });
    expect(curl).toContain('Authorization: Bearer metu-AAAA');
    expect(curl).not.toContain("Bearer  metu");
  });

  it("placeholder token when omitted", () => {
    const curl = buildCurl({ origin: "https://example.com" });
    expect(curl).toContain("<연결 코드>");
  });

  it("sms body parses as JSON", () => {
    expect(JSON.parse(buildSmsBody())).toMatchObject({
      text: expect.any(String),
    });
  });

  it("notification template is valid JSON when placeholders replaced", () => {
    const sample = buildNotificationBody()
      .replace("<알림 앱 이름>", "Test")
      .replace("<알림 제목>", "t")
      .replace("<알림 텍스트>", "b");
    expect(JSON.parse(sample)).toMatchObject({ app: "Test", body: "b" });
  });
});
