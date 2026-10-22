alter table public.profiles
  add column if not exists premium_expires_at timestamptz;

create or replace function public.is_premium_user(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = target_user_id
      and plan = 'premium'
      and premium_expires_at > now()
  );
$$;

revoke all on function public.is_premium_user(uuid) from public;
grant execute on function public.is_premium_user(uuid) to authenticated;