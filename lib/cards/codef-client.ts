import "server-only";
import { constants, createPublicKey, publicEncrypt } from "node:crypto";
import { getServerEnv } from "@/lib/env";
import { CodefEnvelopeSchema, toCardList, type CodefCard } from "./codef-schema";

/**
 * CODEF 개인카드 실적조회 호출 (서버 전용).
 * - 사용자 카드사 로그인은 여기서 받지 않아요. CODEF 계정등록으로 미리 만든 connectedId 만 써요.
 * - 과도한 호출 시 카드사가 IP 를 막을 수 있어요(문서 경고) → 사용자가 화면을 열 때만 호출해요.
 * VERIFY: 요청 본문·응답 본문 URL 인코딩 규격은 CODEF 공식 SDK 방식을 따름. 정식 계약 후 실 키로 확인 필요.
 */

const HOSTS = {
  development: "https://development.codef.io",
  production: "https://api.codef.io",
} as const;
const OAUTH_URL = "https://oauth.codef.io/oauth/token";
const RESULT_CHECK_PATH = "/v1/kr/card/p/account/result-check-list";
const ACCOUNT_CREATE_PATH = "/v1/account/create";

export type CodefConfig = {
  clientId: string;
  clientSecret: string;
  host: string;
  /** CODEF 개발자 콘솔의 RSA 공개키(Base64 DER). 계정등록(connectedId 발급)에만 필요해요. */
  publicKey?: string;
};

export function getCodefConfig(): CodefConfig | null {
  const env = getServerEnv();
  if (!env.CODEF_CLIENT_ID || !env.CODEF_CLIENT_SECRET) return null;
  const host = env.CODEF_API_ENV === "production" ? HOSTS.production : HOSTS.development;
  return {
    clientId: env.CODEF_CLIENT_ID,
    clientSecret: env.CODEF_CLIENT_SECRET,
    host,
    ...(env.CODEF_PUBLIC_KEY ? { publicKey: env.CODEF_PUBLIC_KEY } : {}),
  };
}

/** CODEF 응답은 URL 인코딩된 JSON 문자열로 오기도 해요. 둘 다 받아요. */
export function decodeCodefBody(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    return JSON.parse(decodeURIComponent(trimmed.replace(/\+/g, " ")));
  }
}

let tokenCache: { token: string; expiresAt: number } | null = null;

async function getAccessToken(cfg: CodefConfig, fetchImpl: typeof fetch): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt - 60_000 > now) return tokenCache.token;
  const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64");
  const res = await fetchImpl(OAUTH_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials&scope=read",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`codef-oauth-${res.status}`);
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new Error("codef-oauth-empty");
  tokenCache = {
    token: json.access_token,
    expiresAt: now + Math.max(60, json.expires_in ?? 3600) * 1000,
  };
  return json.access_token;
}

export type ResultCheckInput = {
  organization: string;
  connectedId: string;
  /** YYYYMM, 없으면 당월 */
  startDate?: string;
};

export type ResultCheckOutcome =
  | { ok: true; cards: CodefCard[] }
  | { ok: false; code: string; message: string };

type CodefEnvelope = { result: { code: string; message?: string | null }; data: unknown };

/** CODEF 공통 POST — 요청 본문은 URL 인코딩한 JSON (공식 SDK 방식). */
async function codefPost(
  cfg: CodefConfig,
  path: string,
  payload: unknown,
  fetchImpl: typeof fetch
): Promise<{ ok: true; envelope: CodefEnvelope } | { ok: false; code: string; message: string }> {
  const token = await getAccessToken(cfg, fetchImpl);
  const res = await fetchImpl(`${cfg.host}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: encodeURIComponent(JSON.stringify(payload)),
    cache: "no-store",
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) return { ok: false, code: `http-${res.status}`, message: "CODEF 호출 실패" };
  const envelope = CodefEnvelopeSchema.safeParse(decodeCodefBody(await res.text()));
  if (!envelope.success) return { ok: false, code: "bad-response", message: "응답 형식이 달라요" };
  return { ok: true, envelope: envelope.data as CodefEnvelope };
}

export async function fetchCardResultCheck(
  cfg: CodefConfig,
  input: ResultCheckInput,
  fetchImpl: typeof fetch = fetch
): Promise<ResultCheckOutcome> {
  const out = await codefPost(
    cfg,
    RESULT_CHECK_PATH,
    {
      organization: input.organization,
      connectedId: input.connectedId,
      startDate: input.startDate ?? "",
    },
    fetchImpl
  );
  if (!out.ok) return out;
  const { code, message } = out.envelope.result;
  // CF-03002 = 추가인증 필요(롯데·씨티 등). 이 테스트 화면은 추가인증을 지원하지 않아요.
  if (code !== "CF-00000") return { ok: false, code, message: message ?? "조회 실패" };
  return { ok: true, cards: toCardList(out.envelope.data) };
}

/**
 * CODEF 공개키로 비밀번호 암호화 (RSA PKCS#1 v1.5 → Base64). 공식 SDK 와 같은 방식.
 * 평문은 이 함수 밖으로 나가지 않아요.
 */
export function encryptCodefPassword(publicKeyBase64: string, plain: string): string {
  const der = Buffer.from(publicKeyBase64.replace(/\s+/g, ""), "base64");
  const key = createPublicKey({ key: der, format: "der", type: "spki" });
  return publicEncrypt({ key, padding: constants.RSA_PKCS1_PADDING }, Buffer.from(plain, "utf8")).toString(
    "base64"
  );
}

export type ConnectAccountInput = {
  /** 카드사 기관코드 4자리 */
  organization: string;
  /** 카드사 홈페이지 아이디 */
  loginId: string;
  /** 카드사 홈페이지 비밀번호 (평문 — 바로 암호화하고 버려요) */
  password: string;
};

export type ConnectAccountOutcome =
  | { ok: true; connectedId: string }
  | { ok: false; code: string; message: string };

/**
 * 카드사 계정(아이디/비밀번호 방식)을 CODEF 에 등록하고 connectedId 를 받아요.
 * VERIFY: 정식 계약 전 데모 키로 응답 형식(data.connectedId, errorList) 확인 필요.
 */
export async function createCardConnectedId(
  cfg: CodefConfig,
  input: ConnectAccountInput,
  fetchImpl: typeof fetch = fetch
): Promise<ConnectAccountOutcome> {
  if (!cfg.publicKey) return { ok: false, code: "no-public-key", message: "CODEF 공개키가 없어요" };
  const out = await codefPost(
    cfg,
    ACCOUNT_CREATE_PATH,
    {
      accountList: [
        {
          countryCode: "KR",
          businessType: "CD",
          clientType: "P",
          organization: input.organization,
          loginType: "1",
          id: input.loginId,
          password: encryptCodefPassword(cfg.publicKey, input.password),
        },
      ],
    },
    fetchImpl
  );
  if (!out.ok) return out;
  const { code, message } = out.envelope.result;
  const data = (out.envelope.data ?? {}) as {
    connectedId?: unknown;
    errorList?: Array<{ code?: unknown; message?: unknown }>;
  };
  const firstError = Array.isArray(data.errorList) ? data.errorList[0] : undefined;
  if (firstError) {
    return {
      ok: false,
      code: typeof firstError.code === "string" ? firstError.code : code,
      message: typeof firstError.message === "string" ? firstError.message : message ?? "계정 등록 실패",
    };
  }
  if (code !== "CF-00000" || typeof data.connectedId !== "string" || !data.connectedId) {
    return { ok: false, code, message: message ?? "계정 등록 실패" };
  }
  return { ok: true, connectedId: data.connectedId };
}

/** 테스트용 */
export function resetCodefTokenCacheForTests(): void {
  tokenCache = null;
}
