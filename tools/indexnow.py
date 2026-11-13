"""IndexNow: 새로 생기거나 바뀐 페이지를 빙(Bing) · 얀덱스 등에 바로 알려요.
   ChatGPT 검색은 빙 검색 결과를 쓰기 때문에, AI 검색에 빨리 잡히는 데 도움이 돼요.
   - 키는 사이트 맨 위의 <32자리>.txt 파일이에요. IndexNow 는 원래 공개 키라서 비밀이 아니에요.
   - 구글은 IndexNow 를 안 써요 (구글은 사이트맵 · 서치 콘솔로).
   사용: python3 tools/indexnow.py 바뀐파일목록.txt   |   python3 tools/indexnow.py --all (사이트맵 전체)"""
import glob, json, os, re, sys, urllib.request

SITE = "https://www.uncleday.com"; HOST = "www.uncleday.com"
keys = [os.path.basename(f)[:-4] for f in glob.glob("*.txt") if re.fullmatch(r"[0-9a-f]{32}\.txt", os.path.basename(f))]
if not keys: print("IndexNow 키 파일이 없어요"); sys.exit(0)
KEY = keys[0]

def indexable(path):
    f = path.strip("/") + "/index.html" if path != "/" else "index.html"
    if not os.path.exists(f): return False
    return "noindex" not in open(f, encoding="utf-8", errors="ignore").read(4000)

if "--all" in sys.argv:
    urls = re.findall(r"<loc>([^<]+)</loc>", open("sitemap.xml").read())
else:
    files = open(sys.argv[1]).read().split() if len(sys.argv) > 1 and os.path.exists(sys.argv[1]) else []
    paths = sorted({"/" + f[:-len("index.html")] for f in files if f.endswith("index.html") and re.match(r"^(s|c|en|p|blog)/", f)})
    urls = [SITE + p for p in paths if indexable(p)]
    if any(f == "sitemap.xml" for f in files): urls.append(SITE + "/sitemap.xml")
if not urls: print("IndexNow: 알릴 페이지 없음"); sys.exit(0)
for i in range(0, len(urls), 9000):
    body = json.dumps({"host": HOST, "key": KEY, "keyLocation": f"{SITE}/{KEY}.txt", "urlList": urls[i:i + 9000]}).encode()
    req = urllib.request.Request("https://api.indexnow.org/indexnow", data=body, headers={"Content-Type": "application/json; charset=utf-8"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r: print("IndexNow", r.status, len(urls[i:i + 9000]), "개 알림")
    except urllib.error.HTTPError as e: print("IndexNow 실패", e.code, e.read()[:200])
    except Exception as e: print("IndexNow 실패", e)
