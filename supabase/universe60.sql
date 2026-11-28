-- ============================================================
-- universe60 · 📁 엉클데이 자료실 + 🔗 관리자 바로가기 바
--  · 우리 카톡 QR · 참고 링크 · 메모 · 파일을 모아 두는 곳 (브랜드 자료실과 따로)
--  · 링크에 '바로가기 바에 띄우기'를 켜면, 관리자로 로그인했을 때만 화면 아래에 계속 따라다녀요
--  · 관리자만 읽고 쓸 수 있어요. 파일은 비공개 저장소 'brand' 안 udlib/ 폴더에 넣어요 (universe17 필요)
-- 여러 번 실행해도 괜찮아요.
-- ============================================================
create table if not exists public.ud_library (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null default 'link' check (kind in ('link', 'file', 'note')),
  cat         text not null default 'ref' check (cat in ('kakao', 'sns', 'ref', 'doc', 'etc')),
  title       text not null,
  url         text,
  path        text unique,
  mime        text,
  size        bigint not null default 0,
  note        text,
  icon        text,
  on_bar      boolean not null default false,
  sort        int not null default 0,
  pinned      boolean not null default false,
  created_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists ud_library_cat_idx on public.ud_library (cat, created_at desc);
alter table public.ud_library enable row level security;
drop policy if exists ud_library_admin on public.ud_library;
create policy ud_library_admin on public.ud_library for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.ud_library from anon;
grant select, insert, update, delete on public.ud_library to authenticated;

create or replace function public.ud_library_before() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then new.created_by := lower(coalesce(auth.jwt() ->> 'email', '')); new.created_at := now();
  else new.created_by := old.created_by; new.created_at := old.created_at; end if;
  new.updated_at := now();
  new.title := left(btrim(coalesce(new.title, '')), 200);
  new.note := nullif(left(btrim(coalesce(new.note, '')), 2000), '');
  new.url := nullif(left(btrim(coalesce(new.url, '')), 2000), '');
  if new.url is not null and new.url !~* '^https?://' then raise exception '링크는 http:// 또는 https:// 로 시작해야 해요'; end if;
  new.icon := nullif(left(btrim(coalesce(new.icon, '')), 8), '');
  return new;
end $$;
drop trigger if exists ud_library_before on public.ud_library;
create trigger ud_library_before before insert or update on public.ud_library for each row execute function public.ud_library_before();

-- 처음 한 번만 넣는 기본 바로가기 (지우거나 고쳐도 돼요)
insert into public.ud_library (kind, cat, title, url, icon, on_bar, sort)
select * from (values
  ('link', 'kakao', '카톡 채널 상담함', 'https://center-pf.kakao.com/_xgkuxeX/chats', '💬', true, 1),
  ('link', 'kakao', '카톡 채널 (손님용 주소)', 'https://pf.kakao.com/_xgkuxeX/chat', '💛', false, 2),
  ('link', 'ref', '엉클데이 사이트', 'https://www.uncleday.com/', '🏠', true, 3),
  ('link', 'sns', '네이버 블로그 (주소 바꿔 주세요)', 'https://blog.naver.com/', '🟢', true, 4)
) v(kind, cat, title, url, icon, on_bar, sort)
where not exists (select 1 from public.ud_library);
