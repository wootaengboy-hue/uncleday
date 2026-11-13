"""시술 × 도시 가격 페이지 (c/<도시>/price/<시술>/) 목록.
   캐시바이의 '제품 번호 → 페이지'처럼, 엉클데이는 '시술 이름 → 페이지'예요.
   업체 메뉴에 가격이 들어 있는 것만 써요 (가격 0 = '상담 시 안내'는 빼요).
   가격이 있는 업체가 MIN 곳보다 적으면 그 도시엔 페이지를 만들지 않아요 (빈 페이지 = 구글 스팸 판정 위험).
   pat: 메뉴 이름(한국어 + 영어)에서 찾는 말 / no: 빼는 말"""

MIN = 2

TREATMENTS = [
    {"id": "massage", "kw": "마사지", "en": "Massage", "pat": r"마사지|massage|타이|건식|아로마|핫스톤|스웨디시", "no": r"발|foot|키즈|kids|얼굴|페이셜|facial|두피|head",
     "why": "전신 마사지(아로마 · 핫스톤 · 타이 등) 메뉴 가격이에요. 같은 가게라도 시간(60 · 90 · 120분)과 오일 · 돌 사용에 따라 달라져요."},
    {"id": "foot", "kw": "발 마사지", "en": "Foot massage", "pat": r"발 ?마사지|발 반사|foot", "no": r"",
     "why": "많이 걸은 날 짧게 받기 좋은 발 마사지 가격이에요."},
    {"id": "facial", "kw": "페이셜 · 피부관리", "en": "Facial & skin care", "pat": r"페이셜|클렌징|관리|facial|cleans|hydra|derma|detox|acne|여드름|기미|모공|진정|리프팅|수분", "no": r"마사지|massage|네일|nail|필러|보톡스|filler|botox",
     "why": "클렌징 · 수분 · 여드름 · 기미 관리 같은 피부관리 메뉴 가격이에요. 피부 상태에 따라 상담 후 바뀔 수 있어요."},
    {"id": "nail", "kw": "젤네일", "en": "Gel nails", "pat": r"네일|젤|nail|gel|페디|pedi|매니", "no": r"",
     "why": "젤네일 · 아트 · 페디큐어 가격이에요. 아트 개수와 연장 여부에 따라 달라져요."},
    {"id": "lash", "kw": "속눈썹 연장", "en": "Lash extensions", "pat": r"속눈썹|lash", "no": r"",
     "why": "속눈썹 연장 · 펌 가격이에요."},
    {"id": "hair", "kw": "헤어 (커트 · 펌 · 염색)", "en": "Hair (cut, perm, color)", "pat": r"커트|컷|펌|염색|헤어|드라이|cut|perm|color|hair", "no": r"",
     "why": "커트 · 펌 · 염색 가격이에요. 기장과 약제에 따라 달라져요."},
    {"id": "filler", "kw": "필러 · 보톡스", "en": "Fillers & Botox", "pat": r"필러|보톡스|주름|filler|botox|wrinkle", "no": r"",
     "why": "필러 · 보톡스 같은 시술 가격이에요. 의료 시술은 반드시 의사와 충분히 상담하고 결정해 주세요."},
]
