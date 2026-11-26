-- ===============================================================
-- universe48: 🔍 업체 정보 검수 · 🖼️ 이미지 검수 (캐시바이 방식)
--  · shop_sources: 업체마다 홈페이지 · 페이스북 링크, 홈페이지에서 모아 온 정보(초안), 검수 상태, 사진 사용 허락
--      → 직원만 봐요. 손님 업체 화면에서 직원이 로그인하면 [홈페이지] [페이스북] 버튼이 떠요 (비교하며 검수)
--  · shop_media: 업체 사진 후보 → 원본 | 작업본 | 실제 노출 비교 → 판정 (통과 · 문제 · 보류)
--      출처: field(현장에서 우리가 찍음) · owner(업체가 준 · 허락) · site(홈페이지 후보 — 허락 전엔 공개 안 됨)
--      공개는 '통과' + (현장 사진 또는 사진 사용 허락받은 업체) 일 때만
-- Supabase → SQL Editor 에 붙여 넣고 Run (여러 번 실행해도 괜찮아요)
-- ===============================================================

create table if not exists public.shop_sources (
  shop_id      text primary key,
  web          text,                                   -- 공식 홈페이지
  fb           text,                                   -- 페이스북
  other        jsonb not null default '{}'::jsonb,     -- 잘로 · 인스타 · 카카오 등
  crawled      jsonb,                                  -- 모아 온 정보 { hours, address, phone, menu:[{name,minutes,price}], features, src:[url] }
  crawled_at   timestamptz,
  review       text not null default 'none' check (review in ('none', 'todo', 'done', 'skip')),   -- 정보 검수
  reviewed_at  timestamptz,
  reviewed_by  text,
  photo_ok     boolean not null default false,         -- 업체가 사진 사용을 허락했나
  photo_note   text,                                   -- 허락 받은 방법 · 날짜 (계약서 · 잘로 등)
  updated_at   timestamptz not null default now()
);
alter table public.shop_sources enable row level security;
drop policy if exists src_staff on public.shop_sources;
create policy src_staff on public.shop_sources for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- 손님 업체 화면: 직원이면 링크를 돌려줘요 (직원이 아니면 null)
create or replace function public.staff_shop_links(sid text) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when is_staff() then (select jsonb_build_object('web', web, 'fb', fb, 'review', review, 'photo_ok', photo_ok) from shop_sources where shop_id = sid) end
$$;
grant execute on function public.staff_shop_links(text) to anon, authenticated;

create table if not exists public.shop_media (
  id          bigserial primary key,
  shop_id     text not null,
  source      text not null default 'field' check (source in ('field', 'owner', 'site')),
  orig_url    text,             -- 원본 (현장 사진은 우리 저장소 · 홈페이지 후보는 그 사이트 주소)
  work_url    text,             -- 작업본 (1024px · 밝기 · 자르기)
  verdict     text not null default 'none' check (verdict in ('none', 'pass', 'issue', 'hold')),
  issues      text[] not null default '{}',   -- 날조 · 왜곡 · 글자 · 워터마크 · 사람 얼굴 · 흐림 · 다른 가게
  note        text,
  is_main     boolean not null default false, -- 대표 사진
  created_at  timestamptz not null default now(),
  created_by  text,
  checked_at  timestamptz,
  checked_by  text
);
create index if not exists shop_media_shop on public.shop_media (shop_id);
alter table public.shop_media enable row level security;
drop policy if exists media_staff on public.shop_media;
create policy media_staff on public.shop_media for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- 지금 알고 있는 링크 (11/25 정리한 연락처 시트) — 이미 있으면 그대로
insert into public.shop_sources (shop_id, web, fb, review) values
  ('dahan-spa', 'https://www.dahanspa.com/', 'https://www.facebook.com/luxurydahanspadanang/', 'todo'),
  ('azit-spa', null, null, 'none'),
  ('villa-de-spa', null, 'https://www.facebook.com/danangvilladespa/', 'todo'),
  ('view-spa', null, 'https://www.facebook.com/viewspa126/', 'todo'),
  ('rendezvous-spa', null, 'https://www.facebook.com/rendezvousspa.vn/', 'todo'),
  ('moringa-spa', 'https://moringaspadanang.com/', 'https://www.facebook.com/moringaspanails/', 'todo'),
  ('herbal-spa', 'https://herbalspa.vn/', 'https://www.facebook.com/herbalspadanang/', 'todo'),
  ('sarangbang-spa', null, null, 'none'),
  ('papaya-spa', null, null, 'none'),
  ('clover-spa', 'https://cloverspa.vn/', 'https://www.facebook.com/cloverspavn/', 'todo'),
  ('sform-clinic', null, null, 'none'),
  ('doctor-international', null, 'https://www.facebook.com/doctoraestheticdanang/', 'todo'),
  ('seoul-plastic-danang', null, 'https://www.facebook.com/seoulcenterdanang.vn/', 'todo'),
  ('dr-harvard', 'https://drharvard.vn/', 'https://www.facebook.com/drharvardplasticsurgery/', 'todo'),
  ('linh-chau', 'https://thammyvienlinhchau.com/', 'https://www.facebook.com/thammyvienlinhchau/', 'todo'),
  ('xuan-truong', 'https://thammyxuantruong.com/', 'https://www.facebook.com/bvthammyxuantruong/', 'todo'),
  ('golden-lotus-spa', 'https://saigonwellness.vn/', 'https://www.facebook.com/GoldenLotusSpaQ1/', 'todo'),
  ('ngo-massage-spa', 'https://www.ngospa.vn/', 'https://www.facebook.com/ngospa1/', 'todo'),
  ('swan-spa', 'https://swanspavn.com/', null, 'todo'),
  ('jw-korea-hospital', 'https://jwhospital.vn/', 'https://www.facebook.com/benhvienjw.vn', 'todo'),
  ('dr-quang-tuan', 'https://thammyquangtuan.com/', 'https://www.facebook.com/bacsiquangtuanchuyenkhoaphauthuatthammy', 'todo'),
  ('dr-thanh-hoa', null, null, 'none'),
  ('villa-aesthetica', 'http://www.villaaesthetica.com/', null, 'todo'),
  ('paragon-spa', null, 'https://www.facebook.com/p/Paragon-SPA-100087531035989/', 'todo'),
  ('la-belle-spa', 'https://hanoilabelleviespa.vn/', 'https://www.facebook.com/labellespamassage/', 'todo'),
  ('la-maison-grand-spa', 'https://lamaisonspa.com.vn/grand.html', 'https://www.facebook.com/lamaisonspavn/', 'todo'),
  ('vinmec-view', 'https://www.vinmec.com/eng/', null, 'todo'),
  ('dong-a-beauty', 'https://benhvienthammydonga.vn/', 'https://www.facebook.com/ThamMyDongA/', 'todo'),
  ('white-spa-nail', null, 'https://www.facebook.com/p/White-Spa-Nail-100064704200464/', 'todo'),
  ('j-spa', null, null, 'none'),
  ('well-spa', null, 'https://www.facebook.com/p/Well-Spa-100063464254328/', 'todo'),
  ('grand-spa-nhatrang', null, null, 'none'),
  ('w-spa-nail', null, 'https://www.facebook.com/wspanails/', 'todo'),
  ('lumi-lux-nail', null, 'https://www.facebook.com/p/Lumi-Lux-Nail-Spa-61574584509822/', 'todo'),
  ('aramsa-nails', null, 'https://www.facebook.com/61565089499434/', 'todo'),
  ('vinpearl-spa-nhatrang', 'https://vinpearl.com/en/hotels/vinpearl-resort-spa-nha-trang-bay', 'https://www.facebook.com/vinpearlresortandspanhatrangbay.official/', 'todo'),
  ('cho-ray-aesthetic', null, null, 'none'),
  ('dr-dung-clinic', null, null, 'none'),
  ('anna-huynh', null, null, 'none'),
  ('vvs-nhatrang', null, null, 'none'),
  ('seras-spa', 'https://seraspa.com.vn/', 'https://www.facebook.com/seraspaclinic/', 'todo')
on conflict (shop_id) do nothing;
