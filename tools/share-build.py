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
    crumbs = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "엉클데이", "item": SITE + "/"},
        {"@type": "ListItem", "position": 2, "name": f"{tx(city.get('name'))} {tx(cat.get('name'))}".strip()},
        {"@type": "ListItem", "position": 3, "name": name, "item": url}]}
    js = lambda o: json.dumps(o, ensure_ascii=False).replace("</", "<\\/")
    # 미리 그려 둔 본문 (자바스크립트가 켜지면 같은 내용으로 다시 그려져요)
    body = f"""<article class="seo-pre"><a href="/" class="back">← 엉클데이 홈</a>
<h1>{esc(name)}{f' <small>{esc(en)}</small>' if en and en != name else ''}</h1>
<p>{esc(tx(city.get('name')))} · {esc(tx(cat.get('name')))}{' · ' + ' · '.join('#' + esc(tx(t)) for t in (shop.get('tags') or [])) if shop.get('tags') else ''}</p>
{f'<p>{esc(tx(shop.get("desc")))}</p>' if tx(shop.get("desc")) else ''}
{f'<p><b>이런 분께 추천해요:</b> {esc(tx(shop.get("recommend")))}</p>' if tx(shop.get("recommend")) else ''}
<ul>{f'<li>📍 주소: {esc(addr_ko)}</li>' if addr_ok else ''}{f'<li>🕒 영업시간: {esc(hours)}</li>' if hours else ''}{f'<li>🗣️ 응대 언어: {esc(", ".join(langs.get(l, l) for l in shop["staffLangs"]))}</li>' if shop.get("staffLangs") else ''}<li>💬 한국어 카카오톡 상담 · 추가 요금 없이 업체 가격 그대로</li></ul>
{('<h2>메뉴</h2><ul>' + ''.join(f'<li>{esc(tx(m["name"]))}' + (f' — {m["price"]:,}₫' if m.get("price") else '') + '</li>' for m in menu) + '</ul>') if menu else ''}
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
    h = h.replace("</head>", f'<script type="application/ld+json">{js(ld)}</script>\n<script type="application/ld+json">{js(crumbs)}</script>\n</head>', 1)
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
# 사이트맵: 검색엔진에 '이 페이지들이 있어요' 알려 주기
import datetime
today = datetime.date.today().isoformat()
urls = [f"{SITE}/"] + [f"{SITE}/s/{x}/" for x in sorted(keep_s)]
open("sitemap.xml", "w").write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + "".join(f"  <url><loc>{u}</loc>{'<priority>1.0</priority>' if u == SITE + '/' else ''}</url>\n" for u in urls) + "</urlset>\n")
print(len(keep_s), "곳 업체 페이지·미리보기·사이트맵 완료")
