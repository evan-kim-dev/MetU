# 영수증 평가 세트

팀원 **본인 영수증**만 사용하세요. 카드번호·이름·주소는 가린 뒤 넣어요.

## 레이아웃

- `labels.json` — 정답 (로컬, 커밋 금지 권장; 예시는 `labels.example.json`)
- `images/*` — 이미지 파일 (gitignore)

## 실행

```bash
# 라벨 스키마만 검증
npx tsx scripts/eval-receipts.ts --dry

# 이미지 있을 때 report.md 생성 (GEMINI_API_KEY 필요, 값은 출력하지 않음)
npx tsx scripts/eval-receipts.ts
```

평가 수치를 코드·문서에 하드코딩하지 마세요. `report.md`는 실행 산출물입니다.
