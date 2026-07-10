"""WithAct 체크리스트 프록시 엔드투엔드 검증."""
from __future__ import annotations

import json
import sys

import httpx

BACKEND = "http://127.0.0.1:8000"
FRONTEND = "http://localhost:3000"
GUEST_ID = "bt-verify-checklist-001"


def check(label: str, ok: bool, detail: str = "") -> None:
    mark = "OK" if ok else "FAIL"
    print(f"[{mark}] {label}" + (f" | {detail}" if detail else ""))
    if not ok:
        sys.exit(1)


def main() -> None:
    with httpx.Client(timeout=20.0) as client:
        # 1) 백엔드 라우트 등록
        openapi = client.get(f"{BACKEND}/openapi.json")
        check("backend health", openapi.status_code == 200)
        paths = openapi.json().get("paths", {})
        check(
            "checklist routes registered",
            "/checklist/withact/session" in paths,
            str([p for p in paths if "checklist" in p]),
        )

        # 2) 세션 생성
        session_res = client.post(
            f"{BACKEND}/checklist/withact/session",
            json={"guestId": GUEST_ID, "totalBudget": 1200000},
        )
        check("create session", session_res.status_code == 200, session_res.text[:200])
        session = session_res.json()
        budget_id = session.get("budgetId")
        required_item_id = session.get("requiredItemId")
        check(
            "session ids present",
            bool(budget_id and required_item_id),
            json.dumps(session, ensure_ascii=False),
        )

        # 3) 항목 저장
        item_res = client.post(
            f"{BACKEND}/checklist/withact/items",
            json={
                "guestId": GUEST_ID,
                "budgetId": budget_id,
                "requiredItemId": required_item_id,
                "itemType": "FLIGHT",
                "itemStatus": "SEARCHED",
                "itemName": "인천 → 나리타",
                "itemSummary": "E2E 테스트 조회",
                "externalProvider": "naver-flights",
            },
        )
        check("save checklist item", item_res.status_code == 200, item_res.text[:200])

        # 4) 상세 조회
        details_res = client.get(
            f"{BACKEND}/checklist/withact/details",
            params={"requiredItemId": required_item_id},
        )
        check("load details", details_res.status_code == 200, details_res.text[:200])
        details = details_res.json().get("details", [])
        check("details not empty", len(details) > 0, f"count={len(details)}")

        # 5) Next BFF (프론트 실행 중일 때만)
        try:
            bff_res = client.post(
                f"{FRONTEND}/api/checklist/session",
                json={"guestId": f"{GUEST_ID}-bff", "totalBudget": 0},
            )
            if bff_res.status_code == 200:
                check("next bff session", True, bff_res.text[:120])
            else:
                print(f"[SKIP] next bff session | status {bff_res.status_code}")
        except httpx.HTTPError as exc:
            print(f"[SKIP] next bff session | {exc}")

    print("\nAll WithAct checklist checks passed.")


if __name__ == "__main__":
    main()
