"""미입점 업체 기초 자료: 오픈스트리트맵(OpenStreetMap)의 공개 지도 정보에서 4개 도시의 마사지 · 스파 · 네일 · 뷰티 가게를 가져와요.
   - 라이선스: ODbL. 쓰는 곳마다 '© OpenStreetMap contributors' 출처를 꼭 밝혀요.
   - 이름 · 주소 · 영업시간 · 위치만 써요. 전화번호 · 웹사이트 · 사진은 가져오지 않아요.
   - 일주일에 한 번만 새로 받아요 (Overpass 서버에 부담을 주지 않게). 실패하면 지난번 자료를 그대로 써요.
   사용: python3 tools/osm-fetch.py [--force]"""
import json, os, sys, time, urllib.request, urllib.parse, datetime

OUT = "data/osm.json"
BBOX = {  # 남, 서, 북, 동
    "danang": (15.95, 108.12, 16.13, 108.30),
    "nhatrang": (12.17, 109.16, 12.30, 109.23),
    "hcm": (10.70, 106.60, 10.86, 106.78),
    "hanoi": (20.98, 105.78, 21.09, 105.88),
}
ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]
KEEP = ["name", "name:en", "name:ko", "name:vi", "shop", "leisure", "amenity", "beauty", "massage",
        "addr:housenumber", "addr:street", "addr:subdistrict", "addr:district", "addr:suburb", "addr:city", "opening_hours"]

def fresh():
    if "--force" in sys.argv or not os.path.exists(OUT): return False
    try:
        o = json.load(open(OUT)); t = o.get("fetched", "")
        if any(not o.get("cities", {}).get(c) for c in BBOX): return False  # 지난번에 못 받은 도시가 있으면 다시
        return datetime.datetime.fromisoformat(t) > datetime.datetime.utcnow() - datetime.timedelta(days=7)
    except Exception: return False

def q(b):
    s, w, n, e = b; bb = f"({s},{w},{n},{e})"
    sel = "".join(f'nwr["{k}"="{v}"]{bb};' for k, v in [("shop", "massage"), ("leisure", "spa"), ("amenity", "spa"), ("shop", "beauty"), ("amenity", "massage"), ("leisure", "sauna")])
    return f"[out:json][timeout:60];({sel});out center tags;"

def fetch(b):
    data = urllib.parse.urlencode({"data": q(b)}).encode()
    for ep in ENDPOINTS + ENDPOINTS[:1]:
        try:
            req = urllib.request.Request(ep, data=data, headers={"User-Agent": "uncleday-osm/1.0 (+https://www.uncleday.com)"})
            with urllib.request.urlopen(req, timeout=90) as r: return json.load(r)["elements"]
        except Exception as ex: print("OSM 실패", ep, ex); time.sleep(5)
    return None

if fresh(): print("OSM 자료가 아직 최신이에요 (7일 안)"); sys.exit(0)
old = json.load(open(OUT)) if os.path.exists(OUT) else {"cities": {}}
out = {"fetched": datetime.datetime.utcnow().replace(microsecond=0).isoformat(), "license": "© OpenStreetMap contributors, ODbL 1.0", "cities": {}}
for cid, b in BBOX.items():
    els = fetch(b)
    if els is None: out["cities"][cid] = old.get("cities", {}).get(cid, []); continue
    rows = []
    for e in els:
        tg = e.get("tags") or {}
        if not tg.get("name"): continue
        lat = e.get("lat") or (e.get("center") or {}).get("lat"); lon = e.get("lon") or (e.get("center") or {}).get("lon")
        if lat is None: continue
        rows.append({"id": f"{e['type'][0]}{e['id']}", "lat": round(lat, 6), "lon": round(lon, 6), "tags": {k: tg[k] for k in KEEP if k in tg}})
    out["cities"][cid] = sorted(rows, key=lambda r: r["id"]); print(cid, len(rows), "곳"); time.sleep(3)
os.makedirs("data", exist_ok=True)
json.dump(out, open(OUT, "w"), ensure_ascii=False, indent=0)
