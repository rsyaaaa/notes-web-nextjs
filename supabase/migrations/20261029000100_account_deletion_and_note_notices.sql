begin;

-- A notice intentionally keeps no title, content, owner ID, or deletion reason.
-- No FK to notes: recipients can still see it after the original row is gone.
create table if not exists public.note_deletion_notices (
  id uuid primary key default gen_random_uuid(),
  note_id bigint not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  deleted_at timestamptz not null default now(),
  unique (user_id, note_id)
);

create index if not exists note_deletion_notices_user_deleted_idx
  on public.note_deletion_notices (user_id, deleted_at desc);

alter table public.note_deletion_notices enable row level security;
revoke all on public.note_deletion_notices from anon, authenticated;
grant select on public.note_deletion_notices to authenticated;
grant all on public.note_deletion_notices to service_role;

create policy "Recipients can read their own deleted-note notices"
  on public.note_deletion_notices for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.record_note_deletion_notice()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' or new.is_trashed then
    insert into public.note_deletion_notices (note_id, user_id, deleted_at)
    select old.id, m.user_id, now()
    from public.note_members m
    where m.note_id = old.id and m.user_id <> old.user_id
    on conflict (user_id, note_id) do update
      set deleted_at = excluded.deleted_at;
  else
    -- Restoring a trashed note restores access, rather than leaving a stale card.
    delete from public.note_deletion_notices where note_id = new.id;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.record_note_deletion_notice() from public, anon, authenticated;

-- BEFORE DELETE runs while memberships still exist, including auth-user cascades.
create trigger record_note_deletion_before_delete
  before delete on public.notes
  for each row execute function public.record_note_deletion_notice();

create trigger record_note_deletion_on_trash
  after update of is_trashed on public.notes
  for each row
  when (old.is_trashed is distinct from new.is_trashed)
  execute function public.record_note_deletion_notice();

-- Backfill existing shared notes in the owner's trash, without retaining their text.
insert into public.note_deletion_notices (note_id, user_id, deleted_at)
select n.id, m.user_id, coalesce(n.updated_at, now())
from public.notes n
join public.note_members m on m.note_id = n.id
where n.is_trashed and m.user_id <> n.user_id
on conflict (user_id, note_id) do nothing;

-- Deleted/trashed shared notes must not remain editable via a stale browser tab.
create or replace function public.can_access_note(target_note_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.notes n
    where n.id = target_note_id
      and (
        n.user_id = (select auth.uid())
        or (not n.is_trashed and exists (
          select 1 from public.note_members m
          where m.note_id = n.id and m.user_id = (select auth.uid())
        ))
      )
  );
$$;
revoke all on function public.can_access_note(bigint) from public, anon;
grant execute on function public.can_access_note(bigint) to authenticated;

-- Hard auth deletion and relational cleanup share one PostgreSQL transaction.
-- Remove owned notes before memberships so their recipients receive notices.
create or replace function public.cleanup_deleted_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.notes where user_id = old.id;
  -- invited_by did not originally have ON DELETE CASCADE.
  delete from public.note_members where user_id = old.id or invited_by = old.id;
  delete from public.note_folders where user_id = old.id;
  delete from public.profiles where id = old.id;
  return old;
end;
$$;
revoke all on function public.cleanup_deleted_account() from public, anon, authenticated;

create trigger cleanup_account_before_auth_delete
  before delete on auth.users
  for each row execute function public.cleanup_deleted_account();

-- Fail closed in the API if the migration has not been deployed.
create or replace function public.account_deletion_ready()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    to_regclass('public.note_deletion_notices') is not null
    and exists (
      select 1 from pg_catalog.pg_trigger
      where tgrelid = 'auth.users'::regclass
        and tgname = 'cleanup_account_before_auth_delete'
        and tgenabled <> 'D'
    )
    and exists (
      select 1 from pg_catalog.pg_trigger
      where tgrelid = 'public.notes'::regclass
        and tgname = 'record_note_deletion_before_delete'
        and tgenabled <> 'D'
    )
    and exists (
      select 1 from pg_catalog.pg_trigger
      where tgrelid = 'public.notes'::regclass
        and tgname = 'record_note_deletion_on_trash'
        and tgenabled <> 'D'
    );
$$;
revoke all on function public.account_deletion_ready() from public, anon, authenticated;
grant execute on function public.account_deletion_ready() to service_role;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'note_deletion_notices'
  ) then
    alter publication supabase_realtime add table public.note_deletion_notices;
  end if;
end;
$$;

commit;
