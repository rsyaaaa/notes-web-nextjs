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

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
