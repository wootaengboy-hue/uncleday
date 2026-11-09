-- 첨부파일 (비공개): 할 일·영업 카드에 계약서 같은 파일을 올려요
-- 관리자만 볼 수 있고, 누를 때마다 5분짜리 임시 링크로 열려요
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('files', 'files', false, 10485760, array[
  'application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/x-hwp','application/vnd.hancom.hwpx','text/plain','text/csv',
  'image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "uncleday files admin" on storage.objects;
create policy "uncleday files admin" on storage.objects for all to authenticated
  using (bucket_id = 'files' and public.is_admin()) with check (bucket_id = 'files' and public.is_admin());

create table if not exists public.attachments (
  id           uuid primary key default gen_random_uuid(),
  target_type  text not null check (target_type in ('task', 'lead')),
  target_id    uuid not null,
  path         text not null unique,
  name         text not null,
  size         bigint not null default 0,
  mime         text,
  uploaded_by  text,
  created_at   timestamptz not null default now()
);
create index if not exists attachments_target_idx on public.attachments (target_type, target_id, created_at);
alter table public.attachments enable row level security;

create or replace function public.attachments_before() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.uploaded_by := lower(coalesce(auth.jwt() ->> 'email', '')); new.created_at := now();
  return new;
end $$;
drop trigger if exists attachments_before on public.attachments;
create trigger attachments_before before insert on public.attachments for each row execute function public.attachments_before();

drop policy if exists att_read on public.attachments;
create policy att_read on public.attachments for select to authenticated using (public.is_admin());
drop policy if exists att_add on public.attachments;
create policy att_add on public.attachments for insert to authenticated with check (public.is_admin());
drop policy if exists att_del on public.attachments;   -- 올린 사람만 지울 수 있어요
create policy att_del on public.attachments for delete to authenticated
  using (public.is_admin() and uploaded_by = lower(coalesce(auth.jwt() ->> 'email', '')));
