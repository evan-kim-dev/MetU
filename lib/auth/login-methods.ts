export type LoginMethodId = "kakao";

export interface LoginMethod {
  id: LoginMethodId;
  label: string;
  loadingLabel: string;
  description?: string;
  variant: "kakao";
}

/** 프로필·로그인 화면에 노출할 로그인 수단 (추가 시 여기에 등록) */
export const LOGIN_METHODS: LoginMethod[] = [
  {
    id: "kakao",
    label: "카카오 간편로그인",
    loadingLabel: "카카오로 이동 중…",
    description: "카카오 계정으로 로그인",
    variant: "kakao",
  },
];
