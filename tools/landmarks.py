"""블로그 · 검색어용 장소(랜드마크). '○○ 근처 마사지' 글에서 업체까지 직선거리를 계산해요.
   좌표는 대략적인 중심점이에요 (거리는 '약 ○km 직선거리'로만 보여 줘요).
   names: 검색어에서 이 장소를 알아보는 말 (한국어 · 영어 · 베트남어)"""

LANDMARKS = [
    # 다낭
    {"id": "han-market", "city": "danang", "ko": "한시장", "en": "Han Market", "lat": 16.0682, "lon": 108.2242, "names": ["한시장", "한 시장", "han market", "chợ hàn", "cho han"]},
    {"id": "my-khe", "city": "danang", "ko": "미케 비치", "en": "My Khe Beach", "lat": 16.0597, "lon": 108.2469, "names": ["미케", "미케비치", "미케 해변", "my khe", "mỹ khê"]},
    {"id": "dragon-bridge", "city": "danang", "ko": "용다리", "en": "Dragon Bridge", "lat": 16.0611, "lon": 108.2274, "names": ["용다리", "용 다리", "드래곤 브릿지", "dragon bridge", "cầu rồng"]},
    {"id": "con-market", "city": "danang", "ko": "꼰시장", "en": "Con Market", "lat": 16.0679, "lon": 108.2145, "names": ["꼰시장", "꼰 시장", "con market", "chợ cồn"]},
    {"id": "an-thuong", "city": "danang", "ko": "안트엉", "en": "An Thuong", "lat": 16.0490, "lon": 108.2460, "names": ["안트엉", "안뜨엉", "an thuong", "an thượng"]},
    {"id": "danang-airport", "city": "danang", "ko": "다낭 공항", "en": "Da Nang Airport", "lat": 16.0530, "lon": 108.2020, "names": ["공항", "airport", "sân bay"]},
    {"id": "lotte-danang", "city": "danang", "ko": "롯데마트 다낭", "en": "Lotte Mart Da Nang", "lat": 16.0346, "lon": 108.2296, "names": ["롯데마트", "롯데 마트", "lotte mart"]},
    # 나트랑
    {"id": "dam-market", "city": "nhatrang", "ko": "담시장", "en": "Dam Market", "lat": 12.2546, "lon": 109.1925, "names": ["담시장", "담 시장", "dam market", "chợ đầm"]},
    {"id": "nhatrang-beach", "city": "nhatrang", "ko": "나트랑 해변 (쩐푸 거리)", "en": "Nha Trang Beach (Tran Phu)", "lat": 12.2420, "lon": 109.1965, "names": ["나트랑 해변", "쩐푸", "tran phu", "trần phú", "해변"]},
    {"id": "nhatrang-night-market", "city": "nhatrang", "ko": "나트랑 야시장", "en": "Nha Trang Night Market", "lat": 12.2445, "lon": 109.1958, "names": ["야시장", "night market", "chợ đêm"]},
    {"id": "stone-church", "city": "nhatrang", "ko": "나트랑 대성당 (돌성당)", "en": "Nha Trang Cathedral", "lat": 12.2466, "lon": 109.1883, "names": ["대성당", "돌성당", "cathedral", "nhà thờ núi"]},
    # 호찌민
    {"id": "ben-thanh", "city": "hcm", "ko": "벤탄시장", "en": "Ben Thanh Market", "lat": 10.7725, "lon": 106.6980, "names": ["벤탄", "벤탄시장", "ben thanh", "bến thành"]},
    {"id": "bui-vien", "city": "hcm", "ko": "부이비엔 거리", "en": "Bui Vien Street", "lat": 10.7675, "lon": 106.6932, "names": ["부이비엔", "여행자 거리", "bui vien", "bùi viện"]},
    {"id": "notre-dame", "city": "hcm", "ko": "노트르담 성당", "en": "Notre-Dame Cathedral", "lat": 10.7798, "lon": 106.6990, "names": ["노트르담", "notre dame", "nhà thờ đức bà"]},
    {"id": "thao-dien", "city": "hcm", "ko": "타오디엔 (2군)", "en": "Thao Dien (District 2)", "lat": 10.8040, "lon": 106.7360, "names": ["타오디엔", "2군", "thao dien", "thảo điền"]},
    {"id": "phu-my-hung", "city": "hcm", "ko": "푸미흥 (7군)", "en": "Phu My Hung (District 7)", "lat": 10.7290, "lon": 106.7190, "names": ["푸미흥", "7군", "phu my hung", "phú mỹ hưng"]},
    # 하노이
    {"id": "hoan-kiem", "city": "hanoi", "ko": "호안끼엠 호수", "en": "Hoan Kiem Lake", "lat": 21.0287, "lon": 105.8524, "names": ["호안끼엠", "호안 끼엠", "hoan kiem", "hoàn kiếm"]},
    {"id": "old-quarter", "city": "hanoi", "ko": "하노이 구시가", "en": "Hanoi Old Quarter", "lat": 21.0347, "lon": 105.8502, "names": ["구시가", "올드쿼터", "old quarter", "phố cổ"]},
    {"id": "west-lake", "city": "hanoi", "ko": "서호", "en": "West Lake", "lat": 21.0560, "lon": 105.8230, "names": ["서호", "west lake", "hồ tây"]},
    {"id": "lotte-hanoi", "city": "hanoi", "ko": "롯데센터 하노이", "en": "Lotte Center Hanoi", "lat": 21.0318, "lon": 105.8122, "names": ["롯데센터", "롯데 센터", "lotte center"]},
]
