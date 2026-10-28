-- Allow direct evaluation of user_id during INSERT ... RETURNING by including user_id check in SELECT policy
drop policy if exists "Owners and collaborators can view notes" on public.notes;
create policy "Owners and collaborators can view notes"
  on public.notes for select to authenticated
  using (user_id = (select auth.uid()) or public.can_access_note(id));
