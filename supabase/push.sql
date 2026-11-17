-- 자취대로 · 기한 알림(웹 푸시)
-- 알림을 켠 기기(브라우저)의 푸시 주소를 계정마다 저장한다. 매일 아침 9시(한국 시간) Vercel 크론이
-- push_targets(비밀값)로 '푸시 주소 + 휴대폰 캘린더용 일정 묶음(user_state.cal_feed)'을 받아 D-3·당일 알림을 보낸다.
-- 일정 묶음에는 날짜·금액·일정 제목만 있다(이름·주소 없음). 푸시 내용은 브라우저 회사 서버를 거쳐 암호화된 채로 간다.
-- Supabase SQL Editor에서 한 번 실행한다. 비밀값 해시는 아래 맨 끝 insert 로 따로 넣는다(값은 저장소에 두지 않는다).

create table if not exists public.push_subs (
  endpoint text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  constraint push_subs_shape check (endpoint ~ '^https://' and length(endpoint) <= 1000 and length(p256dh) <= 200 and length(auth) <= 100)
);
create index if not exists push_subs_user on public.push_subs (user_id);

alter table public.push_subs enable row level security;
-- 본인 기기만 보고 지운다. 넣기는 push_save()로만 (같은 브라우저를 다른 계정이 쓰면 주인을 바꿔야 해서)
create policy "own push select" on public.push_subs for select to authenticated using ((select auth.uid()) = user_id);
create policy "own push delete" on public.push_subs for delete to authenticated using ((select auth.uid()) = user_id);

-- 크론 비밀값의 해시 (anon·authenticated는 private 스키마를 못 본다)
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.push_key (id int primary key default 1 check (id = 1), hash text not null);

-- 이 기기에서 알림 켜기 (계정마다 기기 10개까지, 넘으면 가장 오래된 것부터 지움)
create or replace function public.push_save(p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'not signed in'; end if;
  if p_endpoint !~ '^https://' or length(p_endpoint) > 1000 or length(coalesce(p_p256dh, '')) not between 1 and 200 or length(coalesce(p_auth, '')) not between 1 and 100 then
    raise exception 'bad subscription';
  end if;
  insert into public.push_subs (endpoint, user_id, p256dh, auth) values (p_endpoint, uid, p_p256dh, p_auth)
  on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, created_at = now();
  delete from public.push_subs where user_id = uid and endpoint in (
    select endpoint from public.push_subs where user_id = uid order by created_at desc offset 10);
end;
$$;
revoke all on function public.push_save(text, text, text) from public, anon;
grant execute on function public.push_save(text, text, text) to authenticated;

-- 크론 전용: 비밀값이 맞을 때만 보낼 곳과 일정 묶음을 준다
create or replace function public.push_targets(p_key text)
returns table (ep text, key_p256dh text, key_auth text, feed text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_key is null or encode(extensions.digest(p_key, 'sha256'), 'hex') is distinct from (select k.hash from private.push_key k where k.id = 1) then
    raise exception 'forbidden';
  end if;
  return query select s.endpoint, s.p256dh, s.auth, u.cal_feed
    from public.push_subs s join public.user_state u on u.user_id = s.user_id
    where u.cal_feed is not null;
end;
$$;
revoke all on function public.push_targets(text) from public;
grant execute on function public.push_targets(text) to anon, authenticated;

-- 크론 전용: 브라우저가 '없는 주소'(404·410)라고 답한 푸시 주소를 지운다
create or replace function public.push_drop(p_key text, p_endpoint text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_key is null or encode(extensions.digest(p_key, 'sha256'), 'hex') is distinct from (select k.hash from private.push_key k where k.id = 1) then
    raise exception 'forbidden';
  end if;
  delete from public.push_subs where endpoint = p_endpoint;
end;
$$;
revoke all on function public.push_drop(text, text) from public;
grant execute on function public.push_drop(text, text) to anon, authenticated;

-- 비밀값(Vercel 환경변수 CRON_SECRET)의 sha256 해시를 넣는다:
-- insert into private.push_key (id, hash) values (1, '<sha256 hex>') on conflict (id) do update set hash = excluded.hash;
