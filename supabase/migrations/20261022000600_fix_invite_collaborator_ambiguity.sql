create or replace function public.invite_note_collaborator(target_note_id bigint, collaborator_email text)
returns table (user_id uuid, full_name text, avatar_url text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid;
  collaborator_id uuid;
begin
  select n.user_id into owner_id
  from public.notes as n
  where n.id = target_note_id;

  if owner_id is null or owner_id <> (select auth.uid()) then
    raise exception 'Only the note owner can invite collaborators';
  end if;
  if not public.is_premium_user(owner_id) then
    raise exception 'Premium plan is required to share notes';
  end if;

  select auth_user.id into collaborator_id
  from auth.users as auth_user
  where lower(auth_user.email) = lower(trim(collaborator_email));

  if collaborator_id is null then
    raise exception 'No account found for that email';
  end if;
  if collaborator_id = owner_id then
    raise exception 'You already own this note';
  end if;

  insert into public.note_members as membership (note_id, user_id, invited_by)
  values (target_note_id, collaborator_id, owner_id)
  on conflict (note_id, user_id) do nothing;

  return query
  select profile.id, profile.full_name, profile.avatar_url
  from public.profiles as profile
  where profile.id = collaborator_id;
end;
$$;

revoke all on function public.invite_note_collaborator(bigint, text) from public;
grant execute on function public.invite_note_collaborator(bigint, text) to authenticated;