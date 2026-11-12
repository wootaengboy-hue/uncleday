-- ============================================================
-- 36. 낙서장 📓 노트 (칸반 말고 자유롭게 쓰는 문서)
--  · 관리자끼리 같이 보는 노트, 또는 '나만 보기' 노트
--  · 폴더 · 📌 고정 · 마지막으로 고친 사람/시간
-- universe11.sql 다음에 실행하세요. 여러 번 실행해도 괜찮아요.
-- ============================================================

create table if not exists public.notes (
  id          uuid primary key default gen_random_uuid(),
  title       text not null default '',
  body        text,
  folder      text,
  pinned      boolean not null default false,
  private     boolean not null default false,
  owner       text,
  created_by  text,
  updated_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists notes_updated_idx on public.notes (updated_at desc);
alter table public.notes enable row level security;
drop policy if exists notes_admin on public.notes;
create policy notes_admin on public.notes for all to authenticated
  using (public.is_admin() and (not private or lower(owner) = lower(coalesce(auth.jwt() ->> 'email', ''))))
  with check (public.is_admin() and (not private or lower(owner) = lower(coalesce(auth.jwt() ->> 'email', ''))));
grant select, insert, update, delete on public.notes to authenticated;

create or replace function public.notes_before() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now(); new.updated_by := actor_name();
  if tg_op = 'INSERT' then
    new.owner := lower(coalesce(auth.jwt() ->> 'email', '')); new.created_by := actor_name(); new.created_at := now();
  else
    new.owner := old.owner; new.created_by := old.created_by; new.created_at := old.created_at;
    -- 비공개 노트는 만든 사람만 공개/비공개를 바꿀 수 있어요
    if new.private is distinct from old.private and lower(coalesce(old.owner, '')) <> lower(coalesce(auth.jwt() ->> 'email', '')) then new.private := old.private; end if;
  end if;
  new.title := left(btrim(coalesce(new.title, '')), 200); new.folder := nullif(left(btrim(coalesce(new.folder, '')), 40), '');
  return new;
end $$;
drop trigger if exists notes_before on public.notes;
create trigger notes_before before insert or update on public.notes for each row execute function public.notes_before();
