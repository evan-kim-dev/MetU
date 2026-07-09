/** 카카오 REST API 키 (앱 관리 > 앱 키). 브라우저 로그아웃 URL에만 사용됩니다. */
export function tryGetKakaoRestApiKey(): string | null {
  const key = process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY?.trim();
  return key || null;
}

/** 카카오계정과 함께 로그아웃 URL */
export function buildKakaoLogoutUrl(logoutRedirectUri: string): string | null {
  const clientId = tryGetKakaoRestApiKey();
  if (!clientId) return null;

  const params = new URLSearchParams({
    client_id: clientId,
    logout_redirect_uri: logoutRedirectUri,
  });

  return `https://kauth.kakao.com/oauth/logout?${params.toString()}`;
}
