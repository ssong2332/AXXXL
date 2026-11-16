-- 자취 계약 내비 · 계정(선택) 기록 저장
-- 로그인한 사람마다 한 줄. 앱 상태 중 위치·대화·사진·서류를 뺀 묶음(state)만 둔다 (demo/account-core.js SKIP 참고)
-- Supabase SQL Editor에서 한 번 실행하면 된다.

create table if not exists public.user_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint user_state_size check (pg_column_size(state) < 300000)
);

alter table public.user_state enable row level security;

-- 본인 줄만 읽고 쓴다
create policy "own row select" on public.user_state for select to authenticated using ((select auth.uid()) = user_id);
create policy "own row insert" on public.user_state for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own row update" on public.user_state for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own row delete" on public.user_state for delete to authenticated using ((select auth.uid()) = user_id);

-- 탈퇴: 로그인한 본인 계정을 지운다 (user_state는 on delete cascade로 같이 지워짐)
create or replace function public.delete_me()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = (select auth.uid());
$$;

revoke all on function public.delete_me() from public, anon;
grant execute on function public.delete_me() to authenticated;
