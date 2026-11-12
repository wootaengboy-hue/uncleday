"""공유 미리보기 만들기 2단계: 업체마다
   s/<id>/index.html (카톡·네이버가 읽는 미리보기 정보) 과 og/<id>.jpg (1200x630 미리보기 그림)을 만들어요.
   사용: python3 tools/share-build.py share.json"""
import json, sys, os, io, html, hashlib, re, urllib.request, shutil
from PIL import Image, ImageDraw, ImageFont, ImageFilter

SITE = "https://www.uncleday.com"
W, H = 1200, 630
d = json.load(open(sys.argv[1]))
FONT_DIRS = ["/usr/share/fonts/opentype/noto", "/usr/share/fonts/opentype/noto-cjk", "/usr/share/fonts/noto-cjk"]
def font(weight, size):
    for w in (weight, "Bold", "Regular"):   # 기본 설치에는 Bold·Regular 만 있을 수 있어요
        for dr in FONT_DIRS:
            p = os.path.join(dr, f"NotoSansCJK-{w}.ttc")
            if os.path.exists(p): return ImageFont.truetype(p, size, index=1)  # 1 = KR
    raise SystemExit("Noto Sans CJK 글꼴이 없어요")
tx = lambda v: (v.get("ko") or v.get("en") or "") if isinstance(v, dict) else (v or "")
cats = {}
for c in d["categories"]:   # 사이트 묶음 카테고리: 세부 카테고리 값도 묶음으로 찾아가게
    cats[c["id"]] = c
    for m in c.get("members", []): cats.setdefault(m, c)
cities = {c["id"]: c for c in d["cities"]}

def load(src):
    if not src: return None
    try:
        if src.startswith("http"):
            with urllib.request.urlopen(urllib.request.Request(src, headers={"User-Agent": "uncleday-share"}), timeout=20) as r: return Image.open(io.BytesIO(r.read())).convert("RGB")
        p = src.lstrip("/")
        return Image.open(p).convert("RGB") if os.path.exists(p) else None
    except Exception as e:
        print("사진 못 읽음", src, e); return None

def cover(im, w, h, pos="50% 50%"):
    sc = max(w / im.width, h / im.height); im = im.resize((round(im.width * sc), round(im.height * sc)), Image.LANCZOS)
    try: px, py = [float(v.strip("%")) / 100 for v in pos.split()]
    except Exception: px = py = .5
    x = round((im.width - w) * px); y = round((im.height - h) * py)
    return im.crop((x, y, x + w, y + h))

def fit(draw, text, weight, size, maxw, minsize=34):
    while size > minsize:
        f = font(weight, size)
        if draw.textlength(text, font=f) <= maxw: return f, text
        size -= 4
    f = font(weight, minsize)
    while draw.textlength(text + "…", font=f) > maxw and len(text) > 1: text = text[:-1]
    return f, text + "…"

LOGO = Image.open("images/logo-og.png").convert("RGBA")   # 배경 투명 + 흰 글씨 로고
def card(shop, bgsrc):
    bg = load(bgsrc) or Image.new("RGB", (W, H), "#FAF3E0")
    im = cover(bg, W, H, shop.get("imgPos") or "50% 50%")
    # 왼쪽이 어두워지는 그라데이션
    g = Image.new("L", (W, 1)); [g.putpixel((x, 0), int(225 * max(0, 1 - x / (W * .78)) ** 1.15)) for x in range(W)]
    g = g.resize((W, H)); shade = Image.new("RGB", (W, H), (14, 26, 22))
    im = Image.composite(shade, im, g)
    dr = ImageDraw.Draw(im)
    cat = cats.get(shop.get("cat"), {}); city = cities.get(shop.get("city"), {})
    pill = " · ".join(x for x in [tx(city.get("name")), tx(cat.get("name"))] if x)
    pf = font("Bold", 30); x0, y = 70, 150
    if pill:
        tw = dr.textlength(pill, font=pf)
        dr.rounded_rectangle((x0, y, x0 + tw + 44, y + 54), 27, fill=(255, 255, 255))
        dr.text((x0 + 22, y + 27), pill, font=pf, fill=(17, 98, 65), anchor="lm")
    name = tx(shop.get("name")); en = (shop.get("name") or {}).get("en", "") if isinstance(shop.get("name"), dict) else ""
    nf, name = fit(dr, name, "Black", 84, W * .62)
    dr.text((x0, y + 90), name, font=nf, fill="white", anchor="lt")
    if en and en != tx(shop.get("name")):
        ef, en = fit(dr, en, "Medium", 38, W * .62, 26)
        dr.text((x0, y + 90 + nf.size + 26), en, font=ef, fill=(235, 235, 230), anchor="lt")
    # 아래: 로고 + 문구
    lg = LOGO.copy(); lg.thumbnail((300, 128)); bx, by = x0, H - 70 - lg.height
    sh = Image.new("RGBA", im.size, (0, 0, 0, 0)); sa = lg.getchannel("A").point(lambda v: v * 0.55)
    sh.paste(Image.new("RGBA", lg.size, (0, 0, 0, 255)), (bx + 2, by + 3), sa); sh = sh.filter(ImageFilter.GaussianBlur(5))
    im = Image.alpha_composite(im.convert("RGBA"), sh); im.alpha_composite(lg, (bx, by)); im = im.convert("RGB"); dr = ImageDraw.Draw(im)
    dr.text((bx + lg.width + 36, by + lg.height / 2), "한국어 상담 · 추가 요금 없이 예약", font=font("Bold", 30), fill="white", anchor="lm")
    return im

def esc(s): return html.escape(s or "", quote=True)
# 업체 페이지 틀: shop.html 을 그대로 가져와서 업체별 제목·설명·구조화 데이터·본문을 채워요 (검색엔진용)
TPL = open("shop.html", encoding="utf-8").read()
SCHEMA_TYPE = {"massage": "DaySpa", "spa": "DaySpa", "skin": "BeautySalon", "hair": "HairSalon", "nail": "NailSalon",
               "derma": "MedicalClinic", "surgery": "MedicalClinic", "dental": "Dentist", "body": "HealthAndBeautyBusiness"}
DAYS_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
DAYS_KO = ["일", "월", "화", "수", "목", "금", "토"]
CITY_EN = {"danang": "Da Nang", "nhatrang": "Nha Trang", "hcm": "Ho Chi Minh City", "hanoi": "Hanoi"}
def lang(v, k): return (v.get(k) or "") if isinstance(v, dict) else (v or "")
# ---- GEO 기초: AI · 검색엔진이 그대로 인용하기 좋은 '사실 문장'을 만들어요 (우리가 확인한 정보만) ----
SUB_KO = {"massage": "마사지", "spa": "스파 · 바디케어", "skin": "피부관리", "derma": "피부과 시술", "surgery": "성형 · 윤곽", "nail": "네일 · 속눈썹",
          "hair": "헤어", "body": "제모 · 체형", "dental": "치과", "package": "패키지"}
SUB_EN = {"massage": "massage shop", "spa": "spa", "skin": "skin care salon", "derma": "dermatology clinic", "surgery": "cosmetic surgery clinic",
          "nail": "nail & lash salon", "hair": "hair salon", "body": "body care salon", "dental": "dental clinic", "package": "beauty package"}
BUILT = __import__("datetime").date.today().isoformat()
NOUN_KO = {"massage": "마사지 숍", "spa": "스파", "skin": "피부관리 숍", "derma": "피부과", "surgery": "성형외과", "nail": "네일 · 속눈썹 숍",
           "hair": "헤어 숍", "body": "바디케어 숍", "dental": "치과", "package": "뷰티 패키지 업체"}
def iye(w):  # 받침 있으면 '이에요', 없으면 '예요'
    c = w[-1]; return "이에요" if "가" <= c <= "힣" and (ord(c) - 0xAC00) % 28 else "예요"
def checked(shop): return (shop.get("_updated") or BUILT)[:10]
def prices(shop): return sorted({int(m["price"]) for m in (shop.get("menu") or []) if isinstance(m.get("price"), (int, float)) and m["price"] > 0})
def won(n): return f"{n:,}동"
# 마사지 · 스파 가격만 (네일 · 페디 같은 다른 메뉴는 빼요)
MASSAGE_RX = re.compile(r"마사지|스파|스크럽|사우나|찜질|패키지|massage|spa", re.I)
NOT_MASSAGE_RX = re.compile(r"네일|페디|nail|pedi|왁싱", re.I)
def is_massage(m): n = tx(m.get("name")); return bool(MASSAGE_RX.search(n)) and not NOT_MASSAGE_RX.search(n)
def mprices(shop): return sorted({int(m["price"]) for m in (shop.get("menu") or []) if is_massage(m) and isinstance(m.get("price"), (int, float)) and m["price"] > 0})
def facts(shop):
    """한 줄 요약 · 영어 요약 · 자주 묻는 질문 (모두 업체 데이터에서만)"""
    city = cities.get(shop.get("city"), {}); cko = tx(city.get("name")); cen = CITY_EN.get(shop.get("city"), lang(city.get("name"), "en"))
    sub = shop.get("cat"); name = tx(shop.get("name")); en = lang(shop.get("name"), "en") or name
    menu = [m for m in (shop.get("menu") or []) if tx(m.get("name"))]; pr = prices(shop)
    tags = [tx(t) for t in (shop.get("tags") or []) if tx(t)]
    noun = NOUN_KO.get(sub, "뷰티 업체")
    ko = f"{cko}에 있는 {noun}{iye(noun)}."
    if menu: ko += f" 메뉴는 {tx(menu[0]['name'])}{' 등 ' + str(len(menu)) + '가지' if len(menu) > 1 else ''}이고"
    if pr: ko += (", " if menu else " ") + f"가격은 {won(pr[0])}부터예요 (엉클데이 확인 참고가)."
    elif menu: ko += ", 가격은 상담할 때 안내해 드려요."
    if tags: ko += f" 특징: {', '.join(tags[:3])}."
    ko += " 엉클데이에서 한국어로 상담하고, 추가 요금 없이 매장 가격 그대로 예약할 수 있어요."
    en_s = f"{en} is a {SUB_EN.get(sub, 'beauty business')} in {cen}, Vietnam."
    if pr: en_s += f" Prices start from {pr[0]:,} VND (reference price checked by Uncle Day)."
    en_s += " Book through Uncle Day with Korean-language support at the shop's own price — no extra fee."
    faq = [("엉클데이에서 한국어로 예약할 수 있나요?", "네. 엉클데이 사이트의 채팅이나 카카오톡으로 한국어 상담 후 예약할 수 있어요. 엉클데이가 매장에 확인한 뒤 예약을 확정해 드려요."
            + (" 매장에도 " + ", ".join({"ko": "한국어", "en": "영어", "vi": "베트남어"}.get(l, l) for l in shop["staffLangs"]) + "가 되는 직원이 있어요." if shop.get("staffLangs") else ""))]
    if pr: faq.append((f"{name} 가격은 얼마예요?", f"엉클데이가 확인한 참고가는 {won(pr[0])}부터{(' ' + won(pr[-1]) + '까지') if len(pr) > 1 else ''}예요. 엉클데이를 통해 예약해도 매장 가격과 같고 추가 요금은 없어요."))
    else: faq.append((f"{name} 가격은 얼마예요?", "메뉴별 가격은 상담할 때 안내해 드려요. 엉클데이를 통해 예약해도 매장 가격과 같고 추가 요금은 없어요."))
    if shop.get("open") and shop.get("close"):
        cl = shop.get("closed") or []
        faq.append(("영업시간은 어떻게 되나요?", f"{shop['open']}부터 {shop['close']}까지 영업해요" + (f" (휴무: {', '.join(DAYS_KO[d] + '요일' for d in cl)})." if cl else ".")))
    addr = tx(shop.get("address"))
    if addr and not re.search(r"확인 중|to be confirmed", addr, re.I): faq.append(("위치는 어디예요?", f"{cko} {addr}에 있어요."))
    faq.append(("결제는 어떻게 하나요?", "시술을 받은 뒤 매장에서 직접 결제해요. 엉클데이에 따로 내는 돈은 없어요."))
    return ko, en_s, faq
def build_page(shop, sid, title, desc, url, img):
    cat = cats.get(shop.get("cat"), {}); city = cities.get(shop.get("city"), {})
    name = tx(shop.get("name")); en = lang(shop.get("name"), "en")
    addr_ko = tx(shop.get("address")); addr_vi = lang(shop.get("address"), "vi") or lang(shop.get("address"), "en")
    addr_ok = addr_ko and not re.search(r"확인 중|to be confirmed", addr_ko, re.I)
    menu = [m for m in (shop.get("menu") or []) if tx(m.get("name"))]
    closed = shop.get("closed") or []
    hours = f"{shop['open']} ~ {shop.get('close', '')}" + (f" (휴무: {', '.join(DAYS_KO[d] for d in closed)})" if closed else "") if shop.get("open") else ""
    langs = {"ko": "한국어", "en": "영어", "vi": "베트남어"}
    # 구조화 데이터 (schema.org) — 구글 정보는 넣지 않고 우리가 확인한 정보만
    ld = {"@context": "https://schema.org", "@type": SCHEMA_TYPE.get(shop.get("cat"), "HealthAndBeautyBusiness"),
          "name": name, "url": url, "image": img, "description": re.sub(r"\s+", " ", tx(shop.get("desc"))).strip() or desc}
    if en and en != name: ld["alternateName"] = en
    if addr_ok: ld["address"] = {"@type": "PostalAddress", "streetAddress": addr_vi or addr_ko, "addressLocality": CITY_EN.get(shop.get("city"), ""), "addressCountry": "VN"}
    if shop.get("geo"): ld["geo"] = {"@type": "GeoCoordinates", "latitude": shop["geo"][0], "longitude": shop["geo"][1]}
    if shop.get("open") and shop.get("close"):
        ld["openingHoursSpecification"] = [{"@type": "OpeningHoursSpecification", "dayOfWeek": [DAYS_EN[d] for d in range(7) if d not in closed], "opens": shop["open"], "closes": shop["close"]}]
    if shop.get("staffLangs"): ld["knowsLanguage"] = shop["staffLangs"]
    pr = prices(shop)
    if pr: ld["priceRange"] = f"{pr[0]:,}–{pr[-1]:,} VND" if len(pr) > 1 else f"from {pr[0]:,} VND"
    ld["currenciesAccepted"] = "VND"
    offers = [{"@type": "Offer", "name": tx(m["name"]), "price": int(m["price"]), "priceCurrency": "VND"} for m in menu if isinstance(m.get("price"), (int, float)) and m["price"] > 0]
    if offers: ld["hasOfferCatalog"] = {"@type": "OfferCatalog", "name": "메뉴", "itemListElement": offers}
    sum_ko, sum_en, faq = facts(shop)
    faq_ld = {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faq]}
    page_ld = {"@context": "https://schema.org", "@type": "WebPage", "url": url, "name": title, "inLanguage": "ko", "dateModified": checked(shop),
               "isPartOf": {"@type": "WebSite", "name": "엉클데이 Uncle Day", "url": SITE + "/"}, "about": {"@id": url + "#shop"}}
    ld["@id"] = url + "#shop"
    crumbs = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "엉클데이", "item": SITE + "/"},
        {"@type": "ListItem", "position": 2, "name": f"{tx(city.get('name'))} {tx(cat.get('name'))}".strip(), "item": f"{SITE}/c/{shop.get('city')}/"},
        {"@type": "ListItem", "position": 3, "name": name, "item": url}]}
    js = lambda o: json.dumps(o, ensure_ascii=False).replace("</", "<\\/")
    # 미리 그려 둔 본문 (자바스크립트가 켜지면 같은 내용으로 다시 그려져요)
    body = f"""<article class="seo-pre"><a href="/" class="back">← 엉클데이 홈</a>
<h1>{esc(name)}{f' <small>{esc(en)}</small>' if en and en != name else ''}</h1>
<p class="seo-sum"><b>{esc(sum_ko)}</b></p>
<p class="seo-sum" lang="en">{esc(sum_en)}</p>
<p class="seo-date">정보 확인: {checked(shop)} · <a href="/c/{esc(shop.get('city') or '')}/">{esc(tx(city.get('name')))} 업체 모두 보기</a></p>
<p>{esc(tx(city.get('name')))} · {esc(tx(cat.get('name')))}{' · ' + ' · '.join('#' + esc(tx(t)) for t in (shop.get('tags') or [])) if shop.get('tags') else ''}</p>
{f'<p>{esc(tx(shop.get("desc")))}</p>' if tx(shop.get("desc")) else ''}
{f'<p><b>이런 분께 추천해요:</b> {esc(tx(shop.get("recommend")))}</p>' if tx(shop.get("recommend")) else ''}
<ul>{f'<li>📍 주소: {esc(addr_ko)}</li>' if addr_ok else ''}{f'<li>🕒 영업시간: {esc(hours)}</li>' if hours else ''}{f'<li>🗣️ 응대 언어: {esc(", ".join(langs.get(l, l) for l in shop["staffLangs"]))}</li>' if shop.get("staffLangs") else ''}<li>💬 한국어 카카오톡 상담 · 추가 요금 없이 업체 가격 그대로</li></ul>
{('<h2>메뉴</h2><ul>' + ''.join(f'<li>{esc(tx(m["name"]))}' + (f' — {m["price"]:,}₫' if m.get("price") else '') + '</li>' for m in menu) + '</ul>') if menu else ''}
<h2>자주 묻는 질문</h2><dl class="seo-faq">{''.join(f'<dt>{esc(q)}</dt><dd>{esc(a)}</dd>' for q, a in faq)}</dl>
</article>"""
    h = TPL
    h = h.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<base href="/">', 1)
    h = re.sub(r"<title>.*?</title>", f"<title>{esc(title)}</title>", h, count=1, flags=re.S)
    h = re.sub(r'<meta name="description" content="[^"]*">', f'<meta name="description" content="{esc(desc)}">', h, count=1)
    h = re.sub(r'<link rel="canonical" href="[^"]*">', f'<link rel="canonical" href="{url}">', h, count=1)
    h = re.sub(r'<meta property="og:title" content="[^"]*">', f'<meta property="og:title" content="{esc(title)}">', h, count=1)
    h = re.sub(r'<meta property="og:description" content="[^"]*">', f'<meta property="og:description" content="{esc(desc)}">', h, count=1)
    h = re.sub(r'<meta property="og:url" content="[^"]*">', f'<meta property="og:url" content="{url}">', h, count=1)
    h = re.sub(r'<meta property="og:image" content="[^"]*">', f'<meta property="og:image" content="{img}">\n<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">\n<meta name="twitter:image" content="{img}">', h, count=1)
    h = re.sub(r'<meta name="robots" content="[^"]*">\n?', "", h)
    h = h.replace("</head>", f'<script type="application/ld+json">{js(ld)}</script>\n<script type="application/ld+json">{js(crumbs)}</script>\n<script type="application/ld+json">{js(faq_ld)}</script>\n<script type="application/ld+json">{js(page_ld)}</script>\n<meta property="article:modified_time" content="{checked(shop)}">\n</head>', 1)
    h = h.replace('<main class="wrap" id="detail"></main>', f'<main class="wrap" id="detail">{body}</main>', 1)
    sj = json.dumps(sid)
    h = re.sub(r"<script>drawCommon\(\);.*?</script>", f'<script>window.SHOP_ID = {sj}; drawCommon(); renderShop({sj}); window.onLiveUpdate = () => renderShop({sj});</script>', h, count=1, flags=re.S)
    assert "window.SHOP_ID" in h and "<base href" in h
    return h

os.makedirs("og", exist_ok=True); os.makedirs("s", exist_ok=True)
keep_og, keep_s = set(), set()
order = {}
for shop in d["shops"]:
    sid = shop.get("id")
    if not sid or not re.fullmatch(r"[A-Za-z0-9_-]+", sid): continue
    if shop.get("hidden") or shop.get("published") is False: continue
    if shop.get("img"): bgsrc = shop["img"]
    else:
        ph = d["phImgs"].get(shop.get("cat")) or []
        if ph:
            i = order.get(shop.get("cat"), 0); order[shop.get("cat")] = i + 1; bgsrc = ph[i % len(ph)]
        else: bgsrc = d["catImgs"].get(shop.get("cat"))
    im = card(shop, bgsrc)
    buf = io.BytesIO(); im.save(buf, "JPEG", quality=84, optimize=True, progressive=True); data = buf.getvalue()
    h = hashlib.md5(data).hexdigest()[:8]; fn = f"{sid}-{h}.jpg"   # 그림이 바뀌면 이름도 바뀌어서 카톡이 새 그림을 가져가요
    if not os.path.exists(f"og/{fn}"): open(f"og/{fn}", "wb").write(data)
    keep_og.add(fn)
    cat = cats.get(shop.get("cat"), {}); city = cities.get(shop.get("city"), {})
    name = tx(shop.get("name")); desc = re.sub(r"\s+", " ", tx(shop.get("desc"))).strip()
    pre = " · ".join(x for x in [tx(city.get("name")), tx(cat.get("name"))] if x)
    desc = (f"{pre} | " if pre else "") + (desc[:90] + ("…" if len(desc) > 90 else "") if desc else "한국어로 상담하고 추가 요금 없이 예약하세요.")
    os.makedirs(f"s/{sid}", exist_ok=True)
    title = f"{name} - {tx(city.get('name'))} {tx(cat.get('name'))} 한국어 예약 | 엉클데이"
    page = build_page(shop, sid, title, desc, f"{SITE}/s/{sid}/", f"{SITE}/og/{fn}")
    open(f"s/{sid}/index.html", "w").write(page); keep_s.add(sid)
for f in os.listdir("og"):
    if f not in keep_og: os.remove(f"og/{f}")
for f in os.listdir("s"):
    if f not in keep_s: shutil.rmtree(f"s/{f}", ignore_errors=True)
# ---- 도시별 모아보기 페이지 c/<도시>/ : AI · 검색엔진이 "다낭 마사지 어디?"에 인용하기 좋은 목록 ----
live = [x for x in d["shops"] if x.get("id") in keep_s]
GROUPS = [("spabody", "마사지 · 스파", "Massage & spa"), ("beauty", "피부 · 뷰티 · 성형", "Skin, beauty & clinics")]
def grp(shop): c = cats.get(shop.get("cat"), {}); return c.get("id") or "beauty"
HUB_CSS = """body{margin:0;font-family:'Noto Sans KR','Pretendard Variable',-apple-system,'Segoe UI',sans-serif;background:#f6f7f9;color:#222;line-height:1.65}
.hd{background:#fff;box-shadow:0 1px 4px #0001;position:sticky;top:0}.hd .in,.wrap{max-width:1000px;margin:0 auto;padding:0 16px}.hd .in{display:flex;gap:12px;align-items:center;height:58px}
.hd a{color:#2ac1bc;font-weight:800;font-size:20px;text-decoration:none}.hd nav{margin-left:auto;display:flex;gap:6px;overflow-x:auto}.hd nav a{font-size:13.5px;font-weight:700;color:#222;border:1px solid #ddd;border-radius:999px;padding:4px 12px;white-space:nowrap}
.hd nav a.on{background:#2ac1bc;border-color:#2ac1bc;color:#fff}h1{font-size:26px;letter-spacing:-.03em;margin:26px 0 8px}h2{font-size:20px;margin:30px 0 10px}.lead{font-size:16px}.en{color:#667;font-size:14px}.date{color:#889;font-size:13px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr));gap:12px}.card{background:#fff;border-radius:16px;padding:14px 16px;text-decoration:none;color:#222;display:block;border:1px solid #eee}.card:hover{border-color:#2ac1bc}
.card b{font-size:16.5px}.card small{display:block;color:#667;font-size:12.5px;margin:2px 0 6px}.card p{margin:0;font-size:13.5px;color:#333}.cta{display:inline-block;background:#2ac1bc;color:#fff;border-radius:999px;padding:10px 18px;font-weight:700;text-decoration:none;margin:8px 0}
dl dt{font-weight:700;margin-top:12px}dl dd{margin:4px 0 0}footer{color:#889;font-size:13px;padding:30px 0 50px}"""
def hub_page(cid, shops_c):
    city = cities.get(cid, {}); cko = tx(city.get("name")); cen = CITY_EN.get(cid, lang(city.get("name"), "en")); url = f"{SITE}/c/{cid}/"
    by = {g: [x for x in shops_c if grp(x) == g] for g, _, _ in GROUPS}
    allp = [p for x in shops_c for p in mprices(x) if grp(x) == "spabody"]
    upd = max([checked(x) for x in shops_c] or [BUILT])
    nko = ", ".join(f"{l} {len(by[g])}곳" for g, l, _ in GROUPS if by[g])
    lead = f"엉클데이에 등록된 {cko}의 업체는 모두 {len(shops_c)}곳이에요 ({nko}). 모든 업체를 한국어로 상담하고, 추가 요금 없이 매장 가격 그대로 예약할 수 있어요."
    if allp: lead += f" 마사지 · 스파 참고가는 {won(min(allp))}부터예요."
    lead_en = f"Uncle Day lists {len(shops_c)} shops in {cen}, Vietnam — massage, spa, skin care and clinics — bookable with Korean-language support at the shop's own price, no extra fee."
    faq = [(f"{cko}에서 한국어로 마사지 예약할 수 있는 곳은?", f"엉클데이에 등록된 {cko} 마사지 · 스파 {len(by['spabody'])}곳은 모두 한국어 상담으로 예약할 수 있어요. 엉클데이가 매장에 확인한 뒤 예약을 확정해 드려요."),
           ("엉클데이로 예약하면 더 비싼가요?", "아니요. 엉클데이를 통해도 매장 가격 그대로이고, 손님이 엉클데이에 따로 내는 돈은 없어요. 결제는 시술 후 매장에서 직접 해요."),
           ("후기는 믿을 수 있나요?", "엉클데이 후기는 실제로 예약하고 방문한 손님만 남길 수 있어요.")]
    if allp: faq.insert(1, (f"{cko} 마사지 가격은 얼마쯤이에요?", f"엉클데이가 확인한 {cko} 마사지 · 스파 참고가는 {won(min(allp))}부터 {won(max(allp))}까지예요. 정확한 가격은 메뉴와 시간에 따라 달라요."))
    sec = ""
    items = []
    for g, l, le in GROUPS:
        if not by[g]: continue
        sec += f'<h2>{esc(cko)} {esc(l)} <small class="en">{esc(le)}</small></h2><div class="grid">'
        for x in by[g]:
            sk, _, _ = facts(x); nm = tx(x.get("name")); u = f"/s/{x['id']}/"
            sec += f'<a class="card" href="{u}"><b>{esc(nm)}</b><small>{esc(SUB_KO.get(x.get("cat"), ""))}{" · " + won(prices(x)[0]) + "부터" if prices(x) else ""}</small><p>{esc(sk)}</p></a>'
            items.append({"@type": "ListItem", "position": len(items) + 1, "url": SITE + u, "name": nm})
        sec += "</div>"
    title = f"{cko} 마사지 · 스파 · 피부관리 한국어 예약 {len(shops_c)}곳 | 엉클데이"
    desc = lead[:150]
    js = lambda o: json.dumps(o, ensure_ascii=False).replace("</", "<\\/")
    lds = [{"@context": "https://schema.org", "@type": "CollectionPage", "name": title, "url": url, "inLanguage": "ko", "dateModified": upd, "description": lead,
            "mainEntity": {"@type": "ItemList", "numberOfItems": len(items), "itemListElement": items}},
           {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faq]},
           {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [{"@type": "ListItem", "position": 1, "name": "엉클데이", "item": SITE + "/"}, {"@type": "ListItem", "position": 2, "name": cko, "item": url}]}]
    nav = "".join(f'<a href="/c/{k}/" class="{"on" if k == cid else ""}">{esc(tx(cities[k]["name"]))}</a>' for k in hubs)
    return f"""<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(title)}</title><meta name="description" content="{esc(desc)}"><link rel="canonical" href="{url}">
<meta property="og:type" content="website"><meta property="og:site_name" content="엉클데이 Uncle Day"><meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(desc)}"><meta property="og:url" content="{url}"><meta property="og:image" content="{SITE}/images/og-image.jpg">
<link rel="icon" type="image/png" sizes="32x32" href="/images/favicon-32.png"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;800&display=swap">
<style>{HUB_CSS}</style>
{"".join(f'<script type="application/ld+json">{js(o)}</script>' for o in lds)}
</head><body><header class="hd"><div class="in"><a href="/">엉클데이</a><nav>{nav}</nav></div></header>
<main class="wrap"><h1>{esc(cko)} 마사지 · 스파 · 뷰티 한국어 예약</h1>
<p class="lead"><b>{esc(lead)}</b></p><p class="en" lang="en">{esc(lead_en)}</p><p class="date">정보 확인: {upd} · 엉클데이(uncleday.com)</p>
<a class="cta" href="/?city={cid}">엉클데이에서 {esc(cko)} 업체 보기 · 예약하기</a>{f' <a class="cta" style="background:#0e2843" href="/c/{cid}/guide/">📘 {esc(cko)} 마사지 가이드 (가격 · 팁 · 고르는 법)</a>' if cid in GUIDES else ''}
{sec}
<h2>자주 묻는 질문</h2><dl>{"".join(f"<dt>{esc(q)}</dt><dd>{esc(a)}</dd>" for q, a in faq)}</dl></main>
<footer class="wrap">엉클데이 Uncle Day — 베트남 마사지 · 스파 · 뷰티 한국어 예약 · <a href="/">홈</a></footer></body></html>
"""
# ---- 도시별 안내 글 c/<도시>/guide/ : 사람이 쓴 설명(tools/guides.py) + 업체 데이터에서 자동으로 뽑은 숫자 · 목록 ----
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from guides import GUIDES, SOURCES
def blob(x): return " ".join([tx(t) for t in (x.get("tags") or [])] + [tx(m.get("name")) for m in (x.get("menu") or [])] + [tx(x.get("desc")), tx(x.get("address")), lang(x.get("address"), "vi")])
def has(x, pat): return re.search(pat, blob(x)) is not None
def late(x): c = x.get("close") or ""; return c >= "23:00" or c.startswith("24") or (c and c < "05:00")
def guide_page(cid, shops_c):
    G = GUIDES[cid]; city = cities.get(cid, {}); cko = tx(city.get("name")); url = f"{SITE}/c/{cid}/guide/"
    sp = [x for x in shops_c if grp(x) == "spabody"]
    link = lambda x: f'<a href="/s/{x["id"]}/">{esc(tx(x.get("name")))}</a>'
    lst = lambda xs: ", ".join(link(x) for x in xs) if xs else "아직 없어요"
    used = []   # 글에 처음 나온 순서대로 [1] [2] … 번호를 붙여요
    def S(keys):
        for k in keys:
            if k not in used: used.append(k)
        return " ".join(f'<sup><a href="#src-{k}">[{used.index(k) + 1}]</a></sup>' for k in keys)
    ko = [x for x in sp if "ko" in (x.get("staffLangs") or []) or has(x, "한국어|한국인")]
    feats = [("🗣️ 한국어 응대", ko), ("🧳 짐 보관", [x for x in sp if has(x, "짐 보관")]), ("🚐 픽업 · 샌딩", [x for x in sp if has(x, "픽업|샌딩")]),
             ("🚿 샤워", [x for x in sp if has(x, "샤워")]), ("🌙 밤 11시 이후까지", [x for x in sp if late(x)])]
    # 가격표: 우리가 확인한 참고가만 (시간별)
    rows = {}
    for x in sp:
        for m in x.get("menu") or []:
            if is_massage(m) and isinstance(m.get("price"), (int, float)) and m["price"] > 0 and m.get("min"):
                k = 60 if m["min"] <= 60 else 90 if m["min"] <= 90 else 120
                rows.setdefault(k, []).append((int(m["price"]), x))
    ptab = "".join(f'<tr><td>{"120분 이상" if k == 120 else str(k) + "분"}</td><td>{won(min(p for p, _ in v)) + (" ~ " + won(max(p for p, _ in v)) if max(p for p, _ in v) > min(p for p, _ in v) else "")}</td><td>{len({id(x) for _, x in v})}곳</td></tr>' for k, v in sorted(rows.items()))
    summary = f"엉클데이에 등록된 {cko} 마사지 · 스파는 {len(sp)}곳이고, 그중 {len(ko)}곳이 한국어로 응대해요."
    if rows: k0 = 60 if 60 in rows else min(rows); summary += f" 엉클데이가 확인한 참고가는 {'120분 이상' if k0 == 120 else str(k0) + '분'} 기준 {won(min(p for p, _ in rows[k0]))}부터예요."
    faq = [(q, a) for q, a, _ in G["tip"]] + G.get("faq_extra", []) + [("엉클데이로 예약하면 더 비싼가요?", "아니요. 엉클데이를 통해도 매장 가격 그대로이고, 손님이 엉클데이에 따로 내는 돈은 없어요. 결제는 시술 후 매장에서 직접 해요.")]
    h2 = []
    body = f"""<p class="lead">{esc(G['intro'])}</p>
<div class="box"><b>한눈에 보기</b><p>{esc(summary)}</p><ul>{"".join(f"<li><b>{l}</b> {len(v)}곳 — {lst(v)}</li>" for l, v in feats)}</ul></div>
<h2 id="price">가격은 얼마쯤이에요?</h2>
{f'<table class="tb"><thead><tr><th>시간</th><th>엉클데이 확인 참고가</th><th>업체 수</th></tr></thead><tbody>{ptab}</tbody></table>' if ptab else ''}
<p>{esc(G['price_note'])} {S([G['price_src']])}</p><p class="muted">가격은 메뉴 · 시간 · 시즌에 따라 달라요. 업체 페이지의 최신 가격이나 상담으로 확인해 주세요.</p>
<h2 id="tip">팁은 얼마나 줘요?</h2>{"".join(f"<h3>{esc(q)}</h3><p>{esc(a)} {S(k)}</p>" for q, a, k in G['tip'])}
{f'<p>엉클데이 업체 중 팁 포함 · 노팁을 내건 곳: {lst([x for x in sp if has(x, "팁 포함|노팁")])}</p>' if any(has(x, "팁 포함|노팁") for x in sp) else ''}
<h2 id="kinds">어떤 마사지를 고를까요?</h2><dl class="kinds">{"".join(f"<dt>{esc(n)}</dt><dd>{esc(d_)}<br><small>할 수 있는 곳: {lst([x for x in sp if has(x, pat)])}</small></dd>" for n, pat, d_ in G['kinds'])}</dl>
<h2 id="area">어느 동네에서 받을까요?</h2><dl class="kinds">{"".join(f"<dt>{esc(n)}</dt><dd>{esc(d_)}<br><small>{lst([x for x in sp if has(x, pat)])}</small></dd>" for n, pat, d_ in G['areas'])}</dl>
<h2 id="when">공항 가기 전 마지막 일정이라면</h2><p>{esc(G['when'])} {S([G['when_src']])}</p>
<p>엉클데이 업체 중 짐 보관 · 샤워 · 샌딩 되는 곳: {lst([x for x in sp if has(x, "짐 보관|샤워|샌딩")])}</p>
<h2 id="book">엉클데이로 예약하는 방법</h2><ol><li>업체 페이지에서 시간 · 인원 · 코스를 골라 예약을 요청하거나, 사이트 채팅 · 카카오톡으로 한국어 상담을 해요.</li>
<li>엉클데이가 매장에 확인한 뒤 예약을 확정하고, 주소와 찾아가는 법을 한국어로 보내 드려요.</li><li>시간에 맞춰 방문하고, 시술 후 매장에서 매장 가격 그대로 결제해요. 엉클데이에 따로 내는 돈은 없어요.</li>
<li>다녀온 뒤 테라피스트 후기를 남길 수 있어요. 실제로 방문한 손님만 쓸 수 있어요.</li></ol>
<p><a class="cta" href="/c/{cid}/">{esc(cko)} 업체 {len(shops_c)}곳 모두 보기</a></p>
<h2 id="faq">자주 묻는 질문</h2><dl>{"".join(f"<dt>{esc(q)}</dt><dd>{esc(a)}</dd>" for q, a in faq)}</dl>
<h2 id="src">출처</h2><ol class="src">{"".join(f'<li id="src-{k}"><a href="{SOURCES[k][1]}" rel="nofollow noopener" target="_blank">{esc(SOURCES[k][0])}</a></li>' for k in used)}</ol>
<p class="muted">업체 정보는 엉클데이가 확인한 내용이에요. 바깥 자료의 숫자는 각 출처의 게시 시점 기준이에요.</p>"""
    title = G["title"]; desc = summary + " 가격 · 팁 · 고르는 법 · 예약 방법을 정리했어요."
    upd = max([G["checked"]] + [checked(x) for x in sp])
    js = lambda o: json.dumps(o, ensure_ascii=False).replace("</", "<\\/")
    lds = [{"@context": "https://schema.org", "@type": "Article", "headline": title, "inLanguage": "ko", "url": url, "dateModified": upd, "datePublished": G["checked"],
            "author": {"@type": "Organization", "name": "엉클데이 Uncle Day", "url": SITE + "/"}, "publisher": {"@type": "Organization", "name": "엉클데이 Uncle Day", "logo": {"@type": "ImageObject", "url": SITE + "/images/logo-og.png"}},
            "image": SITE + "/images/og-image.jpg", "description": desc, "citation": [SOURCES[k][1] for k in used]},
           {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faq]},
           {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [{"@type": "ListItem", "position": 1, "name": "엉클데이", "item": SITE + "/"},
             {"@type": "ListItem", "position": 2, "name": cko, "item": f"{SITE}/c/{cid}/"}, {"@type": "ListItem", "position": 3, "name": "가이드", "item": url}]}]
    css = HUB_CSS + """.box{background:#fff;border-radius:16px;padding:14px 18px;border:1px solid #e6f4f3}.box ul{padding-left:18px;margin:6px 0 0}.box li{margin:3px 0;font-size:14.5px}
.tb{border-collapse:collapse;width:100%;max-width:560px;background:#fff;border-radius:12px;overflow:hidden}.tb th,.tb td{padding:9px 12px;border-bottom:1px solid #eee;text-align:left;font-size:14.5px}.tb th{background:#f0fbfb}
h3{font-size:16px;margin:16px 0 4px}.muted{color:#778;font-size:13px}.kinds dd small{color:#556}main a{color:#13908b}.src{font-size:13.5px}sup a{text-decoration:none}.toc{font-size:13.5px;color:#556}.toc a{margin-right:10px}"""
    toc = " ".join(f'<a href="#{i}">{n}</a>' for i, n in [("price", "가격"), ("tip", "팁"), ("kinds", "종류"), ("area", "동네"), ("when", "공항 가기 전"), ("book", "예약"), ("faq", "질문")])
    nav = "".join(f'<a href="/c/{k}/" class="{"on" if k == cid else ""}">{esc(tx(cities[k]["name"]))}</a>' for k in hubs)
    return f"""<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(title)} | 엉클데이</title><meta name="description" content="{esc(desc[:155])}"><link rel="canonical" href="{url}">
<meta property="og:type" content="article"><meta property="og:site_name" content="엉클데이 Uncle Day"><meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(desc[:155])}"><meta property="og:url" content="{url}"><meta property="og:image" content="{SITE}/images/og-image.jpg">
<meta property="article:modified_time" content="{upd}"><link rel="icon" type="image/png" sizes="32x32" href="/images/favicon-32.png"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;800&display=swap">
<style>{css}</style>
{"".join(f'<script type="application/ld+json">{js(o)}</script>' for o in lds)}
</head><body><header class="hd"><div class="in"><a href="/">엉클데이</a><nav>{nav}</nav></div></header>
<main class="wrap"><h1>{esc(title)}</h1><p class="date">업데이트: {upd} · 엉클데이(uncleday.com)</p><p class="toc">{toc}</p>
{body}</main><footer class="wrap">엉클데이 Uncle Day — 베트남 마사지 · 스파 · 뷰티 한국어 예약 · <a href="/">홈</a> · <a href="/c/{cid}/">{esc(cko)} 업체</a></footer></body></html>
"""

hubs = [c["id"] for c in d["cities"] if any(x.get("city") == c["id"] for x in live)]
os.makedirs("c", exist_ok=True)
for cid in hubs:
    os.makedirs(f"c/{cid}", exist_ok=True)
    open(f"c/{cid}/index.html", "w").write(hub_page(cid, [x for x in live if x.get("city") == cid]))
    if cid in GUIDES:
        os.makedirs(f"c/{cid}/guide", exist_ok=True)
        open(f"c/{cid}/guide/index.html", "w").write(guide_page(cid, [x for x in live if x.get("city") == cid]))
    elif os.path.isdir(f"c/{cid}/guide"): shutil.rmtree(f"c/{cid}/guide", ignore_errors=True)
for f in os.listdir("c"):
    if f not in hubs: shutil.rmtree(f"c/{f}", ignore_errors=True)

# ---- llms.txt : AI에게 "엉클데이는 이런 곳이고 정보는 여기 있어요" 알려 주는 안내문 (llmstxt.org 형식) ----
L = ["# 엉클데이 Uncle Day", "",
     "> 베트남 다낭 · 나트랑 · 호치민 · 하노이의 마사지, 스파, 피부관리, 성형 · 피부과, 네일 업체를 한국어로 상담하고 예약하는 서비스예요. "
     "Uncle Day lets travelers book trusted massage, spa and beauty shops in Vietnam with Korean-language support.", "",
     "- 손님은 엉클데이 사이트 채팅이나 카카오톡으로 한국어 상담을 하고, 엉클데이가 매장에 확인한 뒤 예약을 확정해요.",
     "- 엉클데이를 통해도 매장 가격 그대로예요. 손님이 엉클데이에 내는 추가 요금은 없고, 결제는 시술 후 매장에서 직접 해요.",
     "- 후기는 실제로 예약하고 방문한 손님만 남길 수 있어요.",
     f"- 등록 업체 {len(live)}곳 · 정보 업데이트 {BUILT}", "",
     "## 도시별 모아보기"]
for cid in hubs:
    n = sum(1 for x in live if x.get("city") == cid)
    L.append(f"- [{tx(cities[cid]['name'])} ({CITY_EN.get(cid, '')}) {n}곳]({SITE}/c/{cid}/): 마사지 · 스파 · 뷰티 업체 목록과 자주 묻는 질문")
    if cid in GUIDES: L.append(f"- [{GUIDES[cid]['title']}]({SITE}/c/{cid}/guide/): 가격 · 팁 · 마사지 종류 · 동네 · 예약 방법 (출처 포함)")
for cid in hubs:
    L += ["", f"## {tx(cities[cid]['name'])} 업체"]
    for x in [y for y in live if y.get("city") == cid]:
        sk, _, _ = facts(x); L.append(f"- [{tx(x.get('name'))}]({SITE}/s/{x['id']}/): {sk}")
L += ["", "## 안내", f"- [엉클데이 홈]({SITE}/): 업체 검색 · 예약", f"- [예약 확인]({SITE}/booking.html): 로그인 없이 예약번호로 확인"]
open("llms.txt", "w").write("\n".join(L) + "\n")

# 사이트맵: 검색엔진에 '이 페이지들이 있어요' + 언제 바뀌었는지(lastmod) 알려 주기
mod = {f"{SITE}/s/{x['id']}/": checked(x) for x in live}
for cid in hubs: mod[f"{SITE}/c/{cid}/"] = max(checked(x) for x in live if x.get("city") == cid)
for cid in hubs:
    if cid in GUIDES: mod[f"{SITE}/c/{cid}/guide/"] = max([GUIDES[cid]["checked"]] + [checked(x) for x in live if x.get("city") == cid])
urls = [f"{SITE}/"] + [f"{SITE}/c/{c}/" for c in hubs] + [f"{SITE}/c/{c}/guide/" for c in hubs if c in GUIDES] + [f"{SITE}/s/{x}/" for x in sorted(keep_s)]
open("sitemap.xml", "w").write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + "".join(f"  <url><loc>{u}</loc><lastmod>{mod.get(u, BUILT)}</lastmod>{'<priority>1.0</priority>' if u == SITE + '/' else '<priority>0.8</priority>' if '/c/' in u else ''}</url>\n" for u in urls) + "</urlset>\n")
print(len(keep_s), "곳 업체 페이지 ·", len(hubs), "개 도시 페이지 · llms.txt · 사이트맵 완료")
