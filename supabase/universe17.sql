-- ============================================================
-- 41. 🎨 브랜드 자료실 (CI) — 사내에서 쓰는 로고 · 명함 · 사진 · 홍보물 · 폰트 보관함
--  · 관리자만 볼 수 있는 비공개 저장소예요 (밖에서 주소만 알아도 못 열어요).
--  · 열기 · 내려받기는 그때그때 만든 임시 링크로 돼요. 한 파일 50MB까지.
-- universe16.sql 다음에 실행하세요. 여러 번 실행해도 괜찮아요.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brand', 'brand', false, 52428800, array[
  'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml', 'image/heic', 'image/vnd.adobe.photoshop',
  'application/pdf', 'application/postscript', 'application/illustrator', 'application/zip',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/x-hwp', 'application/vnd.hancom.hwpx',
  'font/ttf', 'font/otf', 'font/woff', 'font/woff2', 'video/mp4', 'application/octet-stream'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "uncleday brand admin" on storage.objects;
create policy "uncleday brand admin" on storage.objects for all to authenticated
  using (bucket_id = 'brand' and public.is_admin()) with check (bucket_id = 'brand' and public.is_admin());

create table if not exists public.brand_assets (
  id          uuid primary key default gen_random_uuid(),
  path        text not null unique,
  name        text not null,
  cat         text not null default 'etc' check (cat in ('logo', 'card', 'photo', 'promo', 'doc', 'font', 'etc')),
  note        text,
  size        bigint not null default 0,
  mime        text,
  w           int,
  h           int,
  pinned      boolean not null default false,
  uploaded_by text,
  created_at  timestamptz not null default now()
);
create index if not exists brand_assets_cat_idx on public.brand_assets (cat, created_at desc);
alter table public.brand_assets enable row level security;
drop policy if exists brand_assets_admin on public.brand_assets;
create policy brand_assets_admin on public.brand_assets for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.brand_assets to authenticated;

create or replace function public.brand_assets_before() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then new.uploaded_by := lower(coalesce(auth.jwt() ->> 'email', '')); new.created_at := now();
  else new.uploaded_by := old.uploaded_by; new.created_at := old.created_at; new.path := old.path; end if;
  new.name := left(btrim(coalesce(new.name, '')), 200); new.note := nullif(left(btrim(coalesce(new.note, '')), 500), '');
  return new;
end $$;
drop trigger if exists brand_assets_before on public.brand_assets;
create trigger brand_assets_before before insert or update on public.brand_assets for each row execute function public.brand_assets_before();
