# MetU Design System (UX-S0)

핀테크 톤(Toss/Linear): 뉴트럴 그레이 + 액센트 1색(`#2563EB`), 카드는 흰 면+1px 보더, 화면당 CTA 1개.

## 토큰

출처: `lib/design/tokens.ts` → `app/globals.css`의 `--mu-*` → Tailwind `mu-*`.

| 토큰 | 값 | 용도 |
|---|---|---|
| `mu-bg` | `#F7F8FA` | 앱 배경 |
| `mu-card` | `#FFFFFF` | 카드·시트 |
| `mu-sunken` | `#F2F4F6` | 칩 off·스켈레톤 |
| `mu-line` | `#E5E8EB` | 카드 보더 |
| `mu-line-strong` | `#8B95A1` | 입력·칩 경계(텍스트 색 금지) |
| `mu-fg` / `fg-2` / `fg-3` | `#191F28` / `#4E5968` / `#5F6B7A` | 제목·본문·캡션 |
| `mu-accent` | `#2563EB` | CTA·선택 |
| `mu-ok` / `warn` / `err` | 상태색 | 완료·주의·오류 |

모션: `--mu-dur-fast` 150ms · `--mu-dur` 200ms · `--mu-dur-slow` 250ms. `prefers-reduced-motion`이면 1ms.

## 컴포넌트

```tsx
import { AmountCard, BottomCTA, MemberChip, Stepper } from "@/components/ds";

<AmountCard label="내가 보낼 돈" amount={12000} tone="neutral" />
<MemberChip name="민수" selected onToggle={() => {}} />
<BottomCTA label="다음" onClick={() => {}} hint="안 맞는 게 없으면 바로 가도 돼요" />
```

여정 루트와 ds에는 `.mu-root` / `.mu-num`을 씁니다(Pretendard + tabular nums).

## Do / Don't

**Do**
- `mu-*` 토큰·`components/ds/*`만 사용
- 카드 = `border border-mu-line bg-mu-card` (그림자 없음)
- 하단 CTA는 `BottomCTA` 하나
- 금액은 `.mu-num` + `formatKRW`

**Don't**
- 임의 `#hex`, `bg-blue-500` 류, `shadow-glow`, `ai-gradient-*`, `text-[10px]`
- 레거시 `PrimaryButton` / `BottomSheet` / `SkeletonBlock`을 이 PR에서 수정
- 카카오페이 버튼 외 `kakao-*` 남용(브랜드 색 예외만 허용)
