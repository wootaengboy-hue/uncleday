"""검색어 맞춤 페이지 (c/<도시>/<주제>/) 목록.
   사람들이 실제로 검색하는 말 그대로 페이지를 만들어요. 업체는 업체 데이터(태그 · 메뉴 · 영업시간 · 언어)에서 자동으로 골라요.
   업체가 MIN 곳보다 적으면 그 도시에는 페이지를 만들지 않아요 (내용 없는 페이지 = 구글 스팸 판정 위험).
   pat: 업체의 태그 · 메뉴 · 설명 · 주소에서 찾는 말 (정규식) / fn: 따로 정한 조건 이름"""

MIN = 2

TOPICS = [
    # id,          한국어 키워드(제목),           찾는 말 / 조건,                     한 줄 설명
    {"id": "korean", "kw": "한국어 되는 마사지", "fn": "korean", "spa": True,
     "why": "말이 안 통할까 걱정된다면 한국어 매니저 · 한국어 응대가 되는 곳이 편해요. 코스 설명, 압 조절, 요청 사항을 한국어로 말할 수 있어요."},
    {"id": "late", "kw": "밤늦게 하는 마사지", "fn": "late", "spa": True,
     "why": "밤 비행기 전이나 저녁 일정 뒤에 받기 좋은, 밤 11시 이후까지 여는 곳이에요. 마감 직전에는 접수가 끝날 수 있어서 미리 예약하는 게 좋아요."},
    {"id": "luggage", "kw": "짐 보관 되는 마사지", "pat": "짐 보관|짐보관|샤워", "spa": True,
     "why": "체크아웃 후 짐을 맡기고 마사지 · 샤워를 한 뒤 공항으로 가는 일정에 맞는 곳이에요."},
    {"id": "pickup", "kw": "픽업 되는 마사지", "pat": "픽업|샌딩", "spa": True,
     "why": "숙소나 공항까지 데리러 오거나 데려다주는 곳이에요. 인원 · 시간 · 지역에 따라 조건이 달라서 예약할 때 확인해 드려요."},
    {"id": "kids", "kw": "아이랑 받는 키즈 마사지", "pat": "키즈|아동|아이 ", "spa": True,
     "why": "아이 전용 메뉴가 있어서 가족이 같이 받기 좋은 곳이에요. 아이 나이와 몸무게를 예약할 때 알려 주세요."},
    {"id": "pregnant", "kw": "임산부 마사지", "pat": "임산부|산전", "spa": True,
     "why": "임산부 전용 메뉴가 있는 곳이에요. 예약할 때 임신 주수를 꼭 알려 주세요. 몸 상태가 걱정되면 받기 전에 의사와 상의해 주세요."},
    {"id": "hotstone", "kw": "핫스톤 마사지", "pat": "핫스톤|바잘트", "spa": True,
     "why": "따뜻한 돌로 근육을 풀어 주는 마사지예요. 에어컨에 몸이 차가워졌거나 많이 걸은 날 좋아요."},
    {"id": "fourhands", "kw": "포핸드 마사지", "pat": "포핸드|four-hands", "spa": True,
     "why": "테라피스트 두 명이 동시에 해 주는 마사지예요. 짧은 시간에 진하게 받고 싶을 때 좋아요."},
    {"id": "thai", "kw": "타이 · 건식 마사지", "pat": "건식|타이|태국|시아추", "spa": True,
     "why": "오일 없이 옷을 입고 스트레칭하듯 눌러 주는 마사지예요. 강한 압을 좋아하면 맞아요."},
    {"id": "foot", "kw": "발 마사지", "pat": "발 마사지|발마사지|발 반사|발·|족욕", "spa": True,
     "why": "많이 걸은 날 짧게 받기 좋은 발 마사지가 있는 곳이에요."},
    {"id": "sauna", "kw": "사우나 있는 스파", "pat": "사우나|자쿠지|스팀|찜질", "spa": True,
     "why": "사우나 · 자쿠지 · 스팀과 같이 즐길 수 있는 곳이에요. 마사지 전에 몸을 데우면 더 잘 풀려요."},
    {"id": "tipfree", "kw": "팁 포함 마사지", "pat": "팁 포함|노팁", "spa": True,
     "why": "가격에 팁이 포함됐거나 팁을 따로 안 받는 곳이에요. 팁을 얼마 줄지 고민하지 않아도 돼요."},
    {"id": "nail", "kw": "네일 · 속눈썹", "fn": "nail", "spa": False,
     "why": "여행 중에 젤네일 · 페디 · 속눈썹을 받을 수 있는 곳이에요. 디자인 사진을 미리 보내 두면 시간이 줄어요."},
    {"id": "clinic", "kw": "한국어 상담 되는 성형 · 피부과", "fn": "clinic", "spa": False,
     "why": "성형외과 · 피부과는 상담이 먼저예요. 엉클데이가 한국어 상담을 연결해 드려요. 수술은 반드시 의사와 충분히 상담하고 결정해 주세요."},
]

# 영어판 제목 · 설명 (같은 id)
TOPICS_EN = {
    "korean": ("Korean-speaking massage", "Shops with Korean-speaking staff."),
    "late": ("Late-night massage", "Open past 11 pm — handy before a night flight or after dinner. Book ahead — shops may stop taking guests shortly before closing."),
    "luggage": ("Massage with luggage storage", "Store your bags after check-out, get a massage and shower, then head to the airport."),
    "pickup": ("Massage with pickup", "Shops that pick you up or drop you off. Conditions vary by party size, time and area."),
    "kids": ("Kids massage", "Shops with a children’s menu — great for family trips."),
    "pregnant": ("Pregnancy massage", "Shops with a prenatal menu. Tell them how far along you are, and check with your doctor if unsure."),
    "hotstone": ("Hot stone massage", "Warm stones loosen tight muscles — great after a day of walking or air-conditioning."),
    "fourhands": ("Four-hands massage", "Two therapists at once for an intense treatment in less time."),
    "thai": ("Thai / dry massage", "No oil, fully clothed, with stretching and firm pressure."),
    "foot": ("Foot massage", "A short treat after a long day of walking."),
    "sauna": ("Spa with sauna", "Sauna, jacuzzi or steam to warm up before your massage."),
    "tipfree": ("Tip-included massage", "Prices include the tip, or no tip is expected."),
    "nail": ("Nails & lashes", "Gel nails, pedicures and lash extensions while you travel."),
    "clinic": ("Cosmetic & dermatology clinics", "Clinics start with a consultation. Always discuss surgery thoroughly with the doctor."),
}
