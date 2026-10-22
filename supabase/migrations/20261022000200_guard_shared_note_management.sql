create or replace function public.guard_shared_note_management()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce((select auth.role()), '') = 'authenticated'
    and (select auth.uid()) is distinct from old.user_id and (
    new.is_pinned is distinct from old.is_pinned
    or new.is_trashed is distinct from old.is_trashed
    or new.folder_id is distinct from old.folder_id
  ) then
    raise exception 'Only the note owner can manage pin, trash, and folder settings';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_shared_note_management on public.notes;
create trigger guard_shared_note_management
  before update on public.notes
  for each row execute function public.guard_shared_note_management();