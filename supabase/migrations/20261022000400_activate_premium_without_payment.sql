create or replace function public.activate_premium_plan(duration_months integer)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_expiry timestamptz;
  next_expiry timestamptz;
begin
  if current_user_id is null then
    raise exception 'Authentication is required';
  end if;
  if duration_months not in (1, 12) then
    raise exception 'Only one-month and one-year plans are available';
  end if;

  select p.premium_expires_at into current_expiry
  from public.profiles p
  where p.id = current_user_id
  for update;

  if not found then
    raise exception 'Profile not found';
  end if;

  next_expiry := greatest(coalesce(current_expiry, now()), now())
    + make_interval(months => duration_months);

  update public.profiles
  set plan = 'premium',
      premium_expires_at = next_expiry,
      updated_at = now()
  where id = current_user_id;

  return next_expiry;
end;
$$;

revoke all on function public.activate_premium_plan(integer) from public;
grant execute on function public.activate_premium_plan(integer) to authenticated;