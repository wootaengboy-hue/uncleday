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

# ---- 🔍 경쟁사 분석 (job = 'site') : 사이트맵 · 글 제목 · 소제목만 읽어요. 글 내용은 저장하지 않아요 ----
import glob, time, xml.etree.ElementTree as ET
CITY_W = {"다낭": "danang", "danang": "danang", "나트랑": "nhatrang", "냐짱": "nhatrang", "nhatrang": "nhatrang", "호치민": "hcm", "호찌민": "hcm", "사이공": "hcm", "hcm": "hcm", "하노이": "hanoi", "hanoi": "hanoi", "호이안": "hoian", "hoian": "hoian"}
STOP = set("추천 총정리 정리 가이드 후기 베스트 best top 비교 안내 방법 꿀팁 팁 리뷰 소개 완벽 필수 모음 확인 예약 정보 최신 업데이트 버전 완전 꼭 가볼만한 the in of and for with 리스트 순위 장점 단점 실제 이용 솔직 내돈내산 및 및 및".split())
GENERIC = set("다낭 나트랑 냐짱 호치민 호찌민 하노이 호이안 베트남 발 전신 타이 아로마 핫스톤 커플 로컬 저렴한 고급 추천 한국인 한국어 가성비 호텔 마사지 스파 키즈 임산부 포핸드 건식 오일 스톤 두피 얼굴 바디 24시 시내 공항 근처 신상 최고의 인기 남자 여자 가족 풀빌라 리조트 1인 2인 단체 프리미엄 고급스러운 the best top cheap luxury local thai foot body oil hot stone couple danang hanoi saigon".split())
def kw_of(title):
    t = html.unescape(title or ""); t = re.split(r"\s[|·–—-]\s|\s:\s", t)[0]
    t = re.sub(r"\[[^\]]*\]|\([^)]*\)|20\d\d년?|TOP\s?\d+|\d+\s?(?:선|곳|가지|개)|[^\w\s가-힣]", " ", t, flags=re.I)
    return re.sub(r"\s+", " ", t).strip()
def toks(s): return [w for w in re.findall(r"[가-힣]+|[a-z]+", (s or "").lower()) if w not in STOP and len(w) > 1]
def city_of(ws): return next((CITY_W[w] for w in ws if w in CITY_W), None)
def our_pages():
    out = []
    for f in glob.glob("c/**/index.html", recursive=True) + glob.glob("s/*/index.html") + glob.glob("en/s/*/index.html") + glob.glob("p/*/*/index.html"):
        if "/vi/" in f: continue
        try: h = open(f, encoding="utf-8").read(3000)
        except Exception: continue
        m = re.search(r"<title>(.*?)</title>", h, re.S)
        if m: t = html.unescape(m.group(1)).split(" | ")[0]; out.append({"url": "/" + f[:-len("index.html")], "title": t, "toks": set(toks(t)), "city": (f.split("/")[1] if f.startswith(("c/", "p/")) else None) or city_of(toks(t))})
    return out
def norm(t): return re.sub(r"[^a-z0-9가-힣]", "", (t or "").lower().replace("đ", "d"))
SHOP_RX = [re.compile(r"([A-Z][A-Za-z0-9&'.]*(?:\s[A-Z0-9][A-Za-z0-9&'.]*){0,3}\s(?:Spa|SPA|Massage|MASSAGE|Nail|Nails|Salon|Beauty|Palace))\b"),
           re.compile(r"([가-힣A-Za-z]{2,10}\s?(?:스파|마사지|네일|살롱))")]
def shop_names(s):
    out = set()
    for rx in SHOP_RX:
        for m in rx.finditer(s or ""):
            n = m.group(1).strip(); ws = n.lower().split()
            first = re.sub(r"(스파|마사지|네일|살롱)$", "", ws[0]) if ws else ""
            if not first or first in GENERIC or ws[0] in GENERIC or len(norm(n)) < 4: continue
            if re.fullmatch(r"[가-힣]{1,3}", ws[0]) and re.search(r"(는|은|을|를|의|에서)$", ws[0]) and len(ws) > 1: continue   # '하는 마사지' 같은 말
            out.add(n)
    return out
def sitemaps(base):
    found = []
    try:
        req = urllib.request.Request(base + "/robots.txt", headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=15) as r: found += re.findall(r"(?im)^sitemap:\s*(\S+)", r.read(200_000).decode("utf-8", "ignore"))
    except Exception: pass
    return found + [base + p for p in ("/sitemap.xml", "/sitemap_index.xml", "/wp-sitemap.xml", "/post-sitemap.xml")]
def read_sitemap(u, seen, urls, depth=0):
    if u in seen or depth > 2 or len(seen) > 12 or not robots_ok(u): return
    seen.add(u)
    try:
        req = urllib.request.Request(u, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=20) as r: x = r.read(5_000_000)
        root = ET.fromstring(x)
    except Exception: return
    for el in root.iter():
        if el.tag.endswith("loc") and el.text:
            v = el.text.strip()
            if re.search(r"sitemap[^/]*\.xml", v): read_sitemap(v, seen, urls, depth + 1)
            elif len(urls) < 400: urls.append(v)
def analyze_site(job):
    u = job["url"]; why = host_ok(u)
    if why: return None, why
    p = urllib.parse.urlparse(u); base = f"{p.scheme}://{p.netloc}"
    if not robots_ok(base + "/"): return None, "이 사이트의 robots.txt 가 자동 수집을 막아 두어서 분석하지 않았어요"
    urls, seen = [], set()
    for sm in sitemaps(base):
        read_sitemap(sm, seen, urls)
        if urls: break
    urls = [v for v in dict.fromkeys(urls) if urllib.parse.urlparse(v).netloc == p.netloc and not re.search(r"/(category|tag|author|page)/|\.(jpg|png|webp|pdf)$", v)]
    if not urls: return None, "사이트맵(글 목록)을 찾지 못했어요"
    posts = []
    for v in urls:
        slug = urllib.parse.unquote(urllib.parse.urlparse(v).path.strip("/").split("/")[-1] or "")
        posts.append({"url": v, "title": slug.replace("-", " ") if re.search(r"[가-힣]", slug) else "", "heads": []})
    # 제목 · 소제목 (마사지 · 스파 관련 글 먼저, 40개까지, 1초 간격)
    pri = sorted(posts, key=lambda x: 0 if re.search(r"마사지|스파|massage|spa|nail|네일|이발|barber", urllib.parse.unquote(x["url"]), re.I) else 1)[:40]
    for x in pri:
        if not robots_ok(x["url"]): continue
        try:
            h, _ = fetch(x["url"]); pg = Page(); pg.feed(h)
            x["title"] = html.unescape(pg.meta.get("og:title") or pg.title or x["title"]).strip()[:150]
            x["heads"] = [re.sub(r"\s+", " ", l).strip()[:80] for l in re.findall(r"<h[23][^>]*>(.*?)</h[23]>", re.sub(r"<(script|style)[\s\S]*?</\1>", "", h), re.S | re.I)][:30]
            x["heads"] = [html.unescape(re.sub(r"<[^>]+>", "", t)).strip() for t in x["heads"] if t]
        except Exception: pass
        time.sleep(1)
    ours = our_pages()
    kws = {}
    for x in posts:
        k = kw_of(x["title"])
        if not k or len(toks(k)) < 2: continue
        kws.setdefault(k, []).append(x["url"])
    kw_out = []
    INTENT = {"가격", "요금", "비용", "price", "prices", "cost"}
    COMMON = {"한국어", "예약", "곳", "마사지", "스파", "피부관리", "뷰티", "시술별", "여행", "가이드", "가격", "업체", "정보", "massage", "spa", "beauty", "shops", "trusted", "guide", "prices", "booking"}
    cpages = [o for o in ours if o["url"].startswith(("/c/", "/en/c/"))]   # 검색어 페이지(도시 · 주제 · 가격 · 가이드)만 비교
    for k, us in kws.items():
        t = set(toks(k)); c = city_of(t); core = {w for w in t if w not in CITY_W and w not in INTENT} or t; best, sc = None, 0
        for o in cpages:
            if c and o["city"] != c: continue
            if not c and o["city"]: pass
            extra = o["toks"] - core - COMMON - set(CITY_W)
            s_ = len(core & o["toks"]) / max(1, len(core)) - 0.05 * len(extra)
            if s_ > sc: best, sc = o, s_
        kw_out.append({"kw": k, "n": len(us), "url": us[0], "city": c, "ours": best["url"] if best and sc >= 0.55 else None, "ours_title": best["title"] if best and sc >= 0.55 else None, "score": round(sc, 2)})
    kw_out.sort(key=lambda r: (r["ours"] is not None, -r["n"], r["kw"]))
    partners = {norm(re.split(r" - | — ", o["title"])[0]): o for o in ours if o["url"].startswith(("/s/", "/en/s/"))}
    for o in [o for o in ours if o["url"].startswith("/en/s/")]: partners[norm(re.split(r" — ", o["title"])[0].rsplit(" ", 2)[0])] = o
    unclaimed = {norm(re.split(r" — ", o["title"])[0]): o for o in ours if o["url"].startswith("/p/")}
    shops = {}
    for x in posts:
        for n in shop_names(" \n".join([x["title"]] + x["heads"])): shops.setdefault(n, set()).add(x["url"])
    sh_out = []
    for n, us in shops.items():
        full = norm(n); k = norm(re.sub(r"\s*(스파|마사지|네일|살롱|spa|massage|nail|salon)$", "", n, flags=re.I)) or full
        m_ = lambda kk: kk and (full == kk or (len(full) >= 5 and (kk.startswith(full) or full.startswith(kk))) or (len(k) >= 2 and kk.startswith(k) and len(kk) - len(k) <= (2 if re.search(r"[가-힣]", k) else 4) and (len(k) >= 3 or re.search(r"[가-힣]", k))))
        hit = next((o for kk, o in partners.items() if m_(kk)), None)
        hu = None if hit else next((o for kk, o in unclaimed.items() if m_(kk)), None)
        sh_out.append({"name": n, "n": len(us), "url": sorted(us)[0], "status": "partner" if hit else "unclaimed" if hu else "none", "ours": (hit or hu or {}).get("url")})
    sh_out.sort(key=lambda r: ({"none": 0, "unclaimed": 1, "partner": 2}[r["status"]], -r["n"]))
    res = {"site": base, "posts": len(posts), "read": len([x for x in pri if x["heads"] or x["title"]]), "keywords": kw_out[:300], "shops": sh_out[:150], "name": p.netloc}
    return res, None

if __name__ == "__main__":
    tok = os.environ.get("CRAWL_TOKEN", "").strip()
    if not tok: print("CRAWL_TOKEN 이 없어서 링크 가져오기를 건너뛰어요"); sys.exit(0)
    try: jobs = rpc("crawl_pending", {"tok": tok}) or []
    except Exception as e: print("링크 목록을 못 읽었어요 (universe21.sql · 수집 열쇠 확인):", e); sys.exit(0)
    print("가져올 링크", len(jobs), "개")
    for j in jobs:
        try: res, err = analyze_site(j) if j.get("job") == "site" else crawl(j)
        except Exception as e: res, err = None, f"알 수 없는 오류: {e}"
        try: rpc("crawl_result", {"tok": tok, "job": j["id"], "res": res, "error": err or ""})
        except Exception as e: print("결과 저장 실패", j["id"], e)
        print(j["id"], j["url"], "→", err or (f"글 {res.get('posts')}개 · 검색어 {len(res.get('keywords') or [])}개 · 가게 {len(res.get('shops') or [])}곳" if j.get("job") == "site" else f"{res.get('name')} · 메뉴 {len(res.get('menu') or [])}개"))
