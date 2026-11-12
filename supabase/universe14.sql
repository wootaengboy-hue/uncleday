-- ============================================================
-- 38. 방문자 분석: '그 밖의 나라'를 자세히 (시간대 이름까지)
--  · 지금까지는 시간대를 한국 / 베트남·동남아 / 그 밖 세 칸으로만 셌어요.
--  · 이제 휴대폰·PC의 시간대 이름(예: Asia/Tokyo, America/Los_Angeles)도 숫자로만 함께 세요 (dim = zone).
--  · IP 주소나 개인 정보는 저장하지 않아요. 이 SQL 실행 전 기록은 '그 밖'으로만 남아 있어요.
-- universe13.sql 다음에 실행하세요. 여러 번 실행해도 괜찮아요.
-- ============================================================
drop function if exists public.track_src(text, text, text, text);
create or replace function public.track_src(src text, dev text, lang text, tz text, zone text default null) returns void
language plpgsql security definer set search_path = public as $$
declare d date := (now() at time zone 'Asia/Ho_Chi_Minh')::date; k text; v text;
begin
  foreach k in array array['src', 'dev', 'lang', 'tz', 'zone'] loop
    v := case k when 'src' then src when 'dev' then dev when 'lang' then lang when 'tz' then tz else zone end;
    if k = 'zone' then
      if zone is null then continue; end if;
      v := left(regexp_replace(coalesce(v, ''), '[^A-Za-z0-9_/+-]', '', 'g'), 48);
    else
      v := left(regexp_replace(lower(coalesce(v, '')), '[^a-z0-9_.:-]', '', 'g'), 40);
    end if;
    if v = '' then v := 'unknown'; end if;
    insert into stats_dim (day, dim, val, n) values (d, k, v, 1)
    on conflict (day, dim, val) do update set n = stats_dim.n + 1;
  end loop;
end $$;
revoke all on function public.track_src(text, text, text, text, text) from public;
grant execute on function public.track_src(text, text, text, text, text) to anon, authenticated;
