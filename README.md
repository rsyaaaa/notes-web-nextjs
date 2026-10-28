This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Application language

Signed-in users can open **Page List → Pengaturan Aplikasi / Application Settings** to choose **Bahasa Indonesia** or **English**, then save the change. Indonesian is the default for accounts without a preference.

The preference is stored in Supabase Auth `user_metadata.language` (`id` or `en`) using `auth.updateUser`, not in a shared browser preference. It is restored from the signed-in account on other devices; no database migration is required. Signing out resets the UI to Indonesian. Language changes affect interface labels, accessibility text, and date formatting, not note content, user names, or folder names. Raw backend error details are left unchanged.

Translation dictionaries live in `lib/i18n.ts`, `lib/i18n-home.ts`, and `lib/i18n-notes.ts`. Run the local regression checks with:

```bash
npm run test:language
```

These tests use a mocked auth client to check translations, per-account isolation, metadata save requests, save failures, session restoration, and stale async results. Cross-device persistence against a live Supabase project should also be checked with two test accounts.

## Motion

Shared easing and durations live in `app/globals.css`. Route changes use React 19.3 `ViewTransition` through `components/PageTransition.tsx`; unsupported browsers navigate normally, with CSS content reveals as a fallback. The wrapper adds no DOM container that could change fixed/sticky positioning.

Dialogs and popovers use `lib/useAnimatedPresence.ts` to retain closing content for 180ms. Keep `MOTION_EXIT_MS` synchronized with CSS `--motion-exit`. Closing UI is inert; reopening cancels the pending unmount. Reduced-motion preferences disable movement and remove the presence exit delay. Hover lifts are limited to fine-pointer devices.

```bash
npm run test:motion
```

The motion tests exercise lifecycle timing using mocked hooks/timers, reduced motion, retained content, rapid reopen, cleanup, and keyboard-focus restoration. Visual timing and native route transitions still need browser/device testing.

## Account deletion and deleted shared notes

Open **Pengaturan Akun / Account Settings → Hapus Akun / Delete Account**. A server-verified confirmation requires a minimum five-second wait, then the exact phrase `DELETE ACCOUNT NOW`. Successful deletion clears the local session and returns to the login screen. Owned notes (including trash), folders, profile, memberships, and avatar files are removed; other users' notes are not deleted.

### Required deployment setup

1. Apply `supabase/migrations/20261029000100_account_deletion_and_note_notices.sql` to the project's Supabase database, along with any earlier pending migrations (for a linked project, use `supabase db push`). Review/back up the database before applying migrations.
2. Set **`SUPABASE_SERVICE_ROLE_KEY`** in the server environment, alongside the existing `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Never use a `NEXT_PUBLIC_` prefix for the service-role key, expose it to browser code, or commit it. Restart/redeploy after changing environment variables.
3. Verify with disposable test accounts in the deployed environment, including a shared note and both interface languages. Local tests do not call live Supabase Auth/Storage.

The API deliberately refuses deletion until its service-role-only readiness RPC confirms the cleanup triggers are installed. Authentication is verified from the current bearer token; the browser cannot choose a different account to delete. The signed confirmation expires after ten minutes.

Collaborators get a noninteractive gray card saying only **“Catatan ini sudah dihapus oleh pemilik.” / “This note has been deleted by its owner.”** Notices retain no title, content, owner ID, or account-deletion reason. Moving a shared note to trash also hides it from collaborators; restoring it clears the notice and restores access. Permanent deletion keeps only recipient-scoped notice metadata. Existing shared notes in trash are backfilled; historical notes already permanently deleted cannot be reconstructed.

Relational cleanup and Auth deletion share a PostgreSQL transaction. Avatar files are removed through the Storage API first because Auth can reject deletion while files are still owned by the account. Storage is not transactional: if the subsequent Auth deletion fails, the avatar may already be gone while the account and notes remain. Never manually delete `storage.objects` rows to work around this.

```bash
npm run test:account
# Requires local PostgreSQL binaries (initdb, pg_ctl, psql); uses a temporary isolated database.
npm run test:account:database
```

The database tests never connect to the configured Supabase project. They replay migrations against synthetic schemas and check cleanup, rollback, privacy, RLS, and trash/restore behavior. Browser/device visual checks and real Auth/Storage integration still need disposable accounts.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
