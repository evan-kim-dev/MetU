"""인천국제공항공사 OpenAPI 별첨 — 항공사 코드 (IATA / ICAO / 한글명)."""

from __future__ import annotations

ICN_AIRLINE_CODES: list[dict[str, str]] = [
    {"iata": "S7", "icao": "SBI", "name": "S7 항공"},
    {"iata": "GA", "icao": "GIA", "name": "가루다인도네시아항공"},
    {"iata": "KE", "icao": "KAL", "name": "대한항공"},
    {"iata": "DL", "icao": "DAL", "name": "델타항공"},
    {"iata": "QV", "icao": "LAO", "name": "라오항공"},
    {"iata": "AT", "icao": "RAM", "name": "로얄 에어 모로코"},
    {"iata": "LH", "icao": "DLH", "name": "루프트한자항공"},
    {"iata": "AE", "icao": "MDA", "name": "만다린항공"},
    {"iata": "MH", "icao": "MAS", "name": "말레이시아항공"},
    {"iata": "OM", "icao": "MGL", "name": "몽골항공"},
    {"iata": "9S", "icao": "SOO", "name": "미국남부화물항공"},
    {"iata": "VN", "icao": "HVN", "name": "베트남항공"},
    {"iata": "VJ", "icao": "VJC", "name": "비엣젯항공"},
    {"iata": "3U", "icao": "CSC", "name": "사천항공"},
    {"iata": "SC", "icao": "CDG", "name": "산동항공"},
    {"iata": "FM", "icao": "CSH", "name": "상하이항공"},
    {"iata": "5J", "icao": "CEB", "name": "세부퍼시픽항공"},
    {"iata": "6J", "icao": "SNJ", "name": "솔라시드 항공"},
    {"iata": "ZA", "icao": "SWM", "name": "스카이 앙코르 항공"},
    {"iata": "TR", "icao": "TGW", "name": "스쿠트타이거항공"},
    {"iata": "7L", "icao": "AZQ", "name": "실크웨이웨스트항공"},
    {"iata": "ZH", "icao": "CSZ", "name": "심천항공"},
    {"iata": "SQ", "icao": "SIA", "name": "싱가포르항공"},
    {"iata": "XO", "icao": "SGD", "name": "씨에어"},
    {"iata": "AA", "icao": "AAL", "name": "아메리칸항공"},
    {"iata": "OZ", "icao": "AAR", "name": "아시아나항공"},
    {"iata": "5Y", "icao": "GTI", "name": "아틀라스항공"},
    {"iata": "AZ", "icao": "AZA", "name": "알리탈리아 항공"},
    {"iata": "R3", "icao": "SYL", "name": "야쿠티아 항공"},
    {"iata": "Y8", "icao": "YZR", "name": "양쯔강익스프레스항공"},
    {"iata": "EK", "icao": "UAE", "name": "에미레이트항공"},
    {"iata": "BR", "icao": "EVA", "name": "에바항공"},
    {"iata": "NX", "icao": "AMU", "name": "에어 마카오"},
    {"iata": "UX", "icao": "AEA", "name": "에어 유로파"},
    {"iata": "AF", "icao": "AFR", "name": "에어 프랑스"},
    {"iata": "3S", "icao": "3SX", "name": "에어로로직"},
    {"iata": "SU", "icao": "AFL", "name": "에어로플로트항공"},
    {"iata": "RU", "icao": "ABW", "name": "에어브릿지"},
    {"iata": "RS", "icao": "ASV", "name": "에어서울"},
    {"iata": "KC", "icao": "KZR", "name": "에어아스타나"},
    {"iata": "Z2", "icao": "EZD", "name": "에어아시아 필리핀"},
    {"iata": "D7", "icao": "XAX", "name": "에어아시아엑스"},
    {"iata": "AI", "icao": "AIC", "name": "에어인디아"},
    {"iata": "KJ", "icao": "AIH", "name": "에어인천"},
    {"iata": "NQ", "icao": "AJX", "name": "에어재팬"},
    {"iata": "AC", "icao": "ACA", "name": "에어캐나다"},
    {"iata": "LD", "icao": "AHK", "name": "에어홍콩"},
    {"iata": "ET", "icao": "ETH", "name": "에티오피아항공"},
    {"iata": "EY", "icao": "ETD", "name": "에티하드 항공"},
    {"iata": "BA", "icao": "BAW", "name": "영국항공"},
    {"iata": "HZ", "icao": "SHU", "name": "오로라항공"},
    {"iata": "HY", "icao": "UZB", "name": "우즈베키스탄항공"},
    {"iata": "UA", "icao": "UAL", "name": "유나이티드항공"},
    {"iata": "B7", "icao": "UIA", "name": "유니항공"},
    {"iata": "5X", "icao": "UPS", "name": "유피에스항공"},
    {"iata": "ZE", "icao": "ESR", "name": "이스타항공"},
    {"iata": "JL", "icao": "JAL", "name": "일본항공"},
    {"iata": "7C", "icao": "JJA", "name": "제주항공"},
    {"iata": "9W", "icao": "JAI", "name": "제트 에어웨이즈"},
    {"iata": "CA", "icao": "CCA", "name": "중국국제항공"},
    {"iata": "CZ", "icao": "CSN", "name": "중국남방항공"},
    {"iata": "MU", "icao": "CES", "name": "중국동방항공"},
    {"iata": "CF", "icao": "CYZ", "name": "중국우정항공"},
    {"iata": "MF", "icao": "CXA", "name": "중국하문항공"},
    {"iata": "CK", "icao": "CKK", "name": "중국화물항공"},
    {"iata": "CI", "icao": "CAL", "name": "중화항공"},
    {"iata": "LJ", "icao": "JNA", "name": "진에어"},
    {"iata": "OK", "icao": "CSA", "name": "체코항공"},
    {"iata": "9C", "icao": "CQH", "name": "춘추항공"},
    {"iata": "CV", "icao": "CLX", "name": "카고룩스항공"},
    {"iata": "QR", "icao": "QTR", "name": "카타르항공"},
    {"iata": "K6", "icao": "VAV", "name": "캄보디아 앙코르 항공"},
    {"iata": "CX", "icao": "CPA", "name": "캐세이패시픽항공"},
    {"iata": "KL", "icao": "KLM", "name": "케이엘엠네덜란드항공"},
    {"iata": "QF", "icao": "QFA", "name": "콴타스항공"},
    {"iata": "XJ", "icao": "TAX", "name": "타이에어아시아엑스"},
    {"iata": "TG", "icao": "THA", "name": "타이항공"},
    {"iata": "TK", "icao": "THY", "name": "터키항공"},
    {"iata": "GS", "icao": "GCR", "name": "텐진 에어라인"},
    {"iata": "TW", "icao": "TWB", "name": "티웨이항공"},
    {"iata": "2P", "icao": "GAP", "name": "팔익스프레스 항공"},
    {"iata": "8Y", "icao": "AAP", "name": "팬퍼시픽항공"},
    {"iata": "FX", "icao": "FDX", "name": "페덱스"},
    {"iata": "PO", "icao": "PAC", "name": "폴라에어카고"},
    {"iata": "LO", "icao": "LOT", "name": "폴란드항공"},
    {"iata": "MM", "icao": "APJ", "name": "피치항공"},
    {"iata": "AY", "icao": "FIN", "name": "핀에어"},
    {"iata": "PR", "icao": "PAL", "name": "필리핀항공"},
    {"iata": "HA", "icao": "HAL", "name": "하와이안항공"},
    {"iata": "UO", "icao": "HKE", "name": "홍콩익스프레스항공"},
    {"iata": "HX", "icao": "CRK", "name": "홍콩항공"},
]

# Google Flights 등 영문 항공사명 → IATA (별첨 + 자주 쓰이는 별칭)
CARRIER_ALIASES: dict[str, str] = {
    "korean air": "KE",
    "korean": "KE",
    "asiana": "OZ",
    "asiana airlines": "OZ",
    "jeju air": "7C",
    "jin air": "LJ",
    "t'way": "TW",
    "tway": "TW",
    "tway air": "TW",
    "air busan": "BX",
    "peach": "MM",
    "peach aviation": "MM",
    "ana": "NH",
    "all nippon": "NH",
    "japan airlines": "JL",
    "china eastern": "MU",
    "china southern": "CZ",
    "air china": "CA",
    "eva air": "BR",
    "cathay pacific": "CX",
    "singapore airlines": "SQ",
    "emirates": "EK",
    "qatar airways": "QR",
    "turkish airlines": "TK",
    "united": "UA",
    "united airlines": "UA",
    "delta": "DL",
    "delta air lines": "DL",
    "american airlines": "AA",
    "british airways": "BA",
    "lufthansa": "LH",
    "air france": "AF",
    "vietjet": "VJ",
    "vietjet air": "VJ",
    "vietnam airlines": "VN",
    "thai airways": "TG",
    "airasia": "AK",
    "airasia x": "D7",
    "scoot": "TR",
    "air seoul": "RS",
    "eastar jet": "ZE",
    "air premia": "YP",
}


def find_airline_by_iata(iata: str) -> dict[str, str] | None:
    code = iata.strip().upper()
    for row in ICN_AIRLINE_CODES:
        if row["iata"] == code:
            return row
    return None


def find_airline_by_icao(icao: str) -> dict[str, str] | None:
    code = icao.strip().upper()
    for row in ICN_AIRLINE_CODES:
        if row["icao"] == code:
            return row
    return None


def resolve_carrier_to_iata(carrier: str) -> str | None:
    trimmed = carrier.strip()
    if not trimmed:
        return None
    if len(trimmed) == 2 and trimmed.isalpha():
        return trimmed.upper()
    if len(trimmed) == 3 and trimmed.isalpha():
        upper = trimmed.upper()
        if find_airline_by_iata(upper):
            return upper

    lowered = trimmed.lower()
    if lowered in CARRIER_ALIASES:
        return CARRIER_ALIASES[lowered]

    for alias, iata in CARRIER_ALIASES.items():
        if alias in lowered:
            return iata

    for row in ICN_AIRLINE_CODES:
        name = row["name"].lower()
        if name in lowered or lowered in name:
            return row["iata"]

    return None
