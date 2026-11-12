"""도시별 안내 글 (c/<도시>/guide/) 의 '사람이 쓰는 부분'.
   숫자 · 업체 목록은 share-build.py 가 업체 데이터에서 자동으로 채우고,
   여기에는 바뀌지 않는 설명과 바깥 출처만 적어요. 고칠 땐 이 파일만 고치면 다음 자동 갱신(3시간마다)에 반영돼요.
   ⚠️ 바깥 숫자는 반드시 출처(src)와 확인 날짜를 같이 적어요."""

SOURCES = {
    "tripstore": ("트립스토어 블로그 「다낭 스파 가격 · 예약 팁 총정리」 (2026.04)", "https://www.tripstore.kr/blog/%EB%8B%A4%EB%82%AD-%EC%8A%A4%ED%8C%8C-%EA%B0%80%EA%B2%A9-%EC%98%88%EC%95%BD-%ED%8C%81-%EC%B4%9D%EC%A0%95%EB%A6%AC"),
    "tripcom": ("트립닷컴 「나트랑 마사지 제대로 고르는 법」 (2026.08)", "https://kr.trip.com/guide/theme/nha-trang-massage.html"),
    "tripstore_hcm": ("트립스토어 블로그 「호치민 스파 추천 · 동선 가이드」 (2026.10)", "https://www.tripstore.kr/blog/%ED%98%B8%EC%B9%98%EB%AF%BC-%EC%8A%A4%ED%8C%8C-%EC%B6%94%EC%B2%9C-%EB%8F%99%EC%84%A0-%EA%B0%80%EC%9D%B4%EB%93%9C"),
    "vntourism": ("Vietnam Tourism 「Tipping in Vietnam 2026」", "https://www.vietnamtourism.com/en/tipping-in-vietnam-2026-when-it-s-insulting-when-it-s-expected"),
}

GUIDES = {
    "danang": {
        "checked": "2026-11-12",
        "title": "다낭 마사지 · 스파 가이드 2026 — 가격, 팁, 고르는 법, 예약 방법",
        "intro": "다낭은 한국인 여행객이 가장 많이 찾는 베트남 도시 중 하나라서, 한국어로 응대하는 마사지 · 스파가 많아요. "
                 "이 글은 엉클데이에 등록된 다낭 업체 정보와 바깥 자료를 바탕으로 가격, 팁, 고르는 법, 예약 방법을 정리했어요.",
        "price_note": "바깥 자료 기준으로는 90분 전신 마사지가 로컬 스파 약 15,000~25,000원, 한인 제휴 스파 약 30,000~50,000원이에요.",
        "price_src": "tripstore",
        "tip": [
            ("팁은 얼마가 보통이에요?", "보통 60분에 5만동, 90분에 7만~10만동 정도를 줘요. 베트남 여행 안내 사이트 Vietnam Tourism은 마사지 팁으로 5만~10만동(시내 기준)을 안내해요.", ["tripstore", "vntourism"]),
            ("팁은 어떻게 줘요?", "카운터가 아니라 마사지를 해 준 테라피스트에게 직접 건네는 게 좋아요. 카운터에 주면 본인에게 전달되지 않을 수도 있어요.", ["vntourism"]),
            ("팁이 포함된 곳도 있나요?", "있어요. 결제 금액에 팁이 포함된 스파도 있으니, 계산 전에 영수증이나 메뉴판의 '팁 포함 · 노팁' 표시를 확인해서 두 번 내지 않도록 해요. 엉클데이로 예약하면 상담할 때 팁 포함 여부를 알려 드려요.", ["tripstore"]),
        ],
        "kinds": [
            ("아로마", "아로마", "향 오일로 전신을 부드럽게 풀어 주는 가장 무난한 마사지예요. 처음이라면 아로마가 좋아요."),
            ("핫스톤", "핫스톤", "따뜻한 돌을 올려 근육을 풀어 줘요. 에어컨에 몸이 차가워졌거나 많이 걸은 날 좋아요."),
            ("타이 · 건식", "건식|타이|태국", "오일 없이 옷을 입고 스트레칭하듯 눌러 줘요. 시원하고 강한 압을 좋아하면 맞아요."),
            ("포핸드", "포핸드", "테라피스트 두 명이 동시에 마사지해요. 짧은 시간에 진하게 받고 싶을 때 좋아요."),
            ("발 마사지", "발 마사지|발·", "많이 걸은 날 짧게 받기 좋아요. 대부분 30~60분 메뉴가 있어요."),
            ("키즈 · 아동", "키즈|아동|아이", "아이 전용 메뉴가 있는 곳이에요. 가족 여행이면 같이 받기 좋아요."),
            ("임산부", "임산부|산전", "임산부 전용 메뉴가 있는 곳이에요. 예약할 때 임신 주수를 꼭 알려 주세요."),
        ],
        "areas": [
            ("시내 (한시장 · 용다리 · 롯데마트 주변)", "Hải Châu|Thanh Khê|Hòa Cường|한시장|롯데마트", "쇼핑 · 식사 동선과 묶기 좋아요."),
            ("미케비치 · 해변 쪽", "Sơn Trà|Ngũ Hành Sơn|An Hải|Phước Mỹ|Khuê Mỹ|미케", "해변 호텔에 묵는다면 이동이 짧아요."),
        ],
        "when": "다낭은 밤 비행기로 떠나는 일정이 많아요. 체크아웃하고 공항 가기 전 마지막 일정으로 마사지를 넣는 경우가 많은데, 이럴 땐 짐 보관 · 샤워가 되는 곳이나 공항 샌딩을 해 주는 곳을 고르면 편해요. "
                "바깥 자료에 따르면 한인 제휴 스파 상당수가 짐을 무료로 맡아 주고, 2인 이상 90분 예약 시 시내 픽업 · 드랍을 해 주는 곳이 흔해요.",
        "when_src": "tripstore",
        "faq_extra": [
            ("예약 없이 가도 되나요?", "가능한 곳도 있지만, 저녁 시간대와 주말에는 자리가 없을 때가 많아요. 하루 전에 예약하면 원하는 시간에 받기 쉬워요. 늦게 도착하면 늦은 만큼 마사지 시간이 줄 수 있으니 10분 전에 도착하는 게 좋아요."),
        ],
    },
    "nhatrang": {
        "checked": "2026-11-12",
        "title": "나트랑 마사지 · 스파 가이드 2026 — 가격, 팁, 고르는 법, 예약 방법",
        "intro": "나트랑은 해변 휴양과 함께 마사지 · 스파를 즐기는 여행객이 많은 도시예요. 시내에 마사지 숍이 모여 있고, 리조트 스파와 네일 숍도 많아요. "
                 "이 글은 엉클데이에 등록된 나트랑 업체 정보와 바깥 자료를 바탕으로 가격, 팁, 고르는 법, 예약 방법을 정리했어요.",
        "price_note": "바깥 자료 기준으로는 60분에 발 마사지 15만~30만동, 아로마 20만~40만동, 핫스톤 20만~45만동, 90분 전신 마사지 25만~60만동, 고급 호텔 스파는 80만동 이상이에요.",
        "price_src": "tripcom",
        "tip": [
            ("팁은 얼마가 보통이에요?", "베트남은 팁이 의무는 아니에요. 만족했다면 2만~5만동 정도면 충분하다는 안내가 있고, 베트남 여행 안내 사이트 Vietnam Tourism은 마사지 팁으로 5만~10만동(시내 기준)을 안내해요.", ["tripcom", "vntourism"]),
            ("팁은 어떻게 줘요?", "카운터가 아니라 마사지를 해 준 테라피스트에게 직접 건네는 게 좋아요. 카운터에 주면 본인에게 전달되지 않을 수도 있어요.", ["vntourism"]),
            ("팁이 포함된 곳도 있나요?", "있어요. 가격에 팁이 포함된 곳도 있으니 메뉴판이나 영수증의 '팁 포함 · 노팁' 표시를 확인해서 두 번 내지 않도록 해요. 엉클데이로 예약하면 상담할 때 팁 포함 여부를 알려 드려요.", []),
        ],
        "kinds": [
            ("아로마", "아로마", "향 오일로 전신을 부드럽게 풀어 주는 가장 무난한 마사지예요. 처음이라면 아로마가 좋아요."),
            ("핫스톤", "핫스톤", "따뜻한 돌로 근육을 풀어 줘요. 바다 수영 · 물놀이로 몸이 차가워진 날 좋아요."),
            ("타이 · 건식", "건식|타이|태국", "오일 없이 옷을 입고 스트레칭하듯 눌러 줘요. 시원하고 강한 압을 좋아하면 맞아요."),
            ("허브볼", "허브볼", "따뜻한 허브 주머니로 눌러 주는 마사지예요. 뭉친 어깨 · 등에 좋아요."),
            ("발 마사지", "발 마사지|족욕", "많이 걸은 날 짧게 받기 좋아요."),
            ("키즈 · 아동", "키즈|아동|아이", "아이 전용 메뉴가 있는 곳이에요. 가족 여행이면 같이 받기 좋아요."),
            ("임산부", "임산부|산전", "임산부 전용 메뉴가 있는 곳이에요. 예약할 때 임신 주수를 꼭 알려 주세요."),
        ],
        "areas": [
            ("시내 (해변 도로 쩐푸 · 여행자 거리 주변)", "Nha Trang, Khánh Hòa|Hùng Vương|Tô Hiến Thành|Đống Đa|Lê Đại Hành|시내", "숍이 가장 많이 모여 있고, 식사 · 쇼핑과 묶기 좋아요."),
            ("빈펄섬 · 리조트", "빈펄|Vinpearl|혼째", "리조트에 묵는다면 섬 안에서 바로 받을 수 있어요."),
            ("깜란 (공항 근처 리조트)", "Cam Ranh|깜란", "공항과 가까워서 떠나는 날 들르기 좋고, 픽업 · 샌딩을 해 주는 곳이 있어요."),
        ],
        "when": "나트랑은 깜란 공항이 시내에서 30km 넘게 떨어져 있고 밤 비행기로 떠나는 일정이 많아요. 체크아웃하고 짐을 맡긴 뒤 마사지 · 샤워를 하고 공항으로 가는 일정이 흔해요. "
                "저녁 7~10시는 붐비니 2~3일 전에 예약하는 게 좋다는 안내도 있어요.",
        "when_src": "tripcom",
        "faq_extra": [
            ("밥 먹고 바로 받아도 되나요?", "식사 후 최소 1시간은 쉬고 받는 게 좋고, 술을 마신 뒤에는 마사지를 피하는 게 좋아요. 강도나 집중할 부위는 시작 전에 말하고, 너무 아프면 바로 말해 주세요."),
            ("예약 없이 가도 되나요?", "시내에는 바로 들어갈 수 있는 곳도 있지만 저녁 7~10시는 붐벼요. 원하는 시간에 받으려면 미리 예약하는 게 좋아요."),
        ],
    },
    "hcm": {
        "checked": "2026-11-12",
        "title": "호치민 마사지 · 스파 가이드 2026 — 가격, 팁, 고르는 법, 성형 · 피부과 상담까지",
        "intro": "호치민은 베트남에서 가장 큰 도시라서 1군 시내의 오래된 스파부터 공항 근처 숍, 성형외과 · 피부과까지 선택지가 넓어요. "
                 "이 글은 엉클데이에 등록된 호치민 업체 정보와 바깥 자료를 바탕으로 마사지 고르는 법, 팁, 예약 방법, 성형 · 피부과 한국어 상담까지 정리했어요.",
        "price_note": "",
        "price_src": None,
        "tip": [
            ("팁은 얼마가 보통이에요?", "베트남에서 팁은 의무가 아니지만, 마사지 팁으로는 보통 5만~10만동(시내 기준)을 안내해요.", ["vntourism"]),
            ("팁은 어떻게 줘요?", "카운터가 아니라 마사지를 해 준 테라피스트에게 직접 건네는 게 좋아요. 카운터에 주면 본인에게 전달되지 않을 수도 있어요.", ["vntourism"]),
            ("팁이 포함된 곳도 있나요?", "있어요. 결제 전에 영수증이나 카운터 안내문에서 팁 포함 여부를 확인하고, 포함이 아니면 케어가 끝난 뒤 테라피스트에게 직접 건네요.", ["tripstore_hcm"]),
        ],
        "kinds": [
            ("아로마", "아로마|오일", "향 오일로 전신을 부드럽게 풀어 주는 가장 무난한 마사지예요. 처음이라면 아로마가 좋아요."),
            ("핫스톤", "핫스톤", "따뜻한 돌로 근육을 풀어 줘요. 에어컨에 몸이 차가워진 날 좋아요."),
            ("타이 · 건식", "건식|타이|태국|시아추", "오일 없이 옷을 입고 스트레칭하듯 눌러 줘요. 시원하고 강한 압을 좋아하면 맞아요."),
            ("발 마사지", "발 마사지|발 반사|발 케어", "많이 걸은 날 짧게 받기 좋아요."),
            ("사우나 · 자쿠지", "사우나|자쿠지", "마사지 전에 몸을 데우고 싶을 때 좋아요. 사우나가 같이 있는 곳이에요."),
            ("헤드스파", "헤드스파|샴푸", "두피 마사지와 머리 감기를 같이 해 줘요. 비행 전에 개운하게 씻고 싶을 때 좋아요."),
        ],
        "areas": [
            ("1군 시내 (벤탄 · 동커이 · 노트르담 주변)", "Quận 1|1군|Bến Nghé|Bến Thành|Tân Định|Điện Biên Phủ", "관광지 · 쇼핑과 묶기 좋아요."),
            ("떤빈 (공항 근처)", "Tân Bình|떤빈|공항 근처", "떠나는 날 공항 가기 직전에 들르기 좋아요."),
            ("타오디엔 (2군 · 외국인 거주지)", "Thảo Điền|타오디엔|Quận 2", "조용한 분위기의 카페 · 클리닉이 많은 동네예요."),
        ],
        "when": "호치민은 밤 비행기로 떠나는 일정이 많고, 공항(떤선녓)이 시내와 가까운 편이에요. 체크아웃 후 짐 보관과 샤워가 되는지는 매장마다 다르니 예약할 때 꼭 확인해요. 인기 매장은 당일에 가면 기다리거나 마감될 수 있어서 최소 하루 전 예약이 안전해요.",
        "when_src": "tripstore_hcm",
        "clinic": "호치민에는 성형외과 · 피부과도 많아요. 수술이나 시술은 상담이 먼저라서, 엉클데이가 한국어로 상담을 연결하고 일정 · 비용 안내를 도와 드려요. 무료 첫 상담이나 공항 픽업을 해 주는 곳도 있어요. 수술은 반드시 의사와 충분히 상담하고 결정해 주세요.",
        "faq_extra": [
            ("예약 시간에 늦으면 어떻게 돼요?", "10분 전에 도착하는 게 좋아요. 처음 가면 간단한 설문을 쓰고, 귀중품은 락커에 넣어요. 샤워를 하고 싶으면 예약할 때 미리 말해 두세요."),
        ],
    },
    "hanoi": {
        "checked": "2026-11-12",
        "title": "하노이 마사지 · 스파 가이드 2026 — 가격, 팁, 고르는 법, 예약 방법",
        "intro": "하노이는 구시가지(올드쿼터)를 걸어 다니며 여행하는 사람이 많아서, 걷다가 들르기 좋은 마사지 숍이 구시가지에 모여 있어요. "
                 "이 글은 엉클데이에 등록된 하노이 업체 정보와 바깥 자료를 바탕으로 팁, 고르는 법, 동네, 예약 방법을 정리했어요.",
        "price_note": "",
        "price_src": None,
        "tip": [
            ("팁은 얼마가 보통이에요?", "베트남에서 팁은 의무가 아니지만, 마사지 팁으로는 보통 5만~10만동(시내 기준)을 안내해요.", ["vntourism"]),
            ("팁은 어떻게 줘요?", "카운터가 아니라 마사지를 해 준 테라피스트에게 직접 건네는 게 좋아요. 카운터에 주면 본인에게 전달되지 않을 수도 있어요.", ["vntourism"]),
            ("팁이 포함된 곳도 있나요?", "있어요. 메뉴판이나 영수증의 '팁 포함 · 노팁' 표시를 확인해서 두 번 내지 않도록 해요. 엉클데이로 예약하면 상담할 때 팁 포함 여부를 알려 드려요.", []),
        ],
        "kinds": [
            ("아로마", "아로마|오일", "향 오일로 전신을 부드럽게 풀어 주는 가장 무난한 마사지예요. 처음이라면 아로마가 좋아요."),
            ("핫스톤", "핫스톤", "따뜻한 돌로 근육을 풀어 줘요. 에어컨에 몸이 차가워진 날 좋아요."),
            ("타이 · 건식", "건식|타이|태국|시아추", "오일 없이 옷을 입고 스트레칭하듯 눌러 줘요. 시원하고 강한 압을 좋아하면 맞아요."),
            ("발 마사지", "발 마사지|발 반사|발 케어", "많이 걸은 날 짧게 받기 좋아요."),
            ("베트남 전통", "베트남 전통", "지압과 오일을 섞은 베트남식 마사지예요. 하노이에 왔다면 한 번 받아 볼 만해요."),
            ("포핸드 · 대나무", "포핸드|대나무", "두 명이 동시에 하거나 대나무 막대로 굴려 주는 마사지예요."),
            ("사우나 · 스팀", "사우나|스팀", "겨울(12~2월) 하노이는 쌀쌀해서 사우나 · 스팀과 같이 받으면 좋아요."),
        ],
        "areas": [
            ("구시가지 (올드쿼터 · 호안끼엠 호수 주변)", "올드쿼터|Hoàn Kiếm|호안끼엠", "걸어서 관광하다 들르기 좋아요. 숍이 가장 많이 모여 있어요."),
            ("서호 (떠이호)", "서호|Tây Hồ", "구시가지보다 조용하고, 호수 주변 카페와 묶기 좋아요."),
        ],
        "when": "하노이는 노이바이 공항이 시내에서 떨어져 있어서, 떠나는 날 체크아웃 후 구시가지에서 마사지를 받고 공항으로 가는 일정이 많아요. 짐 보관 · 샤워가 되는지는 매장마다 다르니 예약할 때 확인해요.",
        "when_src": None,
        "faq_extra": [
            ("예약 없이 가도 되나요?", "구시가지에는 바로 들어갈 수 있는 곳도 있지만 저녁에는 붐벼요. 원하는 시간에 받으려면 미리 예약하는 게 좋아요."),
        ],
    },
}

# ---- 영어판 (en/c/<도시>/guide/) : 한국어판과 같은 순서로 이름 · 설명만 영어로 (찾는 패턴은 한국어판 것을 그대로 써요) ----
SOURCES_EN = {
    "tripstore": "Tripstore blog, “Da Nang spa prices & booking tips” (Korean, Apr 2026)",
    "tripcom": "Trip.com, “How to choose a massage in Nha Trang” (Korean, Aug 2026)",
    "tripstore_hcm": "Tripstore blog, “Ho Chi Minh City spa guide” (Korean, Oct 2026)",
    "vntourism": "Vietnam Tourism, “Tipping in Vietnam 2026”",
}
_TIP_HOW = ("How do I give the tip?", "Hand it directly to your therapist rather than leaving it at the front desk, where it may not reach them.")
_TIP_INC = ("Is the tip sometimes included?", "Yes. Some spas include the tip in the price, so check the menu or receipt for “tip included / no tip” before paying so you don’t tip twice. When you book through Uncle Day we tell you in advance.")
_K = {"aroma": ("Aroma oil", "A gentle full-body oil massage — the safest choice for a first visit."),
      "stone": ("Hot stone", "Warm stones loosen tight muscles; great after a day in air-conditioning or at the beach."),
      "thai": ("Thai / dry", "No oil, done fully clothed with stretching and firm pressure."),
      "foot": ("Foot massage", "A short treat after a long day of walking.")}
GUIDES_EN = {
    "danang": {
        "title": "Da Nang Massage & Spa Guide 2026 — Prices, Tipping, How to Choose, How to Book",
        "intro": "Da Nang is one of Vietnam’s busiest beach cities for international travelers, with spas everywhere from the Han Market area to My Khe Beach. "
                 "This guide combines the shops listed on Uncle Day with outside sources to cover prices, tipping, how to choose and how to book.",
        "price_note": "Outside sources put a 90-minute full-body massage at roughly KRW 15,000–25,000 at local spas and KRW 30,000–50,000 at Korean-partnered spas.",
        "tip": [("How much should I tip?", "Around 50,000 VND for 60 minutes and 70,000–100,000 VND for 90 minutes is common; Vietnam Tourism suggests 50,000–100,000 VND for spa therapists in the city."),
                _TIP_HOW, _TIP_INC],
        "kinds": [_K["aroma"], _K["stone"], _K["thai"], ("Four-hands", "Two therapists at once — an intense treatment in a short time."), _K["foot"],
                  ("Kids", "Shops with a children’s menu — handy for family trips."), ("Pregnancy", "Shops with a prenatal menu; mention how far along you are when booking.")],
        "areas": [("City centre (Han Market, Dragon Bridge, Lotte Mart)", "Easy to combine with shopping and meals."),
                  ("My Khe Beach side", "Short trip if you are staying at a beach hotel.")],
        "when": "Many flights leave Da Nang late at night, so a massage after hotel check-out is a popular last stop. Choose a spa with luggage storage, showers or an airport drop-off. "
                "Outside sources note that most Korean-partnered spas store luggage for free and many offer free pickup/drop-off in the city for 2+ guests booking 90 minutes.",
        "faq_extra": [("Can I walk in without a booking?", "Sometimes, but evenings and weekends fill up. Booking a day ahead is safest, and arrive 10 minutes early — late arrivals may get a shorter session.")],
    },
    "nhatrang": {
        "title": "Nha Trang Massage & Spa Guide 2026 — Prices, Tipping, How to Choose, How to Book",
        "intro": "Nha Trang is a beach resort city where a massage is part of almost every trip. Massage shops cluster downtown, with resort spas and nail salons nearby. "
                 "This guide combines the shops listed on Uncle Day with outside sources to cover prices, tipping, how to choose and how to book.",
        "price_note": "Outside sources list 60 minutes at 150,000–300,000 VND for a foot massage, 200,000–400,000 VND for aroma, 200,000–450,000 VND for hot stone, 250,000–600,000 VND for a 90-minute full body, and 800,000 VND+ at upscale hotel spas.",
        "tip": [("How much should I tip?", "Tipping is not mandatory in Vietnam. One guide suggests 20,000–50,000 VND if you were happy; Vietnam Tourism suggests 50,000–100,000 VND for spa therapists in the city."),
                _TIP_HOW, _TIP_INC],
        "kinds": [_K["aroma"], _K["stone"], _K["thai"], ("Herbal ball", "Warm herbal compresses pressed into sore shoulders and back."), _K["foot"],
                  ("Kids", "Shops with a children’s menu — handy for family trips."), ("Pregnancy", "Shops with a prenatal menu; mention how far along you are when booking.")],
        "areas": [("Downtown (Tran Phu beach road & backpacker area)", "Most shops are here, close to restaurants and shopping."),
                  ("Vinpearl island & resorts", "Convenient if you are staying on the island."),
                  ("Cam Ranh (near the airport)", "Handy on departure day; some offer pickup and drop-off.")],
        "when": "Cam Ranh airport is more than 30 km from downtown and many flights leave at night. A common plan is to store luggage after check-out, have a massage and shower, then head to the airport. Evenings from 7–10 pm get busy, so book 2–3 days ahead.",
        "faq_extra": [("Can I get a massage right after eating?", "Wait at least an hour after a meal and avoid massages after drinking. Tell your therapist your preferred pressure before starting."),
                      ("Can I walk in without a booking?", "Some downtown shops take walk-ins, but 7–10 pm is busy. Book ahead for your preferred time.")],
    },
    "hcm": {
        "title": "Ho Chi Minh City Massage & Spa Guide 2026 — Tipping, How to Choose, Clinics",
        "intro": "Ho Chi Minh City is Vietnam’s largest city, with long-running spas in District 1, quick stops near the airport and plenty of cosmetic and dermatology clinics. "
                 "This guide combines the shops listed on Uncle Day with outside sources to cover tipping, how to choose, how to book and clinic consultations.",
        "price_note": "",
        "tip": [("How much should I tip?", "Tipping is not mandatory, but 50,000–100,000 VND is typical for spa therapists in the city."),
                _TIP_HOW, ("Is the tip sometimes included?", "Yes. Check the receipt or counter notice before paying; if it isn’t included, hand it to your therapist after the treatment.")],
        "kinds": [_K["aroma"], _K["stone"], _K["thai"], _K["foot"], ("Sauna & jacuzzi", "Warm up before your massage at shops with a sauna."),
                  ("Head spa", "Scalp massage plus hair wash — great for freshening up before a flight.")],
        "areas": [("District 1 (Ben Thanh, Dong Khoi, Notre-Dame)", "Easy to combine with sightseeing and shopping."),
                  ("Tan Binh (near the airport)", "A good last stop before your flight."),
                  ("Thao Dien (District 2)", "A quieter expat neighbourhood with cafés and clinics.")],
        "when": "Many flights leave at night and Tan Son Nhat airport is fairly close to the city. Luggage storage and showers vary by shop, so check when booking. Popular spas can be full on the day, so book at least a day ahead.",
        "clinic": "Ho Chi Minh City also has many cosmetic surgery and dermatology clinics. Treatments start with a consultation; Uncle Day can arrange the consultation and help with scheduling and costs. Some clinics offer a free first consultation or airport pickup. Always discuss surgery thoroughly with the doctor before deciding.",
        "faq_extra": [("What if I’m late?", "Arrive 10 minutes early. First-timers fill in a short form, and valuables go in a locker. If you want a shower, mention it when booking.")],
    },
    "hanoi": {
        "title": "Hanoi Massage & Spa Guide 2026 — Tipping, How to Choose, How to Book",
        "intro": "Hanoi is best explored on foot around the Old Quarter, where many massage shops make an easy stop between sights. "
                 "This guide combines the shops listed on Uncle Day with outside sources to cover tipping, how to choose, neighbourhoods and how to book.",
        "price_note": "",
        "tip": [("How much should I tip?", "Tipping is not mandatory, but 50,000–100,000 VND is typical for spa therapists in the city."), _TIP_HOW, _TIP_INC],
        "kinds": [_K["aroma"], _K["stone"], _K["thai"], _K["foot"], ("Vietnamese traditional", "Acupressure mixed with oil — worth trying once in Hanoi."),
                  ("Four-hands & bamboo", "Two therapists at once, or rolling bamboo sticks."), ("Sauna & steam", "Hanoi winters (Dec–Feb) are chilly, so a sauna or steam beforehand is a treat.")],
        "areas": [("Old Quarter (Hoan Kiem Lake)", "The biggest cluster of shops, ideal between walking tours."),
                  ("West Lake (Tay Ho)", "Quieter than the Old Quarter, near lakeside cafés.")],
        "when": "Noi Bai airport is a fair distance from the city, so many travelers check out, get a massage in the Old Quarter, then head to the airport. Luggage storage and showers vary by shop, so check when booking.",
        "faq_extra": [("Can I walk in without a booking?", "Some Old Quarter shops take walk-ins, but evenings get busy. Book ahead for your preferred time.")],
    },
}
