"""🔗 링크로 가게 가져오기 — 수집기 (깃허브 자동 작업이 매시간 실행)
   포털에 들어온 링크를 읽어서 '사실 정보'만 뽑아요: 가게 이름 · 주소 · 영업시간 · 위치 · 메뉴 이름과 가격.
   글 내용 · 사진은 가져오지 않아요 (저작권). 결과는 관리자가 포털에서 확인한 뒤에만 게시돼요.
   지키는 것:
     - robots.txt 가 막은 곳은 가져오지 않아요.
     - 약관으로 수집을 금지한 큰 사이트(구글 지도 · 페이스북 · 인스타그램 · 네이버 카페 · 트립어드바이저 · 클룩 …)는 막아요.
     - 같은 사이트 안의 '메뉴 · 가격' 링크 2개까지만 더 봐요. 한 페이지 2MB 까지.
   필요한 값 (깃허브 Secrets): CRAWL_TOKEN — 포털 '🔗 링크로 가게 가져오기'에서 만든 수집 열쇠
   사용: CRAWL_TOKEN=... python3 tools/crawl.py   (열쇠가 없으면 아무것도 안 하고 끝나요)"""
import html, ipaddress, json, os, re, socket, sys, urllib.parse, urllib.request, urllib.robotparser
from html.parser import HTMLParser

UA = "UncleDayBot/1.0 (+https://www.uncleday.com)"
BLOCK = re.compile(r"(^|\.)(google\.[a-z.]+|goo\.gl|facebook\.com|fb\.com|instagram\.com|tiktok\.com|cafe\.naver\.com|map\.naver\.com|tripadvisor\.[a-z.]+|klook\.com|kkday\.com|agoda\.com|booking\.com|traveloka\.com|trip\.com|myrealtrip\.com|yanolja\.com|zalo\.me|kakao\.com|youtube\.com)$", re.I)
ALLOW_LOCAL = os.environ.get("CRAWL_ALLOW_LOCAL") == "1"   # 테스트용

def load_cfg():
    js = open("config.js", encoding="utf-8").read()
    url = re.search(r"url:\s*['\"]([^'\"]+)", js).group(1); key = re.search(r"(?:anonKey|key):\s*['\"]([^'\"]+)", js).group(1)
    return os.environ.get("SUPA_URL", url), os.environ.get("SUPA_KEY", key)

def rpc(name, body):
    url, key = load_cfg()
    h = {"apikey": key, "Content-Type": "application/json"}
    if key.startswith("eyJ"): h["Authorization"] = "Bearer " + key
    req = urllib.request.Request(f"{url}/rest/v1/rpc/{name}", data=json.dumps(body).encode(), headers=h)
    with urllib.request.urlopen(req, timeout=30) as r: return json.loads(r.read() or b"null")

def host_ok(u):
    p = urllib.parse.urlparse(u)
    if p.scheme not in ("http", "https") or not p.hostname: return "링크 형식이 이상해요"
    if BLOCK.search(p.hostname): return f"{p.hostname} 는 약관상 자동 수집이 금지된 사이트라 가져오지 않아요"
    if ALLOW_LOCAL: return None
    try:
        for fam, _, _, _, sa in socket.getaddrinfo(p.hostname, None):
            ip = ipaddress.ip_address(sa[0])
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved: return "내부 주소는 가져올 수 없어요"
    except Exception: return "사이트 주소를 찾을 수 없어요"
    return None

ROBOTS = {}
def robots_ok(u):
    p = urllib.parse.urlparse(u); base = f"{p.scheme}://{p.netloc}"
    if base not in ROBOTS:
        rp = urllib.robotparser.RobotFileParser()
        try:
            req = urllib.request.Request(base + "/robots.txt", headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=15) as r: rp.parse(r.read(200_000).decode("utf-8", "ignore").splitlines())
        except urllib.error.HTTPError as e:
            rp.parse([] if e.code in (404, 410) else ["User-agent: *", "Disallow: /"])   # 없으면 허용, 접근 거부면 막힌 걸로
        except Exception: rp.parse([])
        ROBOTS[base] = rp
    return ROBOTS[base].can_fetch(UA, u)

def fetch(u):
    req = urllib.request.Request(u, headers={"User-Agent": UA, "Accept": "text/html,application/xhtml+xml", "Accept-Language": "vi,ko;q=0.9,en;q=0.8"})
    with urllib.request.urlopen(req, timeout=25) as r:
        if "html" not in (r.headers.get("Content-Type") or "html"): raise ValueError("웹페이지(HTML)가 아니에요")
        raw = r.read(2_000_000); cs = r.headers.get_content_charset() or "utf-8"
        return raw.decode(cs, "ignore"), r.geturl()

BLOCKS = {"p", "div", "li", "tr", "br", "h1", "h2", "h3", "h4", "h5", "h6", "section", "article", "table", "ul", "ol", "header", "footer", "dt", "dd"}
class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True); self.lines = [""]; self.skip = 0; self.ld = []; self.inld = False; self.meta = {}; self.title = ""; self.intitle = False; self.h1 = ""; self.inh1 = False; self.links = []; self.a = None
    def handle_starttag(self, t, a):
        a = dict(a)
        if t in ("script", "style", "noscript", "svg"):
            self.skip += 1; self.inld = t == "script" and (a.get("type") or "").lower() == "application/ld+json"
            if self.inld: self.ld.append("")
        if t == "meta" and a.get("content"): self.meta[(a.get("property") or a.get("name") or "").lower()] = a["content"]
        if t == "title": self.intitle = True
        if t == "h1": self.inh1 = True
        if t == "a" and a.get("href"): self.a = [a["href"], ""]
        if t in BLOCKS: self.lines.append("")
        if t in ("td", "th"): self.lines[-1] += " | "
    def handle_endtag(self, t):
        if t in ("script", "style", "noscript", "svg"): self.skip = max(0, self.skip - 1); self.inld = False
        if t == "title": self.intitle = False
        if t == "h1": self.inh1 = False
        if t == "a" and self.a: self.links.append(tuple(self.a)); self.a = None
        if t in BLOCKS: self.lines.append("")
    def handle_data(self, d):
        if self.inld: self.ld[-1] += d; return
        if self.skip: return
        if self.intitle: self.title += d
        if self.inh1: self.h1 += d
        if self.a is not None: self.a[1] += d
        self.lines[-1] += d

def walk(o):
    if isinstance(o, list):
        for x in o: yield from walk(x)
    elif isinstance(o, dict):
        yield o
        for v in o.values(): yield from walk(v)

BIZ = re.compile(r"Business|Spa|Salon|Store|Massage|Beauty|Health|Clinic|Physician|Hotel|Place|Organization", re.I)
PRICE = re.compile(r"(?<![\d.,])(\d{1,3}(?:[.,]\d{3})+|\d{2,7})\s*(k\b|K\b|nghìn|ngàn|VND|VNĐ|vnđ|vnd|đ|₫|동)", re.U)
DUR = re.compile(r"(\d{2,3})\s*(?:phút|phut|min|mins|minutes|분|')", re.I)
HOURS = re.compile(r"(\d{1,2})\s*[:hH.]\s*(\d{2})?\s*(?:am|AM|pm|PM)?\s*[-–~đến to]+\s*(\d{1,2})\s*[:hH.]\s*(\d{2})?\s*(?:am|AM|pm|PM)?")
ADDR = re.compile(r"(^|\s)(\d+[A-Za-z/]*\d*\s+[^|\n]{4,90}?(?:Đường|đường|Đ\.|Phường|P\.|Quận|Q\.|Street|St\.|Ward|District|Đà Nẵng|Da Nang|Nha Trang|Hồ Chí Minh|Ho Chi Minh|Hà Nội|Ha Noi|Hội An|Hoi An)[^|\n]{0,80})")
def to_vnd(n, unit):
    v = int(re.sub(r"[.,]", "", n)); u = unit.lower()
    if u in ("k", "nghìn", "ngàn") or v < 1000: v *= 1000
    return v if 20_000 <= v <= 100_000_000 else 0

def extract(text_lines, pg, url):
    out = {"name": "", "address": "", "hours": "", "geo": None, "menu": [], "title": html.unescape(pg.title.strip())[:150], "source": url}
    for raw in pg.ld:   # 1) 구조화 데이터 (가장 정확해요)
        try: data = json.loads(raw.strip())
        except Exception: continue
        for o in walk(data):
            ty = o.get("@type"); ty = " ".join(ty) if isinstance(ty, list) else str(ty or "")
            if BIZ.search(ty) and not out["name"] and isinstance(o.get("name"), str): out["name"] = o["name"].strip()
            ad = o.get("address")
            if BIZ.search(ty) and ad and not out["address"]:
                out["address"] = ad if isinstance(ad, str) else ", ".join(str(ad.get(k)) for k in ("streetAddress", "addressLocality", "addressRegion") if ad.get(k))
            g = o.get("geo")
            if isinstance(g, dict) and g.get("latitude") and not out["geo"]:
                try: out["geo"] = [round(float(g["latitude"]), 6), round(float(g["longitude"]), 6)]
                except Exception: pass
            oh = o.get("openingHours")
            if oh and not out["hours"]: out["hours"] = oh if isinstance(oh, str) else "; ".join(map(str, oh))
            if ty in ("Offer", "MenuItem", "Product", "Service") and o.get("name"):
                pr = o.get("price") or (o.get("offers") or {}).get("price") if isinstance(o.get("offers"), (dict, type(None))) else o.get("price")
                try:
                    p = int(float(str(pr).replace(",", ""))) if pr else 0
                    if 20_000 <= p <= 100_000_000: out["menu"].append({"name": str(o["name"])[:80], "price": p, "min": 0})
                except Exception: pass
    if not out["name"]:   # 2) 메타 정보 · 제목
        out["name"] = (pg.meta.get("og:site_name") or html.unescape(pg.h1.strip()) or out["title"].split("|")[0].split(" - ")[0]).strip()[:80]
    txt = "\n".join(text_lines)
    if not out["address"]:
        m = ADDR.search(txt); out["address"] = re.sub(r"\s+", " ", m.group(2)).strip(" ,|")[:150] if m else ""
    if not out["hours"]:
        m = HOURS.search(txt)
        if m and int(m.group(1)) <= 24 and int(m.group(3)) <= 24: out["hours"] = f"{int(m.group(1)):02d}:{(m.group(2) or '00')}-{int(m.group(3)):02d}:{(m.group(4) or '00')}"
    if len(out["menu"]) < 3: out["menu"] += menu_from_text(text_lines)
    seen, mm = set(), []
    for m in out["menu"]:
        k = (m["name"].lower(), m["price"])
        if k not in seen and m["name"]: seen.add(k); mm.append(m)
    out["menu"] = mm[:40]
    return out

def menu_from_text(lines):   # 3) 글에서 '메뉴 이름 … 가격' 줄 찾기
    out = []
    for ln in lines:
        ln = re.sub(r"\s+", " ", ln).strip()
        if not ln or len(ln) > 160: continue
        ps = list(PRICE.finditer(ln))
        if not ps: continue
        name = ln[:ps[0].start()].strip(" :-–|.·•*").strip()
        name = re.sub(r"^\|\s*", "", name).split(" | ")[-1].strip() if " | " in name else name
        if not (2 <= len(name) <= 80) or re.fullmatch(r"[\d\s.,:-]+", name): continue
        p = to_vnd(ps[0].group(1), ps[0].group(2))
        if not p: continue
        d = DUR.search(ln); out.append({"name": name, "price": p, "min": int(d.group(1)) if d else 0})
    return out

MENU_LINK = re.compile(r"menu|price|pricing|bang-?gia|bảng giá|bang gia|dich-?vu|dịch vụ|service|gia-|/gia|요금|가격|메뉴", re.I)
def crawl(job):
    u = job["url"]; why = host_ok(u)
    if why: return None, why
    if not robots_ok(u): return None, "이 사이트의 robots.txt 가 자동 수집을 막아 두어서 가져오지 않았어요"
    try: h, final = fetch(u)
    except Exception as e: return None, f"페이지를 열지 못했어요: {e}"
    pg = Page(); pg.feed(h); res = extract(pg.lines, pg, final); res["pages"] = [final]
    host = urllib.parse.urlparse(final).netloc; more = []
    for href, label in pg.links:   # 같은 사이트의 메뉴 · 가격 페이지 2개까지
        v = urllib.parse.urljoin(final, href.strip()); pv = urllib.parse.urlparse(v)
        if pv.netloc == host and pv.scheme in ("http", "https") and v not in more and v != final and MENU_LINK.search(v + " " + label): more.append(v.split("#")[0])
    for v in more[:2]:
        if not robots_ok(v): continue
        try:
            h2, f2 = fetch(v); p2 = Page(); p2.feed(h2); add = menu_from_text(p2.lines)
            if add: res["menu"] = (res["menu"] + add)[:40]; res["pages"].append(f2)
        except Exception: pass
    blob = (res.get("address") or "") + " " + (res.get("title") or "") + " " + final
    for cid, pat in (("danang", r"Đà Nẵng|Da Nang|Danang|Ngũ Hành Sơn|Sơn Trà|Hải Châu"), ("nhatrang", r"Nha Trang|Khánh Hòa|Khanh Hoa"), ("hcm", r"Hồ Chí Minh|Ho Chi Minh|HCM|Sài Gòn|Saigon|Quận \d|District \d"), ("hanoi", r"Hà Nội|Ha Noi|Hanoi|Hoàn Kiếm|Ba Đình|Tây Hồ")):
        if re.search(pat, blob, re.I): res["city_guess"] = cid; break
    if not res["name"] and not res["menu"]: return res, "가게 정보를 찾지 못했어요 (글자가 아닌 그림으로 된 페이지일 수 있어요)"
    return res, None

if __name__ == "__main__":
    tok = os.environ.get("CRAWL_TOKEN", "").strip()
    if not tok: print("CRAWL_TOKEN 이 없어서 링크 가져오기를 건너뛰어요"); sys.exit(0)
    try: jobs = rpc("crawl_pending", {"tok": tok}) or []
    except Exception as e: print("링크 목록을 못 읽었어요 (universe21.sql · 수집 열쇠 확인):", e); sys.exit(0)
    print("가져올 링크", len(jobs), "개")
    for j in jobs:
        try: res, err = crawl(j)
        except Exception as e: res, err = None, f"알 수 없는 오류: {e}"
        try: rpc("crawl_result", {"tok": tok, "job": j["id"], "res": res, "error": err or ""})
        except Exception as e: print("결과 저장 실패", j["id"], e)
        print(j["id"], j["url"], "→", err or f"{res.get('name')} · 메뉴 {len(res.get('menu') or [])}개")
