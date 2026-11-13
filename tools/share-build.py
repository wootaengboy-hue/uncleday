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
# ---- 🔎 검색 유입 기록: 어디서 들어왔는지(구글 · 네이버 · ChatGPT …)와 버튼 누름을 날짜별 숫자로만 세요 (universe18 seo_hit) ----
_SU = d.get("supa") or {}
KAKAO = d.get("kakao") or "https://pf.kakao.com/_xgkuxeX/chat"
HCTA = f'<a class="hcta" data-cta="kakao" href="{KAKAO}" target="_blank" rel="noopener">💬 상담하기</a>'
HCTA_EN = f'<a class="hcta" data-cta="kakao" href="{KAKAO}" target="_blank" rel="noopener">💬 Chat with us</a>'
def TRACK():
    if not _SU.get("url"): return ""
    auth = f',Authorization:"Bearer {_SU["key"]}"' if str(_SU.get("key", "")).startswith("eyJ") else ""
    return ("<script>(function(){var U=" + json.dumps(_SU["url"]) + ",K=" + json.dumps(_SU["key"]) + ";function S(){try{var r=document.referrer;if(!r)return'direct';var h=new URL(r).hostname;"
            "if(h==location.hostname)return'internal';var m=[['google','google'],['naver','naver'],['bing','bing'],['daum','daum'],['chatgpt','chatgpt'],['openai','chatgpt'],['perplexity','perplexity'],['claude','claude'],['gemini','gemini'],['kakao','kakao'],['facebook','facebook'],['instagram','instagram']];"
            "for(var i=0;i<m.length;i++)if(h.indexOf(m[i][0])>=0)return m[i][1];return'other'}catch(e){return'other'}}"
            "var src=S();window.UD_SRC=src;var BOT=navigator.webdriver||/bot|crawl|spider|slurp|preview|headless|lighthouse|google-inspectiontool/i.test(navigator.userAgent);window.udHit=function(k){if(BOT)return;try{fetch(U+'/rest/v1/rpc/seo_hit',{method:'POST',keepalive:true,headers:{apikey:K" + auth + ",'Content-Type':'application/json'},body:JSON.stringify({path:location.pathname,src:src,kind:k})}).catch(function(){})}catch(e){}};"
            "udHit('view');document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('[data-cta]');if(a)udHit(a.getAttribute('data-cta'))})})()</script>")
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
<p class="seo-date">정보 확인: {checked(shop)} · <a href="/c/{esc(shop.get('city') or '')}/">{esc(tx(city.get('name')))} 업체 모두 보기</a> · <a href="/en/s/{esc(sid)}/" lang="en" hreflang="en">English</a></p>
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
    h = re.sub(r'<link rel="canonical" href="[^"]*">', f'<link rel="canonical" href="{url}">\n<link rel="alternate" hreflang="ko" href="{url}"><link rel="alternate" hreflang="en" href="{SITE}/en/s/{sid}/"><link rel="alternate" hreflang="x-default" href="{url}">', h, count=1)
    h = re.sub(r'<meta property="og:title" content="[^"]*">', f'<meta property="og:title" content="{esc(title)}">', h, count=1)
    h = re.sub(r'<meta property="og:description" content="[^"]*">', f'<meta property="og:description" content="{esc(desc)}">', h, count=1)
    h = re.sub(r'<meta property="og:url" content="[^"]*">', f'<meta property="og:url" content="{url}">', h, count=1)
    h = re.sub(r'<meta property="og:image" content="[^"]*">', f'<meta property="og:image" content="{img}">\n<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">\n<meta name="twitter:image" content="{img}">', h, count=1)
    h = re.sub(r'<meta name="robots" content="[^"]*">\n?', "", h)
    h = h.replace("</head>", f'<script type="application/ld+json">{js(ld)}</script>\n<script type="application/ld+json">{js(crumbs)}</script>\n<script type="application/ld+json">{js(faq_ld)}</script>\n<script type="application/ld+json">{js(page_ld)}</script>\n<meta property="article:modified_time" content="{checked(shop)}">\n</head>', 1)
    h = h.replace('<main class="wrap" id="detail"></main>', f'<main class="wrap" id="detail">{body}</main>', 1)
    h = h.replace("</body>", TRACK() + "\n</body>", 1)
    sj = json.dumps(sid)
    h = re.sub(r"<script>drawCommon\(\);.*?</script>", f'<script>window.SHOP_ID = {sj}; drawCommon(); renderShop({sj}); window.onLiveUpdate = () => renderShop({sj});</script>', h, count=1, flags=re.S)
    assert "window.SHOP_ID" in h and "<base href" in h
    return h

os.makedirs("og", exist_ok=True); os.makedirs("s", exist_ok=True)
keep_og, keep_s = set(), set(); OGIMG = {}
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
    keep_og.add(fn); OGIMG[sid] = f"{SITE}/og/{fn}"
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
HUB_CSS = """:root{--green:#116241;--green-t:#E5F0EA;--orange:#FD6A00;--orange-d:#E25E00;--navy:#0E2843;--sand:#F4EAD8;--cream:#FFF8E8;--line:#EEE2CB;--sub:#5b6676}
body{margin:0;font-family:'Pretendard Variable',Pretendard,-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Noto Sans KR','Malgun Gothic',sans-serif;background:var(--cream);color:var(--navy);line-height:1.7;letter-spacing:-.01em;word-break:keep-all;overflow-wrap:anywhere;-webkit-font-smoothing:antialiased}
.hd{background:#FAF3E0;border-bottom:1px solid var(--line);position:sticky;top:0;z-index:10}.hd .in,.wrap{max-width:1000px;margin:0 auto;padding:0 16px}
.hd .in{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;padding-top:8px;padding-bottom:8px}.hd .logo{flex:none;margin-right:auto;line-height:0}.hd .logo img{height:52px;width:auto;display:block}
.hd .hcta{flex:none;background:var(--orange);color:#fff;border-radius:999px;padding:8px 14px;font-weight:700;font-size:14px;text-decoration:none;white-space:nowrap}.hd .hcta:hover{background:var(--orange-d)}
.hd nav{order:3;flex:1 1 100%;display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding-bottom:2px}.hd nav::-webkit-scrollbar{display:none}
.hd nav a{font-size:14px;font-weight:600;color:var(--navy);background:#fff;border:1px solid var(--line);border-radius:999px;padding:5px 13px;white-space:nowrap;text-decoration:none}.hd nav a.on{background:var(--green);border-color:var(--green);color:#fff;font-weight:700}
@media(min-width:760px){.hd .logo img{height:72px}.hd nav{order:2;flex:0 1 auto;margin-left:auto}.hd .logo{margin-right:0}.hd .hcta{order:3}}
h1,h2,h3{color:var(--navy);letter-spacing:-.03em;font-weight:800}h1{font-size:27px;line-height:1.35;margin:26px 0 10px}h2{font-size:21px;margin:34px 0 12px}.lead{font-size:16.5px}.en{color:var(--sub);font-size:14px;font-weight:500}.date{color:var(--sub);font-size:13px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr));gap:12px}.card{background:#fff;border-radius:16px;padding:14px 16px;text-decoration:none;color:var(--navy);display:block;border:1px solid var(--line);transition:box-shadow .15s,border-color .15s}.card:hover{border-color:var(--green);box-shadow:0 6px 16px rgba(14,40,67,.08)}
.card b{font-size:17px}.card small{display:block;color:var(--green);font-weight:600;font-size:13px;margin:2px 0 6px}.card p{margin:0;font-size:14px;color:#3a4656}
.cta{display:inline-block;background:var(--orange);color:#fff;border-radius:999px;padding:11px 20px;font-weight:700;text-decoration:none;margin:8px 4px 8px 0}.cta:hover{background:var(--orange-d)}
dl dt{font-weight:700;margin-top:12px}dl dd{margin:4px 0 0}main a{color:var(--green)}main a.cta,main a.card,main a.chip{color:inherit}main a.cta{color:#fff}
footer{background:var(--navy);color:#C9D2DC;font-size:13.5px;padding:26px max(16px,calc((100% - 968px)/2)) 50px;margin-top:44px;max-width:none}footer a{color:#fff}
@media(max-width:700px){h1{font-size:24px}}"""
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
<link rel="alternate" hreflang="ko" href="{url}"><link rel="alternate" hreflang="en" href="{SITE}/en/c/{cid}/"><link rel="alternate" hreflang="x-default" href="{url}">
<meta property="og:type" content="website"><meta property="og:site_name" content="엉클데이 Uncle Day"><meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(desc)}"><meta property="og:url" content="{url}"><meta property="og:image" content="{SITE}/images/og-image.jpg">
<link rel="icon" type="image/png" sizes="32x32" href="/images/favicon-32.png"><link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<style>{HUB_CSS}</style>
{"".join(f'<script type="application/ld+json">{js(o)}</script>' for o in lds)}
</head><body><header class="hd"><div class="in"><a class="logo" href="/"><img src="/images/logo-full.webp" alt="엉클데이 Uncle Day" width="167" height="72"></a><nav>{nav}<a href="/en/c/{cid}/" lang="en">EN</a></nav>{HCTA}</div></header>
<main class="wrap"><h1>{esc(cko)} 마사지 · 스파 · 뷰티 한국어 예약</h1>
<p class="lead"><b>{esc(lead)}</b></p><p class="en" lang="en">{esc(lead_en)}</p><p class="date">정보 확인: {upd} · 엉클데이(uncleday.com)</p>
<a class="cta" data-cta="book" href="/?city={cid}">엉클데이에서 {esc(cko)} 업체 보기 · 예약하기</a>{f' <a class="cta" data-cta="guide" style="background:var(--green)" href="/c/{cid}/guide/">📘 {esc(cko)} 마사지 가이드 (가격 · 팁 · 고르는 법)</a>' if cid in GUIDES else ''}
<style>{TOPIC_CSS}</style>{topic_chips(cid, shops_c)}
{sec}{(f'<h2>📝 {esc(tx(cities[cid]["name"]))} 관련 글</h2><div class="grid">' + "".join(f'<a class="card" href="/blog/{r[0]}/"><b>{esc(r[1])}</b><small>업체 {r[2]}곳 · 정보 확인 {r[3]}</small></a>' for r in sorted([r for r in BLOG_OUT if r[4] == cid], key=lambda r: r[3], reverse=True)[:6]) + f'</div><p><a href="/blog/">블로그 글 모두 보기 →</a></p>') if any(r[4] == cid for r in BLOG_OUT) else ''}{f'<p><a class="cta" style="background:var(--green)" href="/c/{cid}/price/">💰 {esc(tx(cities[cid]["name"]))} 시술별 가격 비교</a></p>' if TREATS.get(cid) else ''}{f'<p><a class="cta" style="background:#fff;color:var(--navy);border:1px solid var(--line)" href="/c/{cid}/more/">🗺️ 미입점 가게도 보기 ({len(UNC.get(cid, []))}곳) — 예약 문의 가능</a></p>' if UNC.get(cid) else ''}
<h2>자주 묻는 질문</h2><dl>{"".join(f"<dt>{esc(q)}</dt><dd>{esc(a)}</dd>" for q, a in faq)}</dl></main>
<footer class="wrap">엉클데이 Uncle Day — 베트남 마사지 · 스파 · 뷰티 한국어 예약 · <a href="/">홈</a></footer>{TRACK()}</body></html>
"""
# ---- 도시별 안내 글 c/<도시>/guide/ : 사람이 쓴 설명(tools/guides.py) + 업체 데이터에서 자동으로 뽑은 숫자 · 목록 ----
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from guides import GUIDES, SOURCES, GUIDES_EN, SOURCES_EN
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
{f"<p>{esc(G['price_note'])} {S([G['price_src']])}</p>" if G.get('price_note') else ''}{'' if rows else '<p>아직 엉클데이가 확인한 가격이 적어요. 업체 페이지에서 상담으로 메뉴별 가격을 안내해 드려요.</p>'}<p class="muted">가격은 메뉴 · 시간 · 시즌에 따라 달라요. 업체 페이지의 최신 가격이나 상담으로 확인해 주세요.</p>
<h2 id="tip">팁은 얼마나 줘요?</h2>{"".join(f"<h3>{esc(q)}</h3><p>{esc(a)} {S(k)}</p>" for q, a, k in G['tip'])}
{f'<p>엉클데이 업체 중 팁 포함 · 노팁을 내건 곳: {lst([x for x in sp if has(x, "팁 포함|노팁")])}</p>' if any(has(x, "팁 포함|노팁") for x in sp) else ''}
<h2 id="kinds">어떤 마사지를 고를까요?</h2><dl class="kinds">{"".join(f"<dt>{esc(n)}</dt><dd>{esc(d_)}<br><small>할 수 있는 곳: {lst([x for x in sp if has(x, pat)])}</small></dd>" for n, pat, d_ in G['kinds'])}</dl>
<h2 id="area">어느 동네에서 받을까요?</h2><dl class="kinds">{"".join(f"<dt>{esc(n)}</dt><dd>{esc(d_)}<br><small>{lst([x for x in sp if has(x, pat)])}</small></dd>" for n, pat, d_ in G['areas'])}</dl>
<h2 id="when">공항 가기 전 마지막 일정이라면</h2><p>{esc(G['when'])} {S([G['when_src']]) if G.get('when_src') else ''}</p>
<p>엉클데이 업체 중 짐 보관 · 샤워 · 샌딩 되는 곳: {lst([x for x in sp if has(x, "짐 보관|샤워|샌딩")])}</p>
{f'<h2 id="clinic">성형 · 피부과도 한국어로 상담할 수 있어요</h2><p>{esc(G["clinic"])}</p><p>엉클데이에 등록된 {esc(cko)} 성형 · 피부 · 뷰티 업체: {lst([x for x in shops_c if grp(x) != "spabody"])}</p>' if G.get("clinic") else ''}
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
    css = HUB_CSS + """.box{background:#fff;border-radius:16px;padding:14px 18px;border:1px solid var(--line)}.box ul{padding-left:18px;margin:6px 0 0}.box li{margin:3px 0;font-size:14.5px}
.tb{border-collapse:collapse;width:100%;max-width:560px;background:#fff;border-radius:12px;overflow:hidden}.tb th,.tb td{padding:9px 12px;border-bottom:1px solid var(--line);text-align:left;font-size:14.5px}.tb th{background:var(--sand)}
h3{font-size:16px;margin:16px 0 4px}.muted{color:var(--sub);font-size:13px}.kinds dd small{color:var(--sub)}.src{font-size:13.5px}sup a{text-decoration:none}.toc{font-size:13.5px;color:var(--sub)}.toc a{margin-right:10px}"""
    toc = " ".join(f'<a href="#{i}">{n}</a>' for i, n in [("price", "가격"), ("tip", "팁"), ("kinds", "종류"), ("area", "동네"), ("when", "공항 가기 전")] + ([("clinic", "성형 · 피부과")] if G.get("clinic") else []) + [("book", "예약"), ("faq", "질문")])
    nav = "".join(f'<a href="/c/{k}/" class="{"on" if k == cid else ""}">{esc(tx(cities[k]["name"]))}</a>' for k in hubs)
    return f"""<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(title)} | 엉클데이</title><meta name="description" content="{esc(desc[:155])}"><link rel="canonical" href="{url}">
<link rel="alternate" hreflang="ko" href="{url}"><link rel="alternate" hreflang="en" href="{SITE}/en/c/{cid}/guide/"><link rel="alternate" hreflang="x-default" href="{url}">
<meta property="og:type" content="article"><meta property="og:site_name" content="엉클데이 Uncle Day"><meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(desc[:155])}"><meta property="og:url" content="{url}"><meta property="og:image" content="{SITE}/images/og-image.jpg">
<meta property="article:modified_time" content="{upd}"><link rel="icon" type="image/png" sizes="32x32" href="/images/favicon-32.png"><link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<style>{css}</style>
{"".join(f'<script type="application/ld+json">{js(o)}</script>' for o in lds)}
</head><body><header class="hd"><div class="in"><a class="logo" href="/"><img src="/images/logo-full.webp" alt="엉클데이 Uncle Day" width="167" height="72"></a><nav>{nav}<a href="/en/c/{cid}/guide/" lang="en">EN</a></nav>{HCTA}</div></header>
<main class="wrap"><h1>{esc(title)}</h1><p class="date">업데이트: {upd} · 엉클데이(uncleday.com)</p><p class="toc">{toc}</p>
{body}</main><footer class="wrap">엉클데이 Uncle Day — 베트남 마사지 · 스파 · 뷰티 한국어 예약 · <a href="/">홈</a> · <a href="/c/{cid}/">{esc(cko)} 업체</a></footer>{TRACK()}</body></html>
"""

# ---- 영어판: en/c/<도시>/ · en/c/<도시>/guide/ (외국인 여행객용) ----
def ename(x): return lang(x.get("name"), "en") or tx(x.get("name"))
def ecity(cid): return CITY_EN.get(cid, lang(cities.get(cid, {}).get("name"), "en"))
SUB_EN2 = {"massage": "Massage", "spa": "Spa & body care", "skin": "Skin care", "derma": "Dermatology", "surgery": "Cosmetic surgery", "nail": "Nails & lashes", "hair": "Hair", "body": "Body care", "dental": "Dental", "package": "Package"}
def vnd(n): return f"{n:,} VND"
def en_facts(x):
    pr = mprices(x) or prices(x); tags = [lang(t, "en") for t in (x.get("tags") or []) if lang(t, "en")]
    s_ = f"{ename(x)} is a {SUB_EN.get(x.get('cat'), 'beauty business')} in {ecity(x.get('city'))}."
    if pr: s_ += f" Prices from {vnd(pr[0])} (reference price checked by Uncle Day)."
    if tags: s_ += f" Highlights: {', '.join(tags[:3])}."
    if "en" in (x.get("staffLangs") or []): s_ += " English-speaking staff."
    return s_ + " Book through Uncle Day at the shop’s own price — no extra fee."
EN_CSS_FONT = '<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">'
def en_shell(title, desc, url, ko_url, cid, lds, body, kind="website", upd=BUILT, img=None):
    js = lambda o: json.dumps(o, ensure_ascii=False).replace("</", "<\\/")
    nav = "".join(f'<a href="/en/c/{k}/" class="{"on" if k == cid else ""}">{esc(ecity(k))}</a>' for k in hubs)
    css = HUB_CSS + """.box{background:#fff;border-radius:16px;padding:14px 18px;border:1px solid var(--line)}.box ul{padding-left:18px;margin:6px 0 0}.box li{margin:3px 0;font-size:14.5px}
.tb{border-collapse:collapse;width:100%;max-width:560px;background:#fff;border-radius:12px;overflow:hidden}.tb th,.tb td{padding:9px 12px;border-bottom:1px solid var(--line);text-align:left;font-size:14.5px}.tb th{background:var(--sand)}
h3{font-size:16px;margin:16px 0 4px}.muted{color:var(--sub);font-size:13px}.kinds dd small{color:var(--sub)}.src{font-size:13.5px}sup a{text-decoration:none}.toc{font-size:13.5px;color:var(--sub)}.toc a{margin-right:10px}"""
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(title)}</title><meta name="description" content="{esc(desc[:155])}"><link rel="canonical" href="{url}">
<link rel="alternate" hreflang="en" href="{url}"><link rel="alternate" hreflang="ko" href="{ko_url}"><link rel="alternate" hreflang="x-default" href="{ko_url}">
<meta property="og:type" content="{kind}"><meta property="og:site_name" content="Uncle Day"><meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(desc[:155])}"><meta property="og:url" content="{url}"><meta property="og:image" content="{img or SITE + '/images/og-image.jpg'}"><meta property="og:locale" content="en_US">
{f'<meta property="article:modified_time" content="{upd}">' if kind == "article" else ""}<link rel="icon" type="image/png" sizes="32x32" href="/images/favicon-32.png">{EN_CSS_FONT}
<style>{css}</style>
{"".join(f'<script type="application/ld+json">{js(o)}</script>' for o in lds)}
</head><body><header class="hd"><div class="in"><a class="logo" href="/"><img src="/images/logo-full.webp" alt="Uncle Day" width="167" height="72"></a><nav>{nav}<a href="{ko_url.replace(SITE, '')}" lang="ko">한국어</a></nav>{HCTA_EN}</div></header>
<main class="wrap">{body}</main>
<footer class="wrap">Uncle Day — book trusted massage, spa and beauty shops in Vietnam · <a href="/">Home</a></footer>{TRACK()}</body></html>
"""
DAYS_EN_S = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
LANG_EN = {"ko": "Korean", "en": "English", "vi": "Vietnamese", "zh": "Chinese", "ja": "Japanese", "ru": "Russian"}
def en_shop_page(x):
    """업체 영어 페이지 en/s/<id>/ — 영어로 가게 이름을 검색하는 외국인 · AI 용 (업체 데이터의 영어 값만 사용)"""
    sid = x["id"]; cid = x.get("city"); cen = ecity(cid); nm = ename(x); kind = SUB_EN.get(x.get("cat"), "beauty business"); kind2 = SUB_EN2.get(x.get("cat"), "Beauty")
    url = f"{SITE}/en/s/{sid}/"; ko = f"{SITE}/s/{sid}/"; img = OGIMG.get(sid)
    desc_en = re.sub(r"\s+", " ", lang(x.get("desc"), "en")).strip(); rec = lang(x.get("recommend"), "en")
    tags = [lang(t, "en") for t in (x.get("tags") or []) if lang(t, "en")]
    menu = [m for m in (x.get("menu") or []) if lang(m.get("name"), "en") or tx(m.get("name"))]
    pr = prices(x); closed = x.get("closed") or []
    addr_ko = tx(x.get("address")); addr = lang(x.get("address"), "en") or lang(x.get("address"), "vi")
    addr_ok = bool(addr) and not re.search(r"확인 중|to be confirmed", (addr_ko or "") + addr, re.I)
    hours = f"{x['open']} – {x.get('close', '')}" + (f" (closed {', '.join(DAYS_EN_S[d] for d in closed)})" if closed else " daily") if x.get("open") else ""
    langs = [LANG_EN.get(l, l) for l in (x.get("staffLangs") or [])]
    rv = [r for r in (x.get("userReviews") or []) if (r.get("text") or "").strip()]
    avg = round(sum(r.get("stars", 0) for r in rv) / len(rv), 1) if rv else 0
    summary = en_facts(x)
    title = f"{nm} {cen} — {kind2} prices, reviews & booking | Uncle Day"
    meta = f"{nm} in {cen}, Vietnam: " + (f"prices from {vnd(pr[0])}, " if pr else "") + (f"{len(rv)} guest review{'s' if len(rv) > 1 else ''}, " if rv else "") + "opening hours, location and booking with no extra fee."
    ld = {"@context": "https://schema.org", "@type": SCHEMA_TYPE.get(x.get("cat"), "HealthAndBeautyBusiness"), "@id": url + "#shop", "name": nm, "url": url, "description": desc_en or summary}
    if img: ld["image"] = img
    if tx(x.get("name")) != nm: ld["alternateName"] = tx(x.get("name"))
    if addr_ok: ld["address"] = {"@type": "PostalAddress", "streetAddress": addr, "addressLocality": cen, "addressCountry": "VN"}
    if x.get("geo"): ld["geo"] = {"@type": "GeoCoordinates", "latitude": x["geo"][0], "longitude": x["geo"][1]}
    if x.get("open") and x.get("close"): ld["openingHoursSpecification"] = [{"@type": "OpeningHoursSpecification", "dayOfWeek": [DAYS_EN[d] for d in range(7) if d not in closed], "opens": x["open"], "closes": x["close"]}]
    if x.get("staffLangs"): ld["knowsLanguage"] = x["staffLangs"]
    if pr: ld["priceRange"] = f"{pr[0]:,}–{pr[-1]:,} VND" if len(pr) > 1 else f"from {pr[0]:,} VND"
    offers = [{"@type": "Offer", "name": lang(m["name"], "en") or tx(m["name"]), "price": int(m["price"]), "priceCurrency": "VND"} for m in menu if isinstance(m.get("price"), (int, float)) and m["price"] > 0]
    if offers: ld["hasOfferCatalog"] = {"@type": "OfferCatalog", "name": "Menu", "itemListElement": offers}
    if rv:   # 엉클데이에서 실제 방문 손님이 남긴 후기만 (구글 후기 아님)
        ld["aggregateRating"] = {"@type": "AggregateRating", "ratingValue": avg, "reviewCount": len(rv), "bestRating": 5, "worstRating": 1}
        ld["review"] = [{"@type": "Review", "reviewRating": {"@type": "Rating", "ratingValue": r.get("stars", 5), "bestRating": 5}, "author": {"@type": "Person", "name": r.get("name") or "Guest"}, "reviewBody": r["text"][:500], "inLanguage": "ko"} for r in rv[:5]]
    faq = [(f"Can I book {nm} in English?", f"Yes. Send a message through Uncle Day (site chat or KakaoTalk) and we confirm the booking with the shop for you." + (f" Staff at the shop speak {', '.join(langs)}." if langs else "")),
           (f"How much does {nm} cost?", ((f"Reference prices checked by Uncle Day start from {vnd(pr[0])}" + (f" up to {vnd(pr[-1])}" if len(pr) > 1 else "") + ".") if pr else "Prices depend on the menu — we tell you the exact price when you ask.") + " Booking through Uncle Day costs the same as the shop price, with no extra fee.")]
    if hours: faq.append((f"What are {nm}'s opening hours?", f"Open {hours}."))
    if addr_ok: faq.append((f"Where is {nm}?", f"{addr}." if cen.lower() in addr.lower() else f"{addr}, {cen}."))
    faq.append(("How do I pay?", "You pay the shop directly after your treatment. Uncle Day charges you nothing."))
    faq_ld = {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faq]}
    crumbs = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Uncle Day", "item": SITE + "/"},
        {"@type": "ListItem", "position": 2, "name": f"{cen} massage, spa & beauty", "item": f"{SITE}/en/c/{cid}/"},
        {"@type": "ListItem", "position": 3, "name": nm, "item": url}]}
    gmap = f"https://www.google.com/maps/search/?api=1&query={x['geo'][0]},{x['geo'][1]}" if x.get("geo") else (x.get("map") or "")
    near = [y for y in live if y.get("city") == cid and y["id"] != sid and grp(y) == grp(x)][:3]
    body = f"""<p class="date"><a href="/en/c/{cid}/">← {esc(cen)} massage, spa &amp; beauty</a></p>
<h1>{esc(nm)} <small class="en">{esc(cen)} · {esc(kind2)}</small></h1>
<p class="lead"><b>{esc(summary)}</b></p>
{f'<p>{" ".join(f"<span class=chip>#{esc(t)}</span>" for t in tags)}</p>' if tags else ''}
{f'<p>{esc(desc_en)}</p>' if desc_en else ''}
{f'<p><b>Great for:</b> {esc(rec)}</p>' if rec else ''}
<div class="box"><ul>{f'<li>📍 <b>Address:</b> {esc(addr)}</li>' if addr_ok else ''}{f'<li>🕒 <b>Hours:</b> {esc(hours)}</li>' if hours else ''}{f'<li>🗣️ <b>Staff languages:</b> {esc(", ".join(langs))}</li>' if langs else ''}<li>💳 <b>Payment:</b> pay the shop directly after your treatment — no booking fee</li>{f'<li>🗺️ <a data-cta="map" href="{esc(gmap)}" target="_blank" rel="noopener">Open in Google Maps</a></li>' if gmap else ''}</ul></div>
<p><a class="cta" data-cta="book" href="/s/{sid}/?lang=en">Check availability &amp; book</a> <a class="cta" style="background:var(--green)" data-cta="kakao" href="{KAKAO}" target="_blank" rel="noopener">💬 Ask us</a></p>
{('<h2>Menu &amp; prices</h2><table class="tb"><tr><th>Treatment</th><th>Price</th></tr>' + ''.join(f'<tr><td>{esc(lang(m["name"], "en") or tx(m["name"]))}</td><td>{vnd(int(m["price"])) if isinstance(m.get("price"), (int, float)) and m["price"] > 0 else "Ask us"}</td></tr>' for m in menu) + '</table><p class="muted">Reference prices checked by Uncle Day. Booking through Uncle Day costs the same as the shop price.</p>') if menu else ''}
{(f'<h2>Guest reviews ({len(rv)}) · ★ {avg}</h2><p class="muted">Written on Uncle Day by guests who booked and visited (original language, mostly Korean).</p>' + ''.join(f'<div class="box" style="margin:8px 0"><b>{"★" * int(r.get("stars", 5))}</b> <small class="muted">{esc(r.get("name") or "Guest")}</small><p style="margin:4px 0 0" lang="ko">{esc(r["text"][:400])}</p></div>' for r in rv[:5])) if rv else ''}
<h2>FAQ</h2><dl>{''.join(f'<dt>{esc(q)}</dt><dd>{esc(a)}</dd>' for q, a in faq)}</dl>
{(f'<h2>Similar shops in {esc(cen)}</h2><div class="grid">' + ''.join(f'<a class="card" data-cta="shop" href="/en/s/{y["id"]}/"><b>{esc(ename(y))}</b><small>{esc(SUB_EN2.get(y.get("cat"), ""))}</small><p>{esc(en_facts(y)[:120])}…</p></a>' for y in near) + '</div>') if near else ''}
<p class="date">Last checked: {checked(x)} · <a href="/s/{sid}/" lang="ko" hreflang="ko">한국어</a></p>"""
    css_x = ".chip{display:inline-block;background:#fff;border:1px solid var(--line);border-radius:999px;padding:3px 10px;font-size:13px;margin:0 4px 4px 0}"
    return en_shell(title, meta, url, ko, cid, [ld, crumbs, faq_ld], f"<style>{css_x}</style>" + body, upd=checked(x), img=img)
def en_hub_page(cid, shops_c):
    url = f"{SITE}/en/c/{cid}/"; cen = ecity(cid)
    by = {g: [x for x in shops_c if grp(x) == g] for g, _, _ in GROUPS}
    allp = [p for x in shops_c for p in mprices(x) if grp(x) == "spabody"]
    upd = max([checked(x) for x in shops_c] or [BUILT])
    lead = f"Uncle Day lists {len(shops_c)} shops in {cen}, Vietnam ({', '.join(f'{len(by[g])} {le.lower()}' for g, _, le in GROUPS if by[g])}). Every shop is bookable online at the shop’s own price — no extra fee, and only real visitors can leave reviews."
    if allp: lead += f" Massage and spa reference prices start from {vnd(min(allp))}."
    faq = [(f"Where can I book a massage in {cen}?", f"Uncle Day lists {len(by['spabody'])} massage and spa shops in {cen}. Send a booking request on the shop page; Uncle Day confirms with the shop and sends you the details."),
           ("Is it more expensive to book through Uncle Day?", "No. You pay the shop’s own price directly at the shop after your treatment. Uncle Day charges guests nothing."),
           ("Are the reviews real?", "Only guests who actually booked and visited can leave a review on Uncle Day.")]
    if allp: faq.insert(1, (f"How much is a massage in {cen}?", f"Reference prices checked by Uncle Day for {cen} massage and spa shops range from {vnd(min(allp))} to {vnd(max(allp))}, depending on the menu and duration."))
    sec, items = "", []
    for g, _, le in GROUPS:
        if not by[g]: continue
        sec += f'<h2>{esc(cen)} {esc(le.lower())}</h2><div class="grid">'
        for x in by[g]:
            u = f"/en/s/{x['id']}/"; pr = mprices(x) or prices(x)
            sec += f'<a class="card" href="{u}"><b>{esc(ename(x))}</b><small>{esc(SUB_EN2.get(x.get("cat"), ""))}{" · from " + vnd(pr[0]) if pr else ""}</small><p>{esc(en_facts(x))}</p></a>'
            items.append({"@type": "ListItem", "position": len(items) + 1, "url": SITE + u, "name": ename(x)})
        sec += "</div>"
    title = f"{cen} Massage, Spa & Beauty — {len(shops_c)} Trusted Shops | Uncle Day"
    lds = [{"@context": "https://schema.org", "@type": "CollectionPage", "name": title, "url": url, "inLanguage": "en", "dateModified": upd, "description": lead, "mainEntity": {"@type": "ItemList", "numberOfItems": len(items), "itemListElement": items}},
           {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faq]}]
    body = f"""<h1>{esc(cen)} massage, spa &amp; beauty</h1><p class="lead"><b>{esc(lead)}</b></p><p class="date">Last checked: {upd} · Uncle Day (uncleday.com)</p>
<a class="cta" data-cta="book" href="/?city={cid}">See {esc(cen)} shops on Uncle Day</a>{f' <a class="cta" data-cta="guide" style="background:var(--green)" href="/en/c/{cid}/guide/">📘 {esc(cen)} massage guide (prices, tipping, how to choose)</a>' if cid in GUIDES_EN else ''}
<style>{TOPIC_CSS}</style>{topic_chips(cid, shops_c, en=True)}
{sec}<h2>FAQ</h2><dl>{"".join(f"<dt>{esc(q)}</dt><dd>{esc(a)}</dd>" for q, a in faq)}</dl>"""
    return en_shell(title, lead, url, f"{SITE}/c/{cid}/", cid, lds, body, upd=upd)
def en_guide_page(cid, shops_c):
    G = GUIDES[cid]; E = GUIDES_EN[cid]; cen = ecity(cid); url = f"{SITE}/en/c/{cid}/guide/"
    sp = [x for x in shops_c if grp(x) == "spabody"]
    link = lambda x: f'<a href="/en/s/{x["id"]}/">{esc(ename(x))}</a>'
    lst = lambda xs: ", ".join(link(x) for x in xs) if xs else "none yet"
    used = []
    def S(keys):
        for k in keys:
            if k not in used: used.append(k)
        return " ".join(f'<sup><a href="#src-{k}">[{used.index(k) + 1}]</a></sup>' for k in keys)
    en_staff = [x for x in sp if "en" in (x.get("staffLangs") or [])]
    feats = [("🗣️ English-speaking staff", en_staff), ("🧳 Luggage storage", [x for x in sp if has(x, "짐 보관")]), ("🚐 Pickup / drop-off", [x for x in sp if has(x, "픽업|샌딩")]),
             ("🚿 Shower", [x for x in sp if has(x, "샤워")]), ("🌙 Open past 11 pm", [x for x in sp if late(x)])]
    rows = {}
    for x in sp:
        for m in x.get("menu") or []:
            if is_massage(m) and isinstance(m.get("price"), (int, float)) and m["price"] > 0 and m.get("min"):
                rows.setdefault(60 if m["min"] <= 60 else 90 if m["min"] <= 90 else 120, []).append((int(m["price"]), x))
    rng = lambda v: vnd(min(p for p, _ in v)) + (" – " + vnd(max(p for p, _ in v)) if max(p for p, _ in v) > min(p for p, _ in v) else "")
    ptab = "".join(f'<tr><td>{"120 min+" if k == 120 else str(k) + " min"}</td><td>{rng(v)}</td><td>{len({id(x) for _, x in v})}</td></tr>' for k, v in sorted(rows.items()))
    summary = f"Uncle Day lists {len(sp)} massage and spa shops in {cen}."
    if rows: k0 = 60 if 60 in rows else min(rows); summary += f" Reference prices checked by Uncle Day start from {vnd(min(p for p, _ in rows[k0]))} for {'120+' if k0 == 120 else k0} minutes."
    tips = [(q, a, keys) for (q, a), (_, _, keys) in zip(E["tip"], G["tip"])]
    faq = [(q, a) for q, a, _ in tips] + E.get("faq_extra", []) + [("Is it more expensive to book through Uncle Day?", "No. You pay the shop’s own price directly at the shop. Uncle Day charges guests nothing.")]
    kinds = [(n, d_, pat) for (n, d_), (_, pat, _) in zip(E["kinds"], G["kinds"])]
    areas = [(n, d_, pat) for (n, d_), (_, pat, _) in zip(E["areas"], G["areas"])]
    body = f"""<h1>{esc(E['title'])}</h1><p class="date">Updated: {max([G['checked']] + [checked(x) for x in sp])} · Uncle Day (uncleday.com)</p>
<p class="toc">{" ".join(f'<a href="#{i}">{n}</a>' for i, n in [("price", "Prices"), ("tip", "Tipping"), ("kinds", "Types"), ("area", "Areas"), ("when", "Before your flight")] + ([("clinic", "Clinics")] if E.get("clinic") else []) + [("book", "Booking"), ("faq", "FAQ")])}</p>
<p class="lead">{esc(E['intro'])}</p>
<div class="box"><b>At a glance</b><p>{esc(summary)}</p><ul>{"".join(f"<li><b>{l}</b> {len(v)} — {lst(v)}</li>" for l, v in feats)}</ul></div>
<h2 id="price">How much does a massage cost?</h2>
{f'<table class="tb"><thead><tr><th>Duration</th><th>Uncle Day reference price</th><th>Shops</th></tr></thead><tbody>{ptab}</tbody></table>' if ptab else ''}
{f"<p>{esc(E['price_note'])} {S([G['price_src']])}</p>" if E.get('price_note') and G.get('price_src') else ''}{'' if rows else '<p>Uncle Day has only a few checked prices here so far — ask on the shop page and we’ll quote the menu.</p>'}<p class="muted">Prices vary by menu, duration and season. Check the shop page for the latest prices.</p>
<h2 id="tip">How much should I tip?</h2>{"".join(f"<h3>{esc(q)}</h3><p>{esc(a)} {S(k)}</p>" for q, a, k in tips)}
<h2 id="kinds">Which massage should I choose?</h2><dl class="kinds">{"".join(f"<dt>{esc(n)}</dt><dd>{esc(d_)}<br><small>Available at: {lst([x for x in sp if has(x, pat)])}</small></dd>" for n, d_, pat in kinds)}</dl>
<h2 id="area">Which area?</h2><dl class="kinds">{"".join(f"<dt>{esc(n)}</dt><dd>{esc(d_)}<br><small>{lst([x for x in sp if has(x, pat)])}</small></dd>" for n, d_, pat in areas)}</dl>
<h2 id="when">Last stop before your flight</h2><p>{esc(E['when'])} {S([G['when_src']]) if G.get('when_src') else ''}</p>
<p>Uncle Day shops with luggage storage, showers or drop-off: {lst([x for x in sp if has(x, "짐 보관|샤워|샌딩")])}</p>
{f'<h2 id="clinic">Cosmetic and dermatology clinics</h2><p>{esc(E["clinic"])}</p><p>Clinics on Uncle Day in {esc(cen)}: {lst([x for x in shops_c if grp(x) != "spabody"])}</p>' if E.get("clinic") else ''}
<h2 id="book">How to book with Uncle Day</h2><ol><li>Pick a time, party size and menu on the shop page and send a booking request, or ask us in the site chat.</li>
<li>Uncle Day confirms with the shop and sends you the address and directions.</li><li>Visit on time and pay the shop’s own price at the shop after your treatment — no extra fee to Uncle Day.</li><li>After your visit you can review your therapist. Only real visitors can review.</li></ol>
<p><a class="cta" href="/en/c/{cid}/">See all {len(shops_c)} shops in {esc(cen)}</a></p>
<h2 id="faq">FAQ</h2><dl>{"".join(f"<dt>{esc(q)}</dt><dd>{esc(a)}</dd>" for q, a in faq)}</dl>
<h2 id="src">Sources</h2><ol class="src">{"".join(f'<li id="src-{k}"><a href="{SOURCES[k][1]}" rel="nofollow noopener" target="_blank">{esc(SOURCES_EN.get(k, SOURCES[k][0]))}</a></li>' for k in used)}</ol>
<p class="muted">Shop details are checked by Uncle Day. Figures from outside sources reflect each source’s publication date.</p>"""
    upd = max([G["checked"]] + [checked(x) for x in sp])
    lds = [{"@context": "https://schema.org", "@type": "Article", "headline": E["title"], "inLanguage": "en", "url": url, "dateModified": upd, "datePublished": G["checked"],
            "author": {"@type": "Organization", "name": "Uncle Day", "url": SITE + "/"}, "publisher": {"@type": "Organization", "name": "Uncle Day", "logo": {"@type": "ImageObject", "url": SITE + "/images/logo-og.png"}},
            "image": SITE + "/images/og-image.jpg", "description": summary, "citation": [SOURCES[k][1] for k in used]},
           {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faq]}]
    return en_shell(E["title"] + " | Uncle Day", summary + " Prices, tipping, how to choose and how to book.", url, f"{SITE}/c/{cid}/guide/", cid, lds, body, "article", upd)

# ---- 검색어 맞춤 페이지 c/<도시>/<주제>/ (tools/topics.py) ----
from topics import TOPICS, TOPICS_EN, MIN as TOPIC_MIN
def topic_shops(t, shops_c):
    pool = [x for x in shops_c if grp(x) == "spabody"] if t.get("spa") else shops_c
    fn = t.get("fn")
    if fn == "korean": return [x for x in pool if "ko" in (x.get("staffLangs") or []) or has(x, "한국어|한국인")]
    if fn == "late": return [x for x in pool if late(x)]
    if fn == "nail": return [x for x in pool if x.get("cat") == "nail" or has(x, "네일|속눈썹")]
    if fn == "clinic": return [x for x in pool if x.get("cat") in ("surgery", "derma", "skin", "dental")]
    return [x for x in pool if has(x, t["pat"])]
def city_topics(cid, shops_c):
    out = []
    for t in TOPICS:
        xs = topic_shops(t, shops_c)
        if len(xs) >= TOPIC_MIN: out.append((t, xs))
    return out
YEAR = BUILT[:4]
def topic_chips(cid, shops_c, en=False, cur=None):
    ts = city_topics(cid, shops_c)
    if not ts: return ""
    pre = "/en" if en else ""
    return ('<h2>' + ("Browse by topic" if en else "주제별로 찾기") + '</h2><p class="chips">' + "".join(
        f'<a class="chip{" on" if t["id"] == cur else ""}" href="{pre}/c/{cid}/{t["id"]}/">{esc(TOPICS_EN[t["id"]][0] if en else t["kw"])} <span>{len(xs)}</span></a>' for t, xs in ts) + '</p>')
TOPIC_CSS = ".chips{display:flex;flex-wrap:wrap;gap:6px}.chip{border:1px solid var(--line);background:#fff;border-radius:999px;padding:6px 12px;font-size:14px;color:#0e2843!important;text-decoration:none;font-weight:600}.chip span{color:var(--sub);font-weight:500}.chip.on{background:var(--green);border-color:var(--green);color:#fff!important}.chip.on span{color:#d9eadf}"
def topic_page(cid, t, xs, shops_c):
    city = cities.get(cid, {}); cko = tx(city.get("name")); url = f"{SITE}/c/{cid}/{t['id']}/"
    n = len(xs); pr = sorted(p for x in xs for p in (mprices(x) if t.get("spa") else prices(x)))
    title = f"{cko} {t['kw']} {n}곳 ({YEAR}) — 한국어 예약 | 엉클데이"
    lead = f"엉클데이에 등록된 {cko} 업체 중 '{t['kw']}' 조건에 맞는 곳은 {n}곳이에요. {t['why']}"
    if pr: lead += f" 엉클데이가 확인한 참고가는 {won(pr[0])}부터예요."
    upd = max([checked(x) for x in xs] or [BUILT])
    faq = [(f"{cko}에서 {t['kw']} 어디가 있어요?", f"엉클데이에 등록된 곳은 {', '.join(tx(x.get('name')) for x in xs)}이에요. 업체마다 한국어로 상담하고 예약할 수 있어요."),
           ("엉클데이로 예약하면 더 비싼가요?", "아니요. 매장 가격 그대로이고 손님이 엉클데이에 따로 내는 돈은 없어요. 결제는 시술 후 매장에서 직접 해요.")]
    if pr: faq.insert(1, ("가격은 얼마쯤이에요?", f"엉클데이가 확인한 참고가는 {won(pr[0])}부터{(' ' + won(pr[-1]) + '까지') if len(pr) > 1 else ''}예요. 메뉴와 시간에 따라 달라요."))
    cards = "".join(f'<a class="card" data-cta="shop" href="/s/{x["id"]}/"><b>{esc(tx(x.get("name")))}</b><small>{esc(SUB_KO.get(x.get("cat"), ""))}{(" · " + won((mprices(x) or prices(x))[0]) + "부터") if (mprices(x) or prices(x)) else ""}{(" · ~" + x["close"]) if t["id"] == "late" and x.get("close") else ""}</small><p>{esc(facts(x)[0])}</p></a>' for x in xs)
    items = [{"@type": "ListItem", "position": i + 1, "url": f"{SITE}/s/{x['id']}/", "name": tx(x.get("name"))} for i, x in enumerate(xs)]
    js = lambda o: json.dumps(o, ensure_ascii=False).replace("</", "<\\/")
    lds = [{"@context": "https://schema.org", "@type": "CollectionPage", "name": title, "url": url, "inLanguage": "ko", "dateModified": upd, "description": lead, "mainEntity": {"@type": "ItemList", "numberOfItems": n, "itemListElement": items}},
           {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faq]},
           {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [{"@type": "ListItem", "position": 1, "name": "엉클데이", "item": SITE + "/"}, {"@type": "ListItem", "position": 2, "name": cko, "item": f"{SITE}/c/{cid}/"}, {"@type": "ListItem", "position": 3, "name": t["kw"], "item": url}]}]
    nav = "".join(f'<a href="/c/{k}/" class="{"on" if k == cid else ""}">{esc(tx(cities[k]["name"]))}</a>' for k in hubs)
    return f"""<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(title)}</title><meta name="description" content="{esc(lead[:155])}"><link rel="canonical" href="{url}">
<link rel="alternate" hreflang="ko" href="{url}"><link rel="alternate" hreflang="en" href="{SITE}/en/c/{cid}/{t['id']}/"><link rel="alternate" hreflang="x-default" href="{url}">
<meta property="og:type" content="website"><meta property="og:site_name" content="엉클데이 Uncle Day"><meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(lead[:155])}"><meta property="og:url" content="{url}"><meta property="og:image" content="{SITE}/images/og-image.jpg">
<link rel="icon" type="image/png" sizes="32x32" href="/images/favicon-32.png"><link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<style>{HUB_CSS}{TOPIC_CSS}</style>
{"".join(f'<script type="application/ld+json">{js(o)}</script>' for o in lds)}
</head><body><header class="hd"><div class="in"><a class="logo" href="/"><img src="/images/logo-full.webp" alt="엉클데이 Uncle Day" width="167" height="72"></a><nav>{nav}<a href="/en/c/{cid}/{t['id']}/" lang="en">EN</a></nav>{HCTA}</div></header>
<main class="wrap"><h1>{esc(cko)} {esc(t['kw'])} {n}곳</h1><p class="lead"><b>{esc(lead)}</b></p><p class="date">정보 확인: {upd} · 엉클데이(uncleday.com)</p>
<div class="grid">{cards}</div>
<p><a class="cta" href="/c/{cid}/">{esc(cko)} 업체 모두 보기</a>{f' <a class="cta" data-cta="guide" style="background:var(--green)" href="/c/{cid}/guide/">📘 {esc(cko)} 마사지 가이드</a>' if cid in GUIDES else ''}</p>
{topic_chips(cid, shops_c, cur=t['id'])}
<h2>자주 묻는 질문</h2><dl>{"".join(f"<dt>{esc(q)}</dt><dd>{esc(a)}</dd>" for q, a in faq)}</dl></main>
<footer class="wrap">엉클데이 Uncle Day — 베트남 마사지 · 스파 · 뷰티 한국어 예약 · <a href="/">홈</a> · <a href="/c/{cid}/">{esc(cko)} 업체</a></footer>{TRACK()}</body></html>
"""
def en_topic_page(cid, t, xs, shops_c):
    cen = ecity(cid); url = f"{SITE}/en/c/{cid}/{t['id']}/"; name, why = TOPICS_EN[t["id"]]
    n = len(xs); pr = sorted(p for x in xs for p in (mprices(x) if t.get("spa") else prices(x)))
    title = f"{name} in {cen} — {n} shops ({YEAR}) | Uncle Day"
    lead = f"Uncle Day lists {n} shops in {cen} that match “{name.lower()}”. {why}"
    if pr: lead += f" Reference prices start from {vnd(pr[0])}."
    upd = max([checked(x) for x in xs] or [BUILT])
    faq = [(f"Where can I find {name.lower()} in {cen}?", f"Shops listed on Uncle Day: {', '.join(ename(x) for x in xs)}."),
           ("Is it more expensive to book through Uncle Day?", "No. You pay the shop’s own price at the shop. Uncle Day charges guests nothing.")]
    cards = "".join(f'<a class="card" data-cta="shop" href="/en/s/{x["id"]}/"><b>{esc(ename(x))}</b><small>{esc(SUB_EN2.get(x.get("cat"), ""))}{(" · from " + vnd((mprices(x) or prices(x))[0])) if (mprices(x) or prices(x)) else ""}{(" · until " + x["close"]) if t["id"] == "late" and x.get("close") else ""}</small><p>{esc(en_facts(x))}</p></a>' for x in xs)
    items = [{"@type": "ListItem", "position": i + 1, "url": f"{SITE}/en/s/{x['id']}/", "name": ename(x)} for i, x in enumerate(xs)]
    lds = [{"@context": "https://schema.org", "@type": "CollectionPage", "name": title, "url": url, "inLanguage": "en", "dateModified": upd, "description": lead, "mainEntity": {"@type": "ItemList", "numberOfItems": n, "itemListElement": items}},
           {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faq]}]
    body = f"""<h1>{esc(name)} in {esc(cen)} — {n} shops</h1><p class="lead"><b>{esc(lead)}</b></p><p class="date">Last checked: {upd} · Uncle Day (uncleday.com)</p>
<div class="grid">{cards}</div><p><a class="cta" href="/en/c/{cid}/">All shops in {esc(cen)}</a>{f' <a class="cta" data-cta="guide" style="background:var(--green)" href="/en/c/{cid}/guide/">📘 {esc(cen)} massage guide</a>' if cid in GUIDES_EN else ''}</p>
<style>{TOPIC_CSS}</style>{topic_chips(cid, shops_c, en=True, cur=t['id'])}
<h2>FAQ</h2><dl>{"".join(f"<dt>{esc(q)}</dt><dd>{esc(a)}</dd>" for q, a in faq)}</dl>"""
    return en_shell(title, lead, url, f"{SITE}/c/{cid}/{t['id']}/", cid, lds, body, upd=upd)

# ---- 💰 시술 × 도시 가격 페이지 c/<도시>/price/<시술>/ (tools/treatments.py) — 캐시바이 '제품 번호 → 페이지'의 엉클데이판 ----
from treatments import TREATMENTS, MIN as TREAT_MIN
TMAP = {t["id"]: t for t in TREATMENTS}
def treat_rows(t, xs):
    out = []
    for x in xs:
        for m in (x.get("menu") or []):
            if not (isinstance(m.get("price"), (int, float)) and m["price"] > 0): continue
            nm = tx(m.get("name")) + " " + lang(m.get("name"), "en")
            if re.search(t["pat"], nm, re.I) and not (t["no"] and re.search(t["no"], nm, re.I)): out.append((x, m))
    return sorted(out, key=lambda r: r[1]["price"])
def city_treats(cid, xs):
    return [(t, rs) for t in TREATMENTS for rs in [treat_rows(t, xs)] if len({r[0]["id"] for r in rs}) >= TREAT_MIN]
def med(v): v = sorted(v); n = len(v); return v[n // 2] if n % 2 else (v[n // 2 - 1] + v[n // 2]) // 2
def dur_of(m):
    if isinstance(m.get("min"), (int, float)) and m["min"] > 0: return int(m["min"])
    g = re.search(r"(\d{2,3})\s*(?:분|min)", tx(m.get("name")) + " " + lang(m.get("name"), "en")); return int(g.group(1)) if g else 0
def by_dur(rows):
    g = {}
    for x, m in rows:
        dd = dur_of(m)
        if dd: g.setdefault(dd, []).append(int(m["price"]))
    return {k: v for k, v in sorted(g.items()) if len(v) >= 2}
def price_summary(cko, t, rows, en=False):
    ps = [int(m["price"]) for _, m in rows]; ns = len({x["id"] for x, _ in rows}); bd = by_dur(rows)
    if en:
        s_ = f"Based on {len(ps)} menu items from {ns} Uncle Day shops in {cko}, {t['en'].lower()} costs {vnd(ps[0])}" + (f" to {vnd(ps[-1])} (median {vnd(med(ps))})" if len(ps) > 1 else "") + "."
        if bd: s_ += " By duration: " + ", ".join(f"{k} min {vnd(min(v))}–{vnd(max(v))}" for k, v in bd.items()) + "."
        return s_
    s_ = f"엉클데이가 확인한 {cko} 업체 {ns}곳 · 메뉴 {len(ps)}개 기준으로 {t['kw']} 가격은 {won(ps[0])}" + (f"부터 {won(ps[-1])}까지예요 (가운데 값 {won(med(ps))})." if len(ps) > 1 else "이에요.")
    if bd: s_ += " 시간별로는 " + ", ".join(f"{k}분 {won(min(v))}~{won(max(v))}" for k, v in bd.items()) + "예요."
    return s_
PRICE_CSS = ".tb{border-collapse:collapse;width:100%;background:#fff;border-radius:14px;overflow:hidden;border:1px solid var(--line)}.tb th,.tb td{padding:10px 12px;border-bottom:1px solid var(--line);text-align:left;font-size:14.5px;vertical-align:top}.tb th{background:var(--sand);font-size:13px}.tb td.n{text-align:right;white-space:nowrap;font-weight:700}.tb small{color:var(--sub);display:block;font-size:12.5px}.qa{background:#fff;border:1px solid var(--line);border-radius:16px;padding:14px 18px;margin:12px 0}.qa .who{font-size:12.5px;font-weight:700;color:var(--green);margin-bottom:4px}@media(max-width:560px){.tb th:nth-child(3),.tb td:nth-child(3){display:none}}"
def price_page(cid, t, rows, all_t):
    city = cities.get(cid, {}); cko = tx(city.get("name")); url = f"{SITE}/c/{cid}/price/{t['id']}/"
    ps = [int(m["price"]) for _, m in rows]; ns = len({x["id"] for x, _ in rows}); upd = max(checked(x) for x, _ in rows)
    summ = price_summary(cko, t, rows)
    title = f"{cko} {t['kw']} 가격 ({YEAR}) — 업체 {ns}곳 실제 메뉴 비교 | 엉클데이"
    q = f"{cko} {t['kw']} 가격은 얼마예요?"
    trs = "".join(f'<tr><td><a data-cta="shop" href="/s/{x["id"]}/">{esc(tx(x.get("name")))}</a><small>{esc(SUB_KO.get(x.get("cat"), ""))}</small></td><td>{esc(tx(m.get("name")))}</td><td>{(str(dur_of(m)) + "분") if dur_of(m) else "-"}</td><td class="n">{won(int(m["price"]))}</td></tr>' for x, m in rows)
    faq = [(q, summ + " 매장 가격 그대로이고 엉클데이로 예약해도 추가 요금은 없어요."),
           ("가격이 바뀔 수도 있나요?", f"이 가격은 엉클데이가 {upd}까지 확인한 참고가예요. 매장 사정으로 바뀔 수 있어서 예약할 때 엉클데이가 다시 확인해 드려요."),
           ("어떻게 예약해요?", "업체 이름을 눌러 엉클데이 사이트에서 예약 요청을 보내거나, 카카오톡으로 한국어 상담을 받으면 돼요. 결제는 시술 후 매장에서 직접 해요.")]
    others = "".join(f'<a class="chip{" on" if tt["id"] == t["id"] else ""}" href="/c/{cid}/price/{tt["id"]}/">{esc(tt["kw"])} <span>{len({r[0]["id"] for r in rr})}곳</span></a>' for tt, rr in all_t)
    js = lambda o: json.dumps(o, ensure_ascii=False).replace("</", "<\\/")
    lds = [{"@context": "https://schema.org", "@type": "WebPage", "name": title, "url": url, "inLanguage": "ko", "dateModified": upd, "description": summ,
            "mainEntity": {"@type": "ItemList", "numberOfItems": len(rows), "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": f"{tx(x.get('name'))} — {tx(m.get('name'))} {int(m['price']):,} VND", "url": f"{SITE}/s/{x['id']}/"} for i, (x, m) in enumerate(rows[:50])]}},
           {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": a, "acceptedAnswer": {"@type": "Answer", "text": b}} for a, b in faq]},
           {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [{"@type": "ListItem", "position": 1, "name": "엉클데이", "item": SITE + "/"}, {"@type": "ListItem", "position": 2, "name": cko, "item": f"{SITE}/c/{cid}/"}, {"@type": "ListItem", "position": 3, "name": f"{cko} 시술별 가격", "item": f"{SITE}/c/{cid}/price/"}, {"@type": "ListItem", "position": 4, "name": t["kw"], "item": url}]}]
    nav = "".join(f'<a href="/c/{k}/" class="{"on" if k == cid else ""}">{esc(tx(cities[k]["name"]))}</a>' for k in hubs)
    return f"""<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(title)}</title><meta name="description" content="{esc(summ[:155])}"><link rel="canonical" href="{url}">
<link rel="alternate" hreflang="ko" href="{url}"><link rel="alternate" hreflang="en" href="{SITE}/en/c/{cid}/price/{t['id']}/"><link rel="alternate" hreflang="x-default" href="{url}">
<meta property="og:type" content="website"><meta property="og:site_name" content="엉클데이 Uncle Day"><meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(summ[:155])}"><meta property="og:url" content="{url}"><meta property="og:image" content="{SITE}/images/og-image.jpg">
<link rel="icon" type="image/png" sizes="32x32" href="/images/favicon-32.png"><link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<style>{HUB_CSS}{TOPIC_CSS}{PRICE_CSS}</style>
{"".join(f'<script type="application/ld+json">{js(o)}</script>' for o in lds)}
</head><body><header class="hd"><div class="in"><a class="logo" href="/"><img src="/images/logo-full.webp" alt="엉클데이 Uncle Day" width="167" height="72"></a><nav>{nav}<a href="/en/c/{cid}/price/{t['id']}/" lang="en">EN</a></nav>{HCTA}</div></header>
<main class="wrap"><p class="date"><a href="/c/{cid}/price/">← {esc(cko)} 시술별 가격</a></p>
<h1>{esc(q)}</h1>
<div class="qa"><div class="who">엉클데이 요약</div><b>{esc(summ)}</b><p style="margin:6px 0 0">{esc(t['why'])} 아래 표는 엉클데이 업체의 실제 메뉴 가격이고, 엉클데이로 예약해도 매장 가격 그대로예요.</p></div>
<table class="tb"><tr><th>업체</th><th>메뉴</th><th>시간</th><th>가격</th></tr>{trs}</table>
<p class="date">참고가 · 정보 확인 {upd} · 가격은 매장 사정으로 바뀔 수 있어요</p>
<p><a class="cta" data-cta="kakao" href="{KAKAO}" target="_blank" rel="noopener">💬 가능 여부 · 가격 한국어로 문의하기</a> <a class="cta" style="background:var(--green)" data-cta="book" href="/c/{cid}/">{esc(cko)} 업체 모두 보기</a></p>
<h2>다른 시술 가격</h2><p class="chips">{others}</p>
<h2>자주 묻는 질문</h2><dl>{"".join(f"<dt>{esc(a)}</dt><dd>{esc(b)}</dd>" for a, b in faq)}</dl></main>
<footer class="wrap">엉클데이 Uncle Day — 베트남 마사지 · 스파 · 뷰티 한국어 예약 · <a href="/">홈</a> · <a href="/c/{cid}/">{esc(cko)} 업체</a></footer>{TRACK()}</body></html>
"""
def price_index_page(cid, all_t):
    city = cities.get(cid, {}); cko = tx(city.get("name")); url = f"{SITE}/c/{cid}/price/"
    upd = max(checked(x) for _, rr in all_t for x, _ in rr)
    title = f"{cko} 마사지 · 스파 · 뷰티 시술별 가격 ({YEAR}) | 엉클데이"
    lead = f"엉클데이 업체의 실제 메뉴 가격으로 정리한 {cko} 시술별 가격이에요. " + " ".join(f"{t['kw']} {won(rr[0][1]['price'])}~{won(rr[-1][1]['price'])}." for t, rr in all_t[:3])
    rows_h = "".join(f'<tr><td><a href="/c/{cid}/price/{t["id"]}/"><b>{esc(t["kw"])}</b></a><small>업체 {len({r[0]["id"] for r in rr})}곳 · 메뉴 {len(rr)}개</small></td><td class="n">{won(int(rr[0][1]["price"]))} ~ {won(int(rr[-1][1]["price"]))}</td></tr>' for t, rr in all_t)
    nav = "".join(f'<a href="/c/{k}/" class="{"on" if k == cid else ""}">{esc(tx(cities[k]["name"]))}</a>' for k in hubs)
    js = lambda o: json.dumps(o, ensure_ascii=False).replace("</", "<\\/")
    ld = {"@context": "https://schema.org", "@type": "CollectionPage", "name": title, "url": url, "inLanguage": "ko", "dateModified": upd, "description": lead,
          "mainEntity": {"@type": "ItemList", "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": f"{cko} {t['kw']} 가격", "url": f"{SITE}/c/{cid}/price/{t['id']}/"} for i, (t, _) in enumerate(all_t)]}}
    return f"""<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(title)}</title><meta name="description" content="{esc(lead[:155])}"><link rel="canonical" href="{url}">
<link rel="alternate" hreflang="ko" href="{url}"><link rel="alternate" hreflang="en" href="{SITE}/en/c/{cid}/price/">
<meta property="og:type" content="website"><meta property="og:site_name" content="엉클데이 Uncle Day"><meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(lead[:155])}"><meta property="og:url" content="{url}"><meta property="og:image" content="{SITE}/images/og-image.jpg">
<link rel="icon" type="image/png" sizes="32x32" href="/images/favicon-32.png"><link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<style>{HUB_CSS}{PRICE_CSS}</style><script type="application/ld+json">{js(ld)}</script>
</head><body><header class="hd"><div class="in"><a class="logo" href="/"><img src="/images/logo-full.webp" alt="엉클데이 Uncle Day" width="167" height="72"></a><nav>{nav}<a href="/en/c/{cid}/price/" lang="en">EN</a></nav>{HCTA}</div></header>
<main class="wrap"><h1>{esc(cko)} 시술별 가격</h1><p class="lead">{esc(lead)}</p>
<table class="tb"><tr><th>시술</th><th>가격대</th></tr>{rows_h}</table><p class="date">참고가 · 정보 확인 {upd} · 엉클데이로 예약해도 매장 가격 그대로예요</p>
<p><a class="cta" href="/c/{cid}/">{esc(cko)} 업체 모두 보기</a></p></main>
<footer class="wrap">엉클데이 Uncle Day · <a href="/">홈</a></footer>{TRACK()}</body></html>
"""
def en_price_page(cid, t, rows, all_t):
    cen = ecity(cid); url = f"{SITE}/en/c/{cid}/price/{t['id']}/"; upd = max(checked(x) for x, _ in rows); ns = len({x["id"] for x, _ in rows})
    summ = price_summary(cen, t, rows, en=True); q = f"How much does {t['en'].lower()} cost in {cen}?"
    title = f"{t['en']} prices in {cen} ({YEAR}) — {ns} shops compared | Uncle Day"
    trs = "".join(f'<tr><td><a data-cta="shop" href="/en/s/{x["id"]}/">{esc(ename(x))}</a><small>{esc(SUB_EN2.get(x.get("cat"), ""))}</small></td><td>{esc(lang(m.get("name"), "en") or tx(m.get("name")))}</td><td>{(str(dur_of(m)) + " min") if dur_of(m) else "-"}</td><td class="n">{vnd(int(m["price"]))}</td></tr>' for x, m in rows)
    others = "".join(f'<a class="chip{" on" if tt["id"] == t["id"] else ""}" href="/en/c/{cid}/price/{tt["id"]}/">{esc(tt["en"])}</a>' for tt, _ in all_t)
    faq = [(q, summ + " Booking through Uncle Day costs the same as the shop price."), ("Can prices change?", f"These are reference prices checked by Uncle Day up to {upd}. We re-check with the shop when you book.")]
    lds = [{"@context": "https://schema.org", "@type": "WebPage", "name": title, "url": url, "inLanguage": "en", "dateModified": upd, "description": summ},
           {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": a, "acceptedAnswer": {"@type": "Answer", "text": b}} for a, b in faq]}]
    body = f"""<p class="date"><a href="/en/c/{cid}/price/">← {esc(cen)} prices</a></p><h1>{esc(q)}</h1>
<div class="qa"><div class="who">Uncle Day summary</div><b>{esc(summ)}</b></div>
<style>{TOPIC_CSS}{PRICE_CSS}</style><table class="tb"><tr><th>Shop</th><th>Menu</th><th>Time</th><th>Price</th></tr>{trs}</table>
<p class="date">Reference prices · last checked {upd}</p><p><a class="cta" data-cta="kakao" href="{KAKAO}" target="_blank" rel="noopener">💬 Ask us</a> <a class="cta" style="background:var(--green)" href="/en/c/{cid}/">All shops in {esc(cen)}</a></p>
<h2>Other treatments</h2><p class="chips">{others}</p><h2>FAQ</h2><dl>{"".join(f"<dt>{esc(a)}</dt><dd>{esc(b)}</dd>" for a, b in faq)}</dl>"""
    return en_shell(title, summ, url, f"{SITE}/c/{cid}/price/{t['id']}/", cid, lds, body, upd=upd)
def en_price_index(cid, all_t):
    cen = ecity(cid); url = f"{SITE}/en/c/{cid}/price/"; upd = max(checked(x) for _, rr in all_t for x, _ in rr)
    title = f"{cen} massage, spa & beauty prices ({YEAR}) | Uncle Day"; lead = f"Real menu prices from Uncle Day shops in {cen}, by treatment."
    rows_h = "".join(f'<tr><td><a href="/en/c/{cid}/price/{t["id"]}/"><b>{esc(t["en"])}</b></a><small>{len({r[0]["id"] for r in rr})} shops · {len(rr)} menu items</small></td><td class="n">{vnd(int(rr[0][1]["price"]))} – {vnd(int(rr[-1][1]["price"]))}</td></tr>' for t, rr in all_t)
    body = f"""<h1>{esc(cen)} prices by treatment</h1><p class="lead">{esc(lead)}</p><style>{PRICE_CSS}</style><table class="tb"><tr><th>Treatment</th><th>Price range</th></tr>{rows_h}</table><p class="date">Reference prices · last checked {upd}</p>"""
    return en_shell(title, lead, url, f"{SITE}/c/{cid}/price/", cid, [{"@context": "https://schema.org", "@type": "CollectionPage", "name": title, "url": url, "inLanguage": "en", "dateModified": upd}], body, upd=upd)
# 미입점 가게의 '이 근처 가격': 반경 2km 안 엉클데이 업체의 실제 메뉴 가격
KIND_T = {"마사지": "massage", "스파 · 사우나": "massage", "네일 · 뷰티": "nail", "피부 · 클리닉": "facial", "뷰티": "facial"}
def near_prices(u, cid, radius=2.0):
    t = TMAP.get(KIND_T.get(u["kind"], "massage"))
    if not hasgeo(u): radius = 0
    xs = [x for x in live if x.get("city") == cid and (not radius or (x.get("geo") and km((u["lat"], u["lon"]), x["geo"]) <= radius))]
    rows = treat_rows(t, xs)
    if not rows: return None
    ps = [int(m["price"]) for _, m in rows]
    return {"t": t, "n": len({x["id"] for x, _ in rows}), "lo": ps[0], "hi": ps[-1], "bd": by_dur(rows) or {k: v for k, v in {dur_of(m): [int(m["price"])] for _, m in rows}.items() if k}, "r": radius}

# ---- ② 미입점 업체 p/<도시>/<id>/ : 오픈스트리트맵 공개 정보(이름 · 주소 · 영업시간 · 위치)만 + 근처 엉클데이 업체 + 문의 · 입점 신청 ----
import math, unicodedata, urllib.parse
HIDDEN = set(d.get("hidden") or []); CRAWLED = d.get("crawled") or []
def hasgeo(u): return u.get("lat") is not None and u.get("lon") is not None
def src_host(u): return urllib.parse.urlparse(u.get("srcurl") or "").netloc.replace("www.", "")
OSM = json.load(open("data/osm.json")) if os.path.exists("data/osm.json") else {"cities": {}}
def km(a, b):
    la1, lo1, la2, lo2 = map(math.radians, [a[0], a[1], b[0], b[1]])
    return 6371 * 2 * math.asin(math.sqrt(math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2))
def norm(t): return re.sub(r"[^a-z0-9]", "", unicodedata.normalize("NFD", (t or "").lower().replace("đ", "d")).encode("ascii", "ignore").decode())
def slug(t): return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", unicodedata.normalize("NFD", (t or "").lower().replace("đ", "d")).encode("ascii", "ignore").decode())).strip("-")[:50] or "shop"
OSM_KIND = lambda tg: "네일 · 뷰티" if tg.get("beauty") in ("nails",) or "nail" in (tg.get("name", "").lower()) else "마사지" if tg.get("shop") == "massage" or tg.get("amenity") == "massage" else "스파 · 사우나" if tg.get("leisure") in ("spa", "sauna") or tg.get("amenity") == "spa" else "뷰티"
OSM_KIND_VI = {"네일 · 뷰티": "Nail · làm đẹp", "마사지": "Massage", "스파 · 사우나": "Spa · xông hơi", "피부 · 클리닉": "Chăm sóc da · thẩm mỹ", "뷰티": "Làm đẹp"}
DAYMAP = {"Mo": "월", "Tu": "화", "We": "수", "Th": "목", "Fr": "금", "Sa": "토", "Su": "일", "PH": "공휴일", "off": "휴무"}
def hours_ko(h): return re.sub(r"\b(Mo|Tu|We|Th|Fr|Sa|Su|PH|off)\b", lambda m: DAYMAP[m.group(1)], h or "").replace("-", "~", 0) if h else ""
def osm_addr(tg): return ", ".join(x for x in [" ".join(v for v in [tg.get("addr:housenumber"), tg.get("addr:street")] if v), tg.get("addr:subdistrict") or tg.get("addr:suburb"), tg.get("addr:district"), tg.get("addr:city")] if x)
def unclaimed(cid):
    rows = []; seen = set()
    for r in OSM.get("cities", {}).get(cid, []):
        if r["id"] in HIDDEN: continue   # 관리자가 숨긴 가게
        tg = r["tags"]; nm = tg.get("name:ko") or tg.get("name"); key = norm(tg.get("name"))
        if not key or key in seen: continue
        # 이미 엉클데이에 있는 업체면 빼요 (이름이 같거나, 120m 안에 이름이 비슷한 곳)
        dup = False
        for x in live:
            if x.get("city") != cid: continue
            xn = norm(lang(x.get("name"), "en")) + "|" + norm(lang(x.get("name"), "vi"))
            if key and (key in xn or any(k and k in key for k in xn.split("|") if len(k) > 3)): dup = True; break
            if x.get("geo") and km((r["lat"], r["lon"]), x["geo"]) < 0.12 and key[:5] in xn: dup = True; break
        if dup: continue
        seen.add(key)
        rows.append({**r, "name": nm, "en": tg.get("name:en") or tg.get("name"), "kind": OSM_KIND(tg), "addr": osm_addr(tg), "hours": tg.get("opening_hours", ""),
                     "slug": f"{slug(tg.get('name'))}-{r['id']}", "rich": bool(osm_addr(tg) or tg.get("opening_hours")),
                     "hood": tg.get("addr:suburb") or tg.get("addr:subdistrict") or tg.get("addr:district") or ""})
    # 🔗 포털에서 링크로 가져와 게시한 가게 (universe21 crawl_published)
    for c in CRAWLED:
        dd = c.get("data") or {}; nm = (dd.get("name") or "").strip()
        if c.get("city") != cid or not nm: continue
        key = norm(nm)
        if key in seen or any(key and (key in norm(lang(x.get("name"), "en")) or key in norm(lang(x.get("name"), "vi"))) for x in live if x.get("city") == cid): continue
        seen.add(key); g = dd.get("geo") if isinstance(dd.get("geo"), list) and len(dd["geo"]) == 2 else None
        menu = [{"name": str(m.get("name"))[:80], "price": int(m.get("price") or 0), "min": int(m.get("min") or 0)} for m in (dd.get("menu") or []) if m.get("name") and int(m.get("price") or 0) > 0][:40]
        kind = c.get("kind") or ("네일 · 뷰티" if any(re.search(r"nail|gel|móng|네일", m["name"], re.I) for m in menu) else "마사지")
        rows.append({"id": f"u{c['id']}", "lat": g[0] if g else None, "lon": g[1] if g else None, "name": nm, "en": nm, "kind": kind, "addr": (dd.get("address") or "")[:150], "hours": (dd.get("hours") or "")[:80],
                     "slug": f"{slug(nm)}-u{c['id']}", "rich": True, "hood": "", "menu": menu, "src": "crawl", "srcurl": c.get("url") or dd.get("source") or "", "checked": c.get("checked") or BUILT})
    return rows
UNC_CSS = """.badge{display:inline-block;background:var(--sand);color:var(--navy);border-radius:999px;padding:3px 10px;font-size:12.5px;font-weight:700}
.facts{background:#fff;border-radius:16px;padding:12px 16px;border:1px solid var(--line)}.facts div{display:flex;gap:10px;padding:7px 0;border-bottom:1px solid var(--line)}.facts div:last-child{border:0}.facts span{color:var(--sub);min-width:70px}
.lead-box{background:#fff;border-radius:16px;padding:16px;border:2px solid var(--green);margin-top:16px}.lead-box.own{border-color:var(--navy)}
.lead-box form{display:grid;gap:8px}.lead-box input,.lead-box textarea,.lead-box select{width:100%;box-sizing:border-box;border:1px solid var(--line);border-radius:12px;background:#fff;color:var(--navy);padding:10px;font:inherit}
.lead-box button{border:0;border-radius:12px;background:var(--orange);color:#fff;font-weight:800;padding:13px;font-size:15.5px;cursor:pointer}.lead-box.own button{background:var(--navy)}
.tb{border-collapse:collapse;width:100%;background:#fff;border-radius:14px;overflow:hidden;border:1px solid var(--line)}.tb th,.tb td{padding:9px 12px;border-bottom:1px solid var(--line);text-align:left;font-size:14.5px}.tb th{background:var(--sand);font-size:13px}.tb td.n{text-align:right;white-space:nowrap;font-weight:700}.tb td:nth-child(2){white-space:nowrap}
.qa{background:#fff;border:1px solid var(--line);border-radius:16px;padding:14px 18px;margin:12px 0;font-size:15.5px}.qa .who{font-size:12.5px;font-weight:700;color:var(--green);margin-bottom:4px}
.chips{display:flex;flex-wrap:wrap;gap:6px}.chip{border:1px solid var(--line);background:#fff;border-radius:999px;padding:6px 12px;font-size:14px;color:var(--navy)!important;text-decoration:none;font-weight:600}.chip span{color:var(--sub);font-weight:500;font-size:12.5px}
.vi-link{background:#fff;border:1px solid var(--line);text-decoration:none;color:var(--green)!important}.views{display:flex;gap:12px;align-items:center;background:var(--navy);color:#fff;border-radius:16px;padding:14px 18px;margin:14px 0}.views b{font-size:30px;line-height:1}.views span{font-size:14.5px;line-height:1.45}
.why{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:10px;padding:0;list-style:none}.why li{background:#fff;border:1px solid var(--line);border-radius:16px;padding:14px 16px}.why li b{display:block;font-size:16px;margin-bottom:4px}.why li span{font-size:14px;color:#3a4656}
.ok{background:var(--green-t);color:var(--green);border-radius:10px;padding:10px;font-weight:700}.osm{color:var(--sub);font-size:12px}.row2{display:grid;grid-template-columns:1fr 1fr;gap:8px}.row3{display:grid;grid-template-columns:1.3fr 1fr .8fr;gap:8px}.row3 label{display:grid;gap:3px;font-size:12.5px;color:var(--sub);font-weight:600}.row3 input,.row3 select{min-width:0;height:44px}@media(max-width:420px){.row3{grid-template-columns:1fr 1fr}.row3 label:first-child{grid-column:1/-1}}"""
def lead_js(cid, ref, nm):
    if not _SU.get("url"): return ""
    auth = f',Authorization:"Bearer {_SU["key"]}"' if str(_SU.get("key", "")).startswith("eyJ") else ""
    return ("<script>(function(){var d=new Date(Date.now()+7*36e5).toISOString().slice(0,10);document.querySelectorAll('input[name=vday]').forEach(function(i){i.min=d;i.value=i.value||d})})();document.querySelectorAll('form[data-lead]').forEach(function(f){f.addEventListener('submit',function(e){e.preventDefault();var b=f.querySelector('button');b.disabled=true;"
            "var v=function(n){var el=f.querySelector('[name='+n+']');return el?el.value:''};var p={kind:f.getAttribute('data-lead'),path:location.pathname,ref:" + json.dumps(ref) + ",shop_name:" + json.dumps(nm) + ",city:" + json.dumps(cid) + ","
            "name:v('name'),contact:v('contact'),msg:v('msg'),visit_date:(v('vday')+' '+v('vtime')).trim()||v('visit_date'),people:+v('people')||0,lang:document.documentElement.lang,src:window.UD_SRC||''};"
            "fetch(" + json.dumps(_SU["url"]) + "+'/rest/v1/rpc/seo_lead',{method:'POST',headers:{apikey:" + json.dumps(_SU["key"]) + auth + ",'Content-Type':'application/json'},body:JSON.stringify({p:p})})"
            ".then(function(r){if(!r.ok)throw 0;f.outerHTML='<p class=\"ok\">'+f.getAttribute('data-ok')+'</p>'}).catch(function(){b.disabled=false;alert(f.getAttribute('data-err'))})})})</script>")
def unclaimed_page(cid, u):
    city = cities.get(cid, {}); cko = tx(city.get("name")); url = f"{SITE}/p/{cid}/{u['slug']}/"
    G = hasgeo(u); crawl = u.get("src") == "crawl"; um = u.get("menu") or []
    near = sorted([x for x in live if x.get("city") == cid and (x.get("geo") or not G)], key=lambda x: (grp(x) != "spabody", km((u["lat"], u["lon"]), x["geo"]) if G else 0))[:3]
    title = f"{u['name']} — {cko} {u['kind']} {'가격 · ' if um else ''}위치 · 영업시간{' · 근처 가격' if near_prices(u, cid) else ''} · 한국어 예약 문의 | 엉클데이"
    desc = f"{u['name']}은(는) {cko}의 {u['kind']} 가게예요." if False else f"{cko}의 {u['kind']} 가게 {u['name']} 정보 (주소 · 영업시간 · 지도). 엉클데이에 남기면 한국어로 확인해 드려요."
    gmap = f"https://www.google.com/maps/search/?api=1&query={u['lat']},{u['lon']}" if G else "https://www.google.com/maps/search/?api=1&query=" + urllib.parse.quote(f"{u['name']} {u['addr'] or CITY_EN.get(cid, '')}")
    ld = {"@context": "https://schema.org", "@type": "HealthAndBeautyBusiness", "name": u["name"], "url": url}
    if G: ld["geo"] = {"@type": "GeoCoordinates", "latitude": u["lat"], "longitude": u["lon"]}
    if um: ld["hasOfferCatalog"] = {"@type": "OfferCatalog", "name": "Menu", "itemListElement": [{"@type": "Offer", "name": m["name"], "price": m["price"], "priceCurrency": "VND"} for m in um]}
    if u["addr"]: ld["address"] = {"@type": "PostalAddress", "streetAddress": u["addr"], "addressLocality": CITY_EN.get(cid, ""), "addressCountry": "VN"}
    if u["hours"]: ld["openingHours"] = u["hours"]
    js = lambda o: json.dumps(o, ensure_ascii=False).replace("</", "<\\/")
    nearh = "".join(f'<a class="card" data-cta="shop" href="/s/{x["id"]}/"><b>{esc(tx(x.get("name")))}</b><small>엉클데이 인증 · {SUB_KO.get(x.get("cat"), "")}{f" · 약 {km((u['lat'], u['lon']), x['geo']):.1f}km" if G else ""}</small><p>{esc(facts(x)[0][:110])}…</p></a>' for x in near)
    np_ = near_prices(u, cid); hood = u.get("hood") or ""
    where = lambda r: f"반경 {r:.0f}km 안" if r else f"{cko}"
    own_txt = (f" 가게가 공개한 가격은 {won(min(m['price'] for m in um))}" + (f"~{won(max(m['price'] for m in um))}" if len({m['price'] for m in um}) > 1 else "") + f"이에요 ({src_host(u)} 기준, {u.get('checked')} 확인).") if um else ""
    pr_txt = (f"{where(np_['r'])} 엉클데이 업체 {np_['n']}곳의 {np_['t']['kw']} 가격은 {won(np_['lo'])}" + (f"~{won(np_['hi'])}" if np_['hi'] != np_['lo'] else "") + "이에요" + ((" (" + ", ".join(f"{k}분 {won(min(v))}" + (f"~{won(max(v))}" if max(v) != min(v) else "") for k, v in list(np_['bd'].items())[:3]) + ")") if np_['bd'] else "") + ".") if np_ else ""
    summ = f"{cko}{(' ' + hood) if hood else ''}에 있는 {u['kind']} 가게예요." + (f" 영업시간은 {hours_ko(u['hours'])}이에요." if u['hours'] else "") + own_txt + (" 비교하자면 " + pr_txt if pr_txt and um else (" " + pr_txt if pr_txt else "")) + (" 아직 엉클데이 입점 전이라 실제 가격 · 한국어 응대는 확인 전이에요." if um else " 아직 엉클데이 입점 전이라 이 가게의 가격 · 한국어 응대는 확인되지 않았어요.") + " 문의를 남기면 엉클데이가 가게에 확인해서 한국어로 알려 드려요."
    sib = sorted([v for v in UNC.get(cid, []) if v["id"] != u["id"] and G and hasgeo(v) and km((u["lat"], u["lon"]), (v["lat"], v["lon"])) <= 1.5], key=lambda v: km((u["lat"], u["lon"]), (v["lat"], v["lon"])))[:8]
    sibh = "".join(f'<a class="chip" href="/p/{cid}/{v["slug"]}/">{esc(v["name"])} <span>{km((u["lat"], u["lon"]), (v["lat"], v["lon"])) * 1000:.0f}m</span></a>' for v in sib)
    pid = np_["t"]["id"] if np_ else ""
    has_price_pg = np_ and any(t["id"] == np_["t"]["id"] for t, _ in TREATS.get(cid, []))
    return f"""<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(title)}</title><meta name="description" content="{esc(desc)}"><link rel="canonical" href="{url}">{'' if u['rich'] else '<meta name="robots" content="noindex,follow">'}
<link rel="alternate" hreflang="ko" href="{url}"><link rel="alternate" hreflang="vi" href="{url}vi/">
<meta property="og:type" content="website"><meta property="og:site_name" content="엉클데이 Uncle Day"><meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(desc)}"><meta property="og:url" content="{url}"><meta property="og:image" content="{SITE}/images/og-image.jpg">
<link rel="icon" type="image/png" sizes="32x32" href="/images/favicon-32.png"><link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<style>{HUB_CSS}{UNC_CSS}</style><script type="application/ld+json">{js(ld)}</script>
</head><body><header class="hd"><div class="in"><a class="logo" href="/"><img src="/images/logo-full.webp" alt="엉클데이 Uncle Day" width="167" height="72"></a><nav><a href="/c/{cid}/">{esc(cko)} 업체</a></nav>{HCTA}</div></header>
<main class="wrap"><p><span class="badge">엉클데이 미입점 업체 · {'가게 공개 정보' if crawl else '공개 지도 정보'}</span> <a class="badge vi-link" href="vi/" lang="vi">🇻🇳 Tiếng Việt · Dành cho chủ cửa hàng</a></p>
<h1>{esc(u['name'])} — 어떤 곳인가요?{f' <small class="en">{esc(u["en"])}</small>' if u['en'] and u['en'] != u['name'] else ''}</h1>
<div class="qa"><div class="who">엉클데이 요약</div>{esc(summ)}</div>
<div class="facts"><div><span>종류</span><b>{esc(u['kind'])}</b></div>{f'<div><span>동네</span><b>{esc(hood)}</b></div>' if hood else ''}{f'<div><span>주소</span><b>{esc(u["addr"])}</b></div>' if u['addr'] else ''}{f'<div><span>영업시간</span><b>{esc(hours_ko(u["hours"]))}</b></div>' if u['hours'] else ''}
<div><span>위치</span><b><a data-cta="map" href="{gmap}" target="_blank" rel="noopener">지도에서 보기</a></b></div>{f'<div><span>{"이 근처 가격" if np_["r"] else esc(cko) + " 가격"}</span><b>{won(np_["lo"])}{("~" + won(np_["hi"])) if np_["hi"] != np_["lo"] else ""} <small class="muted">({esc(np_["t"]["kw"])} · {where(np_["r"])} 엉클데이 업체 {np_["n"]}곳){f" · <a href=/c/{cid}/price/{pid}/>가격 비교</a>" if has_price_pg else ""}</small></b></div>' if np_ else ''}</div>
{('<h2>가게가 공개한 가격</h2><table class="tb"><tr><th>메뉴</th><th>시간</th><th>가격</th></tr>' + "".join(f'<tr><td>{esc(m["name"])}</td><td>{(str(m["min"]) + "분") if m["min"] else "-"}</td><td class="n">{won(m["price"])}</td></tr>' for m in um) + f'</table><p class="muted">출처: <a href="{esc(u["srcurl"])}" target="_blank" rel="noopener nofollow">{esc(src_host(u))}</a> · {u.get("checked")} 확인 · 가게 사정으로 바뀔 수 있어서 예약할 때 엉클데이가 다시 확인해 드려요.</p>') if um else ''}
<div class="lead-box"><h2 style="margin-top:0">💬 이 가게 예약 문의</h2><p class="muted">엉클데이가 가게에 가능 여부 · 가격을 확인해서 한국어로 연락드려요. 연락처는 엉클데이만 봐요.</p>
<form data-lead="guest" data-ok="문의를 받았어요. 확인되는 대로 연락드릴게요 🙏" data-err="잠시 후 다시 시도해 주세요.">
<input name="name" placeholder="이름 (예: 김민지)" maxlength="60"><input name="contact" required placeholder="연락처 — 카카오톡 ID 또는 전화번호" maxlength="120">
<div class="row3"><label>방문 날짜<input type="date" name="vday" required></label><label>시간<select name="vtime"><option value="">시간 미정</option><option value="09:00">오전 9:00</option><option value="09:30">오전 9:30</option><option value="10:00">오전 10:00</option><option value="10:30">오전 10:30</option><option value="11:00">오전 11:00</option><option value="11:30">오전 11:30</option><option value="12:00">오후 12:00</option><option value="12:30">오후 12:30</option><option value="13:00">오후 1:00</option><option value="13:30">오후 1:30</option><option value="14:00">오후 2:00</option><option value="14:30">오후 2:30</option><option value="15:00">오후 3:00</option><option value="15:30">오후 3:30</option><option value="16:00">오후 4:00</option><option value="16:30">오후 4:30</option><option value="17:00">오후 5:00</option><option value="17:30">오후 5:30</option><option value="18:00">오후 6:00</option><option value="18:30">오후 6:30</option><option value="19:00">오후 7:00</option><option value="19:30">오후 7:30</option><option value="20:00">오후 8:00</option><option value="20:30">오후 8:30</option><option value="21:00">오후 9:00</option><option value="21:30">오후 9:30</option><option value="22:00">오후 10:00</option><option value="22:30">오후 10:30</option><option value="23:00">오후 11:00</option><option value="23:30">오후 11:30</option></select></label><label>인원<select name="people">{"".join(f'<option value="{i}">{i}명</option>' for i in range(1, 9))}</select></label></div>
<textarea name="msg" rows="2" placeholder="원하는 코스 · 요청 사항 (선택)" maxlength="1000"></textarea><button type="submit">문의 남기기</button></form>
<p class="muted">바로 상담하고 싶다면 <a data-cta="kakao" href="{KAKAO}" target="_blank" rel="noopener">엉클데이 카카오톡</a>으로 이 페이지 주소를 보내 주세요.</p></div>
{f'<h2>{"근처의" if G else esc(cko) + "의"} 엉클데이 인증 업체</h2><p class="muted">한국어로 상담하고 매장 가격 그대로 바로 예약할 수 있어요.</p><div class="grid">{nearh}</div>' if near else ''}
{f'<h2>이 근처의 다른 가게</h2><p class="chips">{sibh}</p>' if sib else ''}<p class="muted"><a href="/c/{cid}/more/">{esc(cko)} 가게 전체 목록</a>{f' · <a href="/c/{cid}/price/">{esc(cko)} 시술별 가격</a>' if TREATS.get(cid) else ''}</p>
<div class="lead-box own" lang="vi"><h2 style="margin-top:0">🏪 Bạn là chủ cửa hàng này? · 이 가게 사장님이세요?</h2>
<p class="muted">Đăng ký miễn phí trên Uncle Day để nhận khách Hàn Quốc. Không phí đăng ký, không phí hàng tháng — chỉ trả hoa hồng khi khách đến và thanh toán.<br>엉클데이에 무료로 입점하면 한국인 손님을 받을 수 있어요. 입점비 · 월 고정비 없이 손님이 와서 결제했을 때만 수수료.</p>
<form data-lead="owner" data-ok="Cảm ơn! Uncle Day sẽ liên hệ sớm. · 고마워요! 곧 연락드릴게요." data-err="Vui lòng thử lại sau. · 잠시 후 다시 시도해 주세요.">
<input name="name" placeholder="Tên của bạn · 이름" maxlength="60"><input name="contact" required placeholder="Số điện thoại / Zalo · 전화 · 잘로" maxlength="120">
<textarea name="msg" rows="2" placeholder="Lời nhắn (không bắt buộc) · 남길 말 (선택)" maxlength="1000"></textarea><button type="submit">Đăng ký miễn phí · 무료 입점 신청</button></form>
<p class="muted"><a href="vi/">Xem trang này bằng tiếng Việt · 베트남어로 보기 →</a> · <a href="/demo.html?role=owner&lang=vi" target="_blank" rel="noopener">Xem thử trang quản lý cửa hàng · 사장님 페이지 체험해 보기 ↗</a></p></div>
<p class="osm">가게 정보: {f'가게가 공개한 페이지 <a href="{esc(u["srcurl"])}" target="_blank" rel="noopener nofollow">{esc(src_host(u))}</a> ({u.get("checked")} 확인)' if crawl else '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors (ODbL)'}. 정보가 틀렸거나 내리고 싶다면 <a href="{KAKAO}" target="_blank" rel="noopener">엉클데이에 알려 주세요</a>.</p>
</main><footer class="wrap">엉클데이 Uncle Day — 베트남 마사지 · 스파 · 뷰티 한국어 예약 · <a href="/">홈</a></footer>{TRACK()}{lead_js(cid, ("crawl:" if crawl else "osm:") + u["id"], u["name"])}</body></html>
"""
DAY_VI = {"Mo": "T2", "Tu": "T3", "We": "T4", "Th": "T5", "Fr": "T6", "Sa": "T7", "Su": "CN", "PH": "Ngày lễ", "off": "nghỉ"}
def hours_vi(h): return re.sub(r"\b(Mo|Tu|We|Th|Fr|Sa|Su|PH|off)\b", lambda m: DAY_VI[m.group(1)], h or "")
def views_js(path):
    # 손님용(한국어) 페이지의 최근 30일 조회수를 보여 줘요. 5번 미만이면 안 보여요 (universe20.sql)
    if not _SU.get("url"): return ""
    auth = f',Authorization:"Bearer {_SU["key"]}"' if str(_SU.get("key", "")).startswith("eyJ") else ""
    return ("<script>fetch(" + json.dumps(_SU["url"]) + "+'/rest/v1/rpc/seo_page_views',{method:'POST',headers:{apikey:" + json.dumps(_SU["key"]) + auth + ",'Content-Type':'application/json'},body:JSON.stringify({path:" + json.dumps(path) + "})})"
            ".then(function(r){return r.ok?r.json():0}).then(function(n){n=+n||0;if(n<5)return;var el=document.getElementById('views');el.querySelector('b').textContent=n.toLocaleString('vi-VN');el.hidden=false}).catch(function(){})</script>")
def unclaimed_vi_page(cid, u):
    city = cities.get(cid, {}); cvi = lang(city.get("name"), "vi") or CITY_EN.get(cid, cid); url = f"{SITE}/p/{cid}/{u['slug']}/vi/"; ko = f"/p/{cid}/{u['slug']}/"
    kvi = OSM_KIND_VI.get(u["kind"], "Làm đẹp"); n_city = sum(1 for x in live if x.get("city") == cid)
    title = f"{u['name']} — {kvi} tại {cvi} | Uncle Day"
    desc = f"{u['name']} ({kvi}, {cvi}) trên Uncle Day — nền tảng đặt chỗ bằng tiếng Hàn cho du khách Hàn Quốc. Chủ cửa hàng đăng ký miễn phí để nhận khách."
    gmap = f"https://www.google.com/maps/search/?api=1&query={u['lat']},{u['lon']}" if hasgeo(u) else "https://www.google.com/maps/search/?api=1&query=" + urllib.parse.quote(f"{u['name']} {u['addr'] or CITY_EN.get(cid, '')}")
    crawl = u.get("src") == "crawl"
    return f"""<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(title)}</title><meta name="description" content="{esc(desc)}"><link rel="canonical" href="{url}">{'' if u['rich'] else '<meta name="robots" content="noindex,follow">'}
<link rel="alternate" hreflang="ko" href="{SITE}{ko}"><link rel="alternate" hreflang="vi" href="{url}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Uncle Day"><meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(desc)}"><meta property="og:url" content="{url}"><meta property="og:image" content="{SITE}/images/og-image.jpg">
<link rel="icon" type="image/png" sizes="32x32" href="/images/favicon-32.png"><link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<style>{HUB_CSS}{UNC_CSS}</style>
</head><body><header class="hd"><div class="in"><a class="logo" href="/"><img src="/images/logo-full.webp" alt="Uncle Day" width="167" height="72"></a><nav><a href="{ko}" lang="ko">한국어</a></nav><a class="hcta" href="#dk">Đăng ký miễn phí</a></div></header>
<main class="wrap"><p><span class="badge">Chưa đăng ký Uncle Day · {'Thông tin công khai của cửa hàng' if crawl else 'Thông tin bản đồ công khai'}</span></p>
<h1>{esc(u['name'])}</h1>
<p class="lead">Đây là trang của cửa hàng bạn trên <b>Uncle Day</b> — trang web đặt chỗ massage · spa · làm đẹp <b>bằng tiếng Hàn</b> cho du khách Hàn Quốc tại Việt Nam. Khách Hàn Quốc tìm trên Google · Naver sẽ thấy <a href="{ko}" lang="ko">trang tiếng Hàn này</a>.</p>
<div class="views" id="views" hidden><b>0</b><span>lượt xem trang của cửa hàng bạn<br>trong 30 ngày qua</span></div>
<div class="facts"><div><span>Loại</span><b>{esc(kvi)}</b></div>{f'<div><span>Địa chỉ</span><b>{esc(u["addr"])}</b></div>' if u['addr'] else ''}{f'<div><span>Giờ mở cửa</span><b>{esc(hours_vi(u["hours"]))}</b></div>' if u['hours'] else ''}
<div><span>Vị trí</span><b><a data-cta="map" href="{gmap}" target="_blank" rel="noopener">Xem bản đồ</a></b></div></div>
<p class="muted">Cửa hàng chưa đăng ký nên Uncle Day chưa thể gửi khách Hàn Quốc đến. Khi khách để lại yêu cầu đặt chỗ, chúng tôi sẽ liên hệ cửa hàng.</p>
{('<h2>Bảng giá công khai của cửa hàng</h2><table class="tb"><tr><th>Dịch vụ</th><th>Giá</th></tr>' + "".join(f'<tr><td>{esc(m["name"])}</td><td class="n">{m["price"]:,}₫</td></tr>' for m in (u.get("menu") or [])) + '</table>') if u.get("menu") else ''}
<h2>Đăng ký Uncle Day được gì?</h2>
<ul class="why">
<li><b>🇰🇷 Khách Hàn Quốc</b><span>Khách tìm và đặt chỗ bằng tiếng Hàn. Uncle Day xác nhận đặt chỗ và gửi khách đến cửa hàng.</span></li>
<li><b>💸 Không phí cố định</b><span>Không phí đăng ký, không phí hàng tháng. Chỉ trả hoa hồng khi khách đến và thanh toán.</span></li>
<li><b>📱 Trang quản lý miễn phí</b><span>Nhận đặt chỗ, bảng phòng, lịch làm của nhân viên, đối soát — trên điện thoại, bằng tiếng Việt.</span></li>
<li><b>🔒 Thông tin khách an toàn</b><span>Uncle Day lo phần liên lạc với khách. Cửa hàng chỉ cần phục vụ.</span></li>
</ul>
{f'<p class="muted">Hiện đã có <b>{n_city}</b> cửa hàng ở {esc(cvi)} trên Uncle Day.</p>' if n_city else ''}
<p><a class="cta" href="/demo.html?role=owner&lang=vi" target="_blank" rel="noopener">▶ Xem thử trang quản lý cửa hàng</a></p>
<div class="lead-box own" id="dk"><h2 style="margin-top:0">🏪 Bạn là chủ cửa hàng này?</h2>
<p class="muted">Để lại số điện thoại / Zalo. Uncle Day sẽ liên hệ để giới thiệu và hướng dẫn đăng ký.</p>
<form data-lead="owner" data-ok="Cảm ơn! Uncle Day sẽ liên hệ sớm." data-err="Vui lòng thử lại sau.">
<input name="name" placeholder="Tên của bạn" maxlength="60"><input name="contact" required placeholder="Số điện thoại / Zalo" maxlength="120">
<textarea name="msg" rows="2" placeholder="Lời nhắn (không bắt buộc)" maxlength="1000"></textarea><button type="submit">Đăng ký miễn phí</button></form></div>
<p class="osm">Thông tin cửa hàng: {f'trang công khai <a href="{esc(u["srcurl"])}" target="_blank" rel="noopener nofollow">{esc(src_host(u))}</a> ({u.get("checked")})' if crawl else '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors (ODbL)'}. Thông tin sai hoặc muốn gỡ trang này? Hãy để lại số điện thoại ở biểu mẫu trên và ghi “gỡ thông tin” — chúng tôi sẽ gỡ.</p>
</main><footer class="wrap">Uncle Day — đặt chỗ massage · spa · làm đẹp bằng tiếng Hàn tại Việt Nam · <a href="/">Trang chủ</a></footer>{TRACK()}{lead_js(cid, ("crawl:" if crawl else "osm:") + u["id"], u["name"])}{views_js(ko)}</body></html>
"""
# ---- 📝 블로그 blog/<주소>/ : 관리자가 정한 '조건'(도시 · 장소 · 주제 · 시술)으로 최신 업체 데이터에서 매번 다시 그려요 (universe23) ----
from landmarks import LANDMARKS
LMAP = {l["id"]: l for l in LANDMARKS}
BLOG = d.get("blog") or []
def blog_slug(b):
    if b.get("slug"): return b["slug"]
    s_ = slug(b.get("kw"))
    return s_ if len(s_) >= 6 and s_ != "shop" else "-".join(x for x in [b.get("city"), b.get("landmark") or b.get("topic") or b.get("treat") or "guide"] if x) + f"-{b['id']}"
def blog_pick(b):
    xs = [x for x in live if x.get("city") == b.get("city")]
    t = next((t for t in TOPICS if t["id"] == b.get("topic")), None); tr = TMAP.get(b.get("treat") or "")
    if t: xs = topic_shops(t, xs)
    elif tr: ids = {x["id"] for x, _ in treat_rows(tr, xs)}; xs = [x for x in xs if x["id"] in ids]
    else: xs = [x for x in xs if grp(x) == (b.get("grp") or "spabody")]
    lm = LMAP.get(b.get("landmark") or "")
    if lm:
        xs = sorted([x for x in xs if x.get("geo")], key=lambda x: km((lm["lat"], lm["lon"]), x["geo"]))
        near = [x for x in xs if km((lm["lat"], lm["lon"]), x["geo"]) <= 5]
        xs = near if len(near) >= 2 else xs[:6]
    else:
        xs = sorted(xs, key=lambda x: (-(len(mprices(x) or prices(x)) > 0), "ko" not in (x.get("staffLangs") or []), tx(x.get("name"))))
    return xs[:10], lm, t, tr
def blog_page(b):
    xs, lm, t, tr = blog_pick(b)
    cid = b["city"]; cko = tx(cities.get(cid, {}).get("name")); sl = blog_slug(b); url = f"{SITE}/blog/{sl}/"; n = len(xs)
    upd = max([checked(x) for x in xs] + [b.get("updated") or BUILT]); pub = b.get("published") or upd
    dist = (lambda x: km((lm["lat"], lm["lon"]), x["geo"])) if lm else None
    title = b.get("title") or f"{b['kw']} — 엉클데이 업체 {n}곳 ({YEAR})"
    allp = sorted(p for x in xs for p in (mprices(x) or prices(x)))
    rows_tr = treat_rows(tr, xs) if tr else []
    summ = f"엉클데이가 확인한 {cko} 업체 중 '{b['kw']}'에 맞는 곳은 {n}곳이에요."
    if lm: summ += f" {lm['ko']}에서 가장 가까운 곳은 {tx(xs[0].get('name'))}(약 {dist(xs[0]):.1f}km)예요."
    if rows_tr: summ += " " + price_summary(cko, tr, rows_tr)
    elif allp: summ += f" 엉클데이 확인 참고가는 {won(allp[0])}부터예요."
    kn = sum(1 for x in xs if "ko" in (x.get("staffLangs") or []) or has(x, "한국어|한국인"))
    if kn: summ += f" 그중 {kn}곳은 한국어 응대가 돼요."
    intro = (b.get("intro") or "").strip() or (f"{lm['ko']} 근처에서 " if lm else f"{cko}에서 ") + (t["why"] if t else tr["why"] if tr else "어디로 갈지 고민된다면, 엉클데이가 직접 확인한 업체 정보(위치 · 가격 · 영업시간 · 한국어 응대)로 비교해 보세요.") + " 모든 업체는 엉클데이에서 한국어로 상담하고 매장 가격 그대로 예약할 수 있어요."
    def card(i, x):
        pr = mprices(x) or prices(x); f0 = facts(x)[0]; hrs = f"{x['open']}~{x.get('close', '')}" if x.get("open") else ""
        meta = " · ".join(v for v in [SUB_KO.get(x.get("cat"), ""), (f"{lm['ko']}에서 약 {dist(x):.1f}km" if lm else ""), (won(pr[0]) + "부터" if pr else ""), (hrs and "영업 " + hrs), ("한국어 응대" if "ko" in (x.get("staffLangs") or []) else "")] if v)
        tags = " ".join(f"<span class=chip>#{esc(tx(tg))}</span>" for tg in (x.get("tags") or [])[:4] if tx(tg))
        return f'<section class="bp"><h2>{i}. {esc(tx(x.get("name")))}</h2><p class="date">{esc(meta)}</p><p>{esc(f0)}</p>{f"<p>{tags}</p>" if tags else ""}<p><a class="cta" data-cta="shop" href="/s/{x["id"]}/">{esc(tx(x.get("name")))} 자세히 · 예약</a></p></section>'
    table = "".join(f'<tr><td><a data-cta="shop" href="/s/{x["id"]}/">{esc(tx(x.get("name")))}</a></td>{f"<td class=n>{dist(x):.1f}km</td>" if lm else ""}<td class="n">{won((mprices(x) or prices(x))[0]) if (mprices(x) or prices(x)) else "상담"}</td><td style="white-space:nowrap;font-size:13px">{esc((x.get("open") or "") + ("~" + x["close"] if x.get("close") else ""))}</td><td>{"✅" if "ko" in (x.get("staffLangs") or []) else "-"}</td></tr>' for x in xs)
    g = GUIDES.get(cid) or {}; tips = (g.get("tip") or [])[:3]; srcs = []
    for _, _, ks in tips:
        for k in ks:
            if k in SOURCES and k not in srcs: srcs.append(k)
    faq = [(f"{b['kw']} 어디가 좋아요?", summ + " 업체마다 엉클데이에서 한국어로 상담하고 예약할 수 있어요."),
           ("엉클데이로 예약하면 더 비싼가요?", "아니요. 매장 가격 그대로이고 손님이 엉클데이에 따로 내는 돈은 없어요. 결제는 시술 후 매장에서 직접 해요.")]
    if lm: faq.insert(1, (f"{lm['ko']}에서 얼마나 걸려요?", "거리는 지도상 직선거리라 실제 이동 거리는 조금 더 길어요. " + ", ".join(f"{tx(x.get('name'))} 약 {dist(x):.1f}km" for x in xs[:3]) + ". 짧은 거리는 그랩(Grab) 바이크 · 택시로 5~10분 정도예요."))
    rel = [(f"/c/{cid}/", f"{cko} 업체 모두 보기")] + ([(f"/c/{cid}/{t['id']}/", f"{cko} {t['kw']}")] if t else []) + ([(f"/c/{cid}/price/{tr['id']}/", f"{cko} {tr['kw']} 가격 비교")] if tr and any(tt["id"] == tr["id"] for tt, _ in TREATS.get(cid, [])) else []) + ([(f"/c/{cid}/price/", f"{cko} 시술별 가격")] if TREATS.get(cid) and not tr else []) + ([(f"/c/{cid}/guide/", f"{cko} 마사지 가이드")] if cid in GUIDES else [])
    js = lambda o: json.dumps(o, ensure_ascii=False).replace("</", "<\\\\/")
    lds = [{"@context": "https://schema.org", "@type": "Article", "headline": title[:110], "url": url, "inLanguage": "ko", "datePublished": pub, "dateModified": upd, "description": summ[:300],
            "author": {"@type": "Organization", "name": "엉클데이 Uncle Day", "url": SITE + "/"}, "publisher": {"@type": "Organization", "name": "엉클데이 Uncle Day", "logo": {"@type": "ImageObject", "url": SITE + "/images/logo-full.webp"}},
            "image": OGIMG.get(xs[0]["id"]) if xs else SITE + "/images/og-image.jpg", "mainEntityOfPage": url,
            "about": {"@type": "ItemList", "numberOfItems": n, "itemListElement": [{"@type": "ListItem", "position": i + 1, "url": f"{SITE}/s/{x['id']}/", "name": tx(x.get("name"))} for i, x in enumerate(xs)]}},
           {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faq]},
           {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [{"@type": "ListItem", "position": 1, "name": "엉클데이", "item": SITE + "/"}, {"@type": "ListItem", "position": 2, "name": "블로그", "item": f"{SITE}/blog/"}, {"@type": "ListItem", "position": 3, "name": title[:60], "item": url}]}]
    nav = "".join(f'<a href="/c/{k}/" class="{"on" if k == cid else ""}">{esc(tx(cities[k]["name"]))}</a>' for k in hubs) + '<a href="/blog/">블로그</a>'
    return sl, f"""<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(title)} | 엉클데이</title><meta name="description" content="{esc(summ[:155])}"><link rel="canonical" href="{url}">
<meta property="og:type" content="article"><meta property="og:site_name" content="엉클데이 Uncle Day"><meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(summ[:155])}"><meta property="og:url" content="{url}"><meta property="og:image" content="{(OGIMG.get(xs[0]['id']) if xs else '') or SITE + '/images/og-image.jpg'}">
<meta property="article:published_time" content="{pub}"><meta property="article:modified_time" content="{upd}">
<link rel="icon" type="image/png" sizes="32x32" href="/images/favicon-32.png"><link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<style>{HUB_CSS}{TOPIC_CSS}{PRICE_CSS}.bp{{background:#fff;border:1px solid var(--line);border-radius:16px;padding:6px 18px 12px;margin:14px 0}}.bp h2{{margin:12px 0 2px;font-size:20px}}.chip{{display:inline-block;margin:0 4px 4px 0;padding:3px 10px;font-size:13px}}.tips li{{margin:8px 0}}.src{{font-size:13px;color:var(--sub)}}</style>
{"".join(f'<script type="application/ld+json">{js(o)}</script>' for o in lds)}
</head><body><header class="hd"><div class="in"><a class="logo" href="/"><img src="/images/logo-full.webp" alt="엉클데이 Uncle Day" width="167" height="72"></a><nav>{nav}</nav>{HCTA}</div></header>
<main class="wrap"><p class="date"><a href="/blog/">← 엉클데이 블로그</a></p>
<h1>{esc(title)}</h1><p class="date">작성 {pub} · 정보 확인 {upd} · 엉클데이(uncleday.com)</p>
<div class="qa"><div class="who">엉클데이 요약</div><b>{esc(summ)}</b></div>
<p class="lead">{esc(intro)}</p>
<h2>한눈에 비교</h2><table class="tb"><tr><th>업체</th>{"<th>거리</th>" if lm else ""}<th>가격(부터)</th><th>영업</th><th>한국어</th></tr>{table}</table>
<p class="date">{f"거리는 {esc(lm['ko'])} 중심에서 지도상 직선거리예요 · " if lm else ""}가격은 엉클데이 확인 참고가 · 예약해도 매장 가격 그대로</p>
{"".join(card(i + 1, x) for i, x in enumerate(xs))}
{('<h2>' + esc(tr['kw']) + ' 실제 메뉴 가격</h2><table class="tb"><tr><th>업체</th><th>메뉴</th><th>가격</th></tr>' + "".join(f'<tr><td>{esc(tx(x.get("name")))}</td><td>{esc(tx(m.get("name")))}</td><td class="n">{won(int(m["price"]))}</td></tr>' for x, m in rows_tr[:20]) + '</table>') if rows_tr else ''}
{('<h2>' + esc(cko) + ' 마사지 받기 전에 알아 두면 좋은 것</h2><ul class="tips">' + "".join(f"<li><b>{esc(q)}</b> {esc(a)}</li>" for q, a, _ in tips) + '</ul><p class="src">참고: ' + " · ".join(f'<a href="{esc(SOURCES[k][1])}" target="_blank" rel="noopener nofollow">{esc(SOURCES[k][0])}</a>' for k in srcs) + '</p>') if tips else ''}
<p><a class="cta" data-cta="kakao" href="{KAKAO}" target="_blank" rel="noopener">💬 한국어로 바로 상담하기</a></p>
<h2>자주 묻는 질문</h2><dl>{"".join(f"<dt>{esc(q)}</dt><dd>{esc(a)}</dd>" for q, a in faq)}</dl>
<h2>함께 보면 좋은 페이지</h2><p class="chips">{"".join(f'<a class="chip" href="{u}">{esc(l)}</a>' for u, l in rel)}</p></main>
<footer class="wrap">엉클데이 Uncle Day — 베트남 마사지 · 스파 · 뷰티 한국어 예약 · <a href="/">홈</a> · <a href="/blog/">블로그</a></footer>{TRACK()}</body></html>
""", n, title, upd
def blog_index(items):
    url = f"{SITE}/blog/"
    cards = "".join(f'<a class="card" href="/blog/{sl}/"><b>{esc(t)}</b><small>{esc(tx(cities.get(c, {}).get("name")))} · 업체 {n}곳 · {u}</small></a>' for sl, t, n, u, c in items)
    nav = "".join(f'<a href="/c/{k}/">{esc(tx(cities[k]["name"]))}</a>' for k in hubs) + '<a class="on" href="/blog/">블로그</a>'
    return f"""<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>엉클데이 블로그 — 베트남 마사지 · 스파 · 뷰티 고르는 법 | 엉클데이</title>{'' if items else '<meta name="robots" content="noindex,follow">'}<meta name="description" content="엉클데이가 직접 확인한 업체 정보(위치 · 실제 가격 · 영업시간 · 한국어 응대)로 정리한 베트남 마사지 · 스파 · 뷰티 글."><link rel="canonical" href="{url}">
<link rel="icon" type="image/png" sizes="32x32" href="/images/favicon-32.png"><link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"><style>{HUB_CSS}</style>
</head><body><header class="hd"><div class="in"><a class="logo" href="/"><img src="/images/logo-full.webp" alt="엉클데이 Uncle Day" width="167" height="72"></a><nav>{nav}</nav>{HCTA}</div></header>
<main class="wrap"><h1>엉클데이 블로그</h1><p class="lead">엉클데이가 직접 확인한 업체 정보로 정리한 글이에요. 가격 · 영업시간은 매시간 최신 정보로 다시 확인돼요.</p>{f'<div class="grid">{cards}</div>' if items else '<p>첫 글을 준비하고 있어요. 그동안 도시별 업체 목록을 둘러보세요.</p><p class="chips">' + "".join(f'<a class="cta" href="/c/{k}/">{esc(tx(cities[k]["name"]))}</a>' for k in hubs) + '</p>'}</main>
<footer class="wrap">엉클데이 Uncle Day · <a href="/">홈</a></footer>{TRACK()}</body></html>
"""
def more_page(cid, us):
    city = cities.get(cid, {}); cko = tx(city.get("name")); url = f"{SITE}/c/{cid}/more/"
    title = f"{cko} 마사지 · 스파 · 네일 가게 {len(us)}곳 더 보기 (미입점 · 공개 지도 정보) | 엉클데이"
    rows = "".join(f'<a class="card" data-cta="shop" href="/p/{cid}/{u["slug"]}/"><b>{esc(u["name"])}</b><small>{esc(u["kind"])}{(" · " + esc(u["addr"][:40])) if u["addr"] else ""}</small><p>예약 문의를 남기면 엉클데이가 확인해 드려요</p></a>' for u in us)
    return f"""<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(title)}</title><meta name="description" content="{esc(f'{cko}의 마사지 · 스파 · 네일 가게 {len(us)}곳. 엉클데이 미입점 가게도 한국어로 예약 문의를 남길 수 있어요.')}"><link rel="canonical" href="{url}">
<link rel="icon" type="image/png" sizes="32x32" href="/images/favicon-32.png"><link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"><style>{HUB_CSS}{UNC_CSS}</style>
</head><body><header class="hd"><div class="in"><a class="logo" href="/"><img src="/images/logo-full.webp" alt="엉클데이 Uncle Day" width="167" height="72"></a><nav><a href="/c/{cid}/">{esc(cko)} 인증 업체</a></nav>{HCTA}</div></header>
<main class="wrap"><h1>{esc(cko)} 가게 {len(us)}곳 더 보기</h1><p class="lead">엉클데이 인증 업체 말고도 {esc(cko)}에 있는 마사지 · 스파 · 네일 가게를 공개 지도 정보로 모았어요. 가격 · 한국어 응대는 아직 확인 전이에요. 가게 페이지에서 예약 문의를 남기면 엉클데이가 확인해 드려요.</p>
<p><a class="cta" data-cta="book" href="/c/{cid}/">✅ 엉클데이 인증 업체 먼저 보기</a></p><div class="grid">{rows}</div>
<p class="osm">가게 정보: © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors (ODbL)</p></main>
<footer class="wrap">엉클데이 Uncle Day · <a href="/">홈</a></footer>{TRACK()}</body></html>
"""

hubs = [c["id"] for c in d["cities"] if any(x.get("city") == c["id"] for x in live)]
os.makedirs("c", exist_ok=True); os.makedirs("en/c", exist_ok=True); os.makedirs("p", exist_ok=True); UNC = {c: unclaimed(c) for c in hubs}; TREATS = {c: city_treats(c, [x for x in live if x.get("city") == c]) for c in hubs}
os.makedirs("blog", exist_ok=True); keep_b = set(); BLOG_OUT = []
BLOG_OUT_RX = re.compile(r"맛집|식당|음식|먹거리|카페|커피|베이커리|호텔|숙소|리조트|풀빌라|빌라|에어비앤비|가라오케|노래방|골프|렌트|렌터카|차량|택시|투어|술집|클럽|\bbar\b|\bpub\b|restaurant|food|cafe|coffee|hotel|villa|golf|karaoke", re.I)
print("블로그 게시 글", len(BLOG), "개")
for b in BLOG:
    if b.get("city") not in hubs: print("  건너뜀 (도시에 업체 없음):", b.get("kw"), b.get("city")); continue
    if BLOG_OUT_RX.search(b.get("kw") or ""): print("  건너뜀 (엉클데이 분야 아님):", b.get("kw")); continue   # 엉클데이 데이터가 없는 분야는 안 만들어요
    sl, h, n, t, u = blog_page(b)
    if n < 2 or sl in keep_b: print(f"  건너뜀 (맞는 업체 {n}곳):", b.get("kw")); continue   # 업체 2곳 미만이면 글을 안 만들어요
    print(f"  ✅ /blog/{sl}/ 업체 {n}곳:", b.get("kw"))
    os.makedirs(f"blog/{sl}", exist_ok=True); open(f"blog/{sl}/index.html", "w").write(h); keep_b.add(sl); BLOG_OUT.append((sl, t, n, u, b["city"]))
for cid in hubs:
    os.makedirs(f"c/{cid}", exist_ok=True)
    open(f"c/{cid}/index.html", "w").write(hub_page(cid, [x for x in live if x.get("city") == cid]))
    if cid in GUIDES:
        os.makedirs(f"c/{cid}/guide", exist_ok=True)
        open(f"c/{cid}/guide/index.html", "w").write(guide_page(cid, [x for x in live if x.get("city") == cid]))
    elif os.path.isdir(f"c/{cid}/guide"): shutil.rmtree(f"c/{cid}/guide", ignore_errors=True)
    sc = [x for x in live if x.get("city") == cid]; tk = {"guide", "index.html", "more", "price"}
    shutil.rmtree(f"c/{cid}/price", ignore_errors=True); shutil.rmtree(f"en/c/{cid}/price", ignore_errors=True)
    if TREATS[cid]:
        os.makedirs(f"c/{cid}/price", exist_ok=True); open(f"c/{cid}/price/index.html", "w").write(price_index_page(cid, TREATS[cid]))
        os.makedirs(f"en/c/{cid}/price", exist_ok=True); open(f"en/c/{cid}/price/index.html", "w").write(en_price_index(cid, TREATS[cid]))
        for t, rs in TREATS[cid]:
            os.makedirs(f"c/{cid}/price/{t['id']}", exist_ok=True); open(f"c/{cid}/price/{t['id']}/index.html", "w").write(price_page(cid, t, rs, TREATS[cid]))
            os.makedirs(f"en/c/{cid}/price/{t['id']}", exist_ok=True); open(f"en/c/{cid}/price/{t['id']}/index.html", "w").write(en_price_page(cid, t, rs, TREATS[cid]))
    us = UNC[cid]
    if us:
        os.makedirs(f"c/{cid}/more", exist_ok=True); open(f"c/{cid}/more/index.html", "w").write(more_page(cid, us))
        os.makedirs(f"p/{cid}", exist_ok=True); keep_p = set()
        for u in us:
            os.makedirs(f"p/{cid}/{u['slug']}/vi", exist_ok=True); open(f"p/{cid}/{u['slug']}/index.html", "w").write(unclaimed_page(cid, u)); keep_p.add(u["slug"])
            open(f"p/{cid}/{u['slug']}/vi/index.html", "w").write(unclaimed_vi_page(cid, u))
        for f in os.listdir(f"p/{cid}"):
            if f not in keep_p: shutil.rmtree(f"p/{cid}/{f}", ignore_errors=True)
    for t, xs in city_topics(cid, sc):
        tk.add(t["id"])
        os.makedirs(f"c/{cid}/{t['id']}", exist_ok=True); open(f"c/{cid}/{t['id']}/index.html", "w").write(topic_page(cid, t, xs, sc))
        os.makedirs(f"en/c/{cid}/{t['id']}", exist_ok=True); open(f"en/c/{cid}/{t['id']}/index.html", "w").write(en_topic_page(cid, t, xs, sc))
    for base in (f"c/{cid}", f"en/c/{cid}"):
        for f in os.listdir(base):
            if f not in tk: shutil.rmtree(f"{base}/{f}", ignore_errors=True)
for f in os.listdir("c"):
    if f not in hubs: shutil.rmtree(f"c/{f}", ignore_errors=True)
for f in os.listdir("p"):
    if not UNC.get(f): shutil.rmtree(f"p/{f}", ignore_errors=True)
os.makedirs("en/c", exist_ok=True)
for cid in hubs:
    sc = [x for x in live if x.get("city") == cid]
    os.makedirs(f"en/c/{cid}", exist_ok=True); open(f"en/c/{cid}/index.html", "w").write(en_hub_page(cid, sc))
    if cid in GUIDES_EN and cid in GUIDES:
        os.makedirs(f"en/c/{cid}/guide", exist_ok=True); open(f"en/c/{cid}/guide/index.html", "w").write(en_guide_page(cid, sc))
for f in os.listdir("en/c"):
    if f not in hubs: shutil.rmtree(f"en/c/{f}", ignore_errors=True)
os.makedirs("en/s", exist_ok=True); keep_en = set()
for x in live:
    if x.get("city") not in hubs: continue
    os.makedirs(f"en/s/{x['id']}", exist_ok=True); open(f"en/s/{x['id']}/index.html", "w").write(en_shop_page(x)); keep_en.add(x["id"])
for f in os.listdir("en/s"):
    if f not in keep_en: shutil.rmtree(f"en/s/{f}", ignore_errors=True)
open("blog/index.html", "w").write(blog_index(sorted(BLOG_OUT, key=lambda r: r[3], reverse=True)))
for f in os.listdir("blog"):
    if f not in keep_b and f != "index.html": shutil.rmtree(f"blog/{f}", ignore_errors=True) if os.path.isdir(f"blog/{f}") else os.remove(f"blog/{f}")

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
    ts = city_topics(cid, [x for x in live if x.get("city") == cid])
    if ts: L.append(f"- {tx(cities[cid]['name'])} 주제별: " + " · ".join(f"[{t['kw']} {len(xs)}곳]({SITE}/c/{cid}/{t['id']}/)" for t, xs in ts))
    if TREATS.get(cid): L.append(f"- {tx(cities[cid]['name'])} 시술별 가격 (엉클데이 업체 실제 메뉴): " + " · ".join(f"[{t['kw']} {won(rr[0][1]['price'])}~{won(rr[-1][1]['price'])}]({SITE}/c/{cid}/price/{t['id']}/)" for t, rr in TREATS[cid]))
for cid in hubs:
    L += ["", f"## {tx(cities[cid]['name'])} 업체"]
    for x in [y for y in live if y.get("city") == cid]:
        sk, _, _ = facts(x); L.append(f"- [{tx(x.get('name'))}]({SITE}/s/{x['id']}/): {sk}")
L += ["", "## 안내", f"- [엉클데이 홈]({SITE}/): 업체 검색 · 예약", f"- [예약 확인]({SITE}/booking.html): 로그인 없이 예약번호로 확인"]
L += ["", "## English", "Uncle Day also has English city pages and massage guides for international travelers:"]
for cid in hubs:
    L.append(f"- [{ecity(cid)}: shops]({SITE}/en/c/{cid}/)" + (f" · [{GUIDES_EN[cid]['title']}]({SITE}/en/c/{cid}/guide/)" if cid in GUIDES_EN else ""))
if BLOG_OUT: L += ["", "## 블로그 (엉클데이 업체 데이터로 쓴 글)"] + [f"- [{t}]({SITE}/blog/{sl}/): 업체 {n}곳 · 정보 확인 {u}" for sl, t, n, u, _ in BLOG_OUT]
open("llms.txt", "w").write("\n".join(L) + "\n")

# 사이트맵: 검색엔진에 '이 페이지들이 있어요' + 언제 바뀌었는지(lastmod) 알려 주기
mod = {f"{SITE}/s/{x['id']}/": checked(x) for x in live}
mod.update({f"{SITE}/en/s/{x}/": mod.get(f"{SITE}/s/{x}/", BUILT) for x in keep_en})
for cid in hubs: mod[f"{SITE}/c/{cid}/"] = max(checked(x) for x in live if x.get("city") == cid)
for cid in hubs:
    if cid in GUIDES: mod[f"{SITE}/c/{cid}/guide/"] = max([GUIDES[cid]["checked"]] + [checked(x) for x in live if x.get("city") == cid])
for cid in hubs:
    mod[f"{SITE}/en/c/{cid}/"] = mod[f"{SITE}/c/{cid}/"]
    if cid in GUIDES_EN: mod[f"{SITE}/en/c/{cid}/guide/"] = mod.get(f"{SITE}/c/{cid}/guide/", BUILT)
topic_urls = []
for cid in hubs:
    for t, xs in city_topics(cid, [x for x in live if x.get("city") == cid]):
        for pre in ("", "/en"):
            u = f"{SITE}{pre}/c/{cid}/{t['id']}/"; mod[u] = max(checked(x) for x in xs); topic_urls.append(u)
for cid in hubs:
    for pre in ("", "/en"):
        if TREATS.get(cid): topic_urls += [f"{SITE}{pre}/c/{cid}/price/"] + [f"{SITE}{pre}/c/{cid}/price/{t['id']}/" for t, _ in TREATS[cid]]
    if UNC.get(cid):
        topic_urls.append(f"{SITE}/c/{cid}/more/")
        topic_urls += [f"{SITE}/p/{cid}/{u['slug']}/{v}" for u in UNC[cid] if u["rich"] for v in ("", "vi/")]
if BLOG_OUT: topic_urls += [f"{SITE}/blog/"] + [f"{SITE}/blog/{r[0]}/" for r in BLOG_OUT]
for r in BLOG_OUT: mod[f"{SITE}/blog/{r[0]}/"] = r[3]
urls = [f"{SITE}/"] + [f"{SITE}/c/{c}/" for c in hubs] + topic_urls + [f"{SITE}/c/{c}/guide/" for c in hubs if c in GUIDES] \
     + [f"{SITE}/en/c/{c}/" for c in hubs] + [f"{SITE}/en/c/{c}/guide/" for c in hubs if c in GUIDES_EN] + [f"{SITE}/s/{x}/" for x in sorted(keep_s)] + [f"{SITE}/en/s/{x}/" for x in sorted(keep_en)]
open("sitemap.xml", "w").write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + "".join(f"  <url><loc>{u}</loc><lastmod>{mod.get(u, BUILT)}</lastmod>{'<priority>1.0</priority>' if u == SITE + '/' else '<priority>0.8</priority>' if '/c/' in u else ''}</url>\n" for u in urls) + "</urlset>\n")
print(len(keep_s), "곳 업체 페이지 ·", len(hubs), "개 도시 페이지 · llms.txt · 사이트맵 완료")
