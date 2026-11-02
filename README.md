# Notes Web Online

> **Notes Web Online** adalah aplikasi pencatatan digital modern berbasis cloud (*cloud-based online notes*) yang dirancang untuk menyimpan ide, catatan harian, rencana, dan pemikiran penting secara terpusat, aman, dan instan.
> 
> Tampilan dan antarmuka aplikasi ini **sangat terinspirasi oleh filosofi desain Apple (Apple Notes & Apple Design System)** — mengedepankan kesederhanaan, tipografi yang elegan, nuansa *frosted glass/blur*, kartu catatan adaptif, serta transisi animasi halus (*fluid motion*) untuk pengalaman pengguna yang nyaman dan berkelas.

---

## 🌟 Daftar Fitur

Berikut adalah daftar lengkap fitur yang tersedia di aplikasi:

### 📱 Fitur Utama (Free)

| Fitur | Status | Keterangan |
|---|:---:|---|
| **Login dengan Google** | ✅ | Autentikasi cepat, aman, dan tanpa repot menggunakan Google OAuth via Supabase Auth. |
| **Ubah Warna Accent** | ✅ | Personalisasi kartu catatan dengan beragam palet warna pastel khas tema Apple. |
| **Pin Catatan** | ✅ | Sematkan catatan penting agar selalu tampil di urutan paling atas beranda (hingga 3 catatan untuk akun gratis). |
| **Riwayat Waktu (Created & Edited)** | ✅ | Menampilkan waktu catatan dibuat dan terakhir kali diedit dalam format 24 jam dengan fitur interaktif klik/toggle. |
| **UI & Animasi Menarik** | ✅ | Efek transisi halus pada modal, drawer, popover, serta animasi kartu catatan menggunakan Apple Motion System. |
| **Autosave Cerdas** | ✅ | Catatan tersimpan secara otomatis di latar belakang saat pengguna mengetik tanpa perlu menekan tombol simpan manual. |
| **Folder Sampah (Trash Bin)** | ✅ | Menyimpan catatan yang dibuang sementara dengan opsi pemulihan (*restore*) atau penghapusan permanen. |
| **Tema Light Mode / Dark Mode** | ✅ | Dukungan tampilan mode terang dan gelap adaptif yang nyaman di mata kapan pun. |
| **Mobile Responsive** | ✅ | Tata letak adaptif yang dioptimalkan untuk berbagai ukuran layar smartphone, tablet, maupun desktop. |
| **Bahasa Indonesia & Inggris** | ✅ | Dukungan dwi-bahasa (Indonesia & English) yang tersimpan langsung pada profil akun pengguna. |
| **Dashboard User Admin (Role God)** | ✅ | Panel khusus administrator untuk memantau status pengguna, verifikasi akun, dan kontrol sistem. |
| **Pencarian Catatan (Search Bar)** | ✅ | Fitur pencarian instan untuk menemukan catatan berdasarkan kata kunci judul maupun isi konten. |

---

### 💎 Fitur Premium (Premium Features)

| Fitur Premium | Status | Keterangan |
|---|:---:|---|
| **Group Edit (Kolaborasi Real-Time)** | ✅ | Kolaborasi multipengguna secara simultan pada satu catatan bersama seperti Google Docs. |
| **Pin Catatan Tanpa Batas** | ✅ | Bebas menyematkan lebih dari 3 catatan prioritas di beranda utama tanpa batasan. |
| **Folder Catatan Kustom** | ✅ | Mengelompokkan, mengkategorikan, dan memfilter catatan ke dalam folder-folder khusus. |

---

## 📁 Struktur Folder Proyek

Proyek ini dibangun menggunakan **Next.js App Router**, **React 19**, **Tailwind CSS v4**, dan **Supabase**:

```text
notes-nextjs/
├── app/                              # Next.js App Router (Halaman, Layout, dan API)
│   ├── api/                          # Route Handlers Backend
│   │   ├── account/                  # Endpoint verifikasi & penghapusan akun permanen
│   │   ├── notices/                  # Endpoint notifikasi penghapusan catatan bersama
│   │   └── rolegod/                  # Endpoint API khusus panel admin Role God
│   ├── notes/                        # Halaman Editor Catatan
│   │   ├── [id]/page.tsx             # Halaman baca & edit catatan (Real-time editor)
│   │   └── new/page.tsx              # Halaman pembuatan catatan baru
│   ├── globals.css                   # Konfigurasi Tailwind CSS v4 & variabel animasi Apple
│   ├── layout.tsx                    # Root layout HTML, font Geist, metadata & i18n provider
│   └── page.tsx                      # Beranda utama, kartu catatan, filter folder, & login
├── components/                       # Komponen UI Reusable
│   ├── AppleNoteLoader.tsx           # Animasi loading indikator khas Apple
│   ├── ApplicationSettings.tsx      # Modal pengaturan bahasa aplikasi
│   ├── DashboardNotes.tsx            # Komponen tampilan alternatif dashboard
│   ├── DeleteAccountDialog.tsx      # Dialog interaktif penghapusan akun dengan challenge
│   ├── DeletedNoteCard.tsx           # Kartu pemberitahuan catatan bersama yang telah dihapus
│   ├── LanguageProvider.tsx          # Context provider sistem multi-bahasa
│   ├── NewNoteButton.tsx             # Tombol pembuatan catatan cepat
│   ├── PageTransition.tsx            # Wrapper transisi halaman berbasis React ViewTransition
│   └── RoleGodDashboard.tsx          # Komponen dashboard manajemen administrator
├── lib/                              # Utilitas, Helper, Klien, dan Tipe Data
│   ├── delete-account-client.ts      # Logika klien untuk proses penghapusan akun
│   ├── i18n-home.ts / i18n-notes.ts  # Kamus terjemahan Bahasa Indonesia & Inggris
│   ├── new-note-folder.ts            # Helper validasi konteks folder catatan
│   ├── supabaseClient.ts             # Inisialisasi Supabase client (Browser & SSR)
│   ├── types.ts                      # Interface & definisi tipe TypeScript data model
│   └── useAnimatedPresence.ts        # Hook animasi transisi Apple enter/exit untuk modal
├── public/                           # Aset statis & logo icon SVG
├── supabase/                         # Konfigurasi & Migrasi Database
│   └── migrations/                   # File skema SQL, RLS, functions, dan triggers PostgreSQL
└── tests/                            # Pengujian Otomatis (Node.js test runner)
    ├── account-*.test.mjs            # Pengujian flow penghapusan akun & integrasi database
    ├── language.test.mjs             # Pengujian isolasi sesi & kelengkapan kamus i18n
    ├── motion.test.mjs               # Pengujian siklus hidup animasi & reduced-motion
    └── new-note-folder.test.mjs      # Pengujian fungsionalitas pewarisan folder catatan
```

---

## 🗄️ Struktur Database (Supabase PostgreSQL)

Aplikasi ini menggunakan **PostgreSQL** yang dihosting di **Supabase** dengan keamanan berbasis **Row Level Security (RLS)** dan sinkronisasi real-time via `supabase_realtime`.

### 1. Tabel `public.notes`
Menyimpan seluruh data dokumen catatan pengguna.

| Kolom | Tipe Data | Keterangan |
|---|---|---|
| `id` | `bigint` (PK) | ID unik catatan (auto increment / generated identity). |
| `user_id` | `uuid` (FK) | ID pengguna pemilik catatan (relasi ke `auth.users.id`). |
| `title` | `text` | Judul catatan. |
| `content` | `text` | Isi teks catatan. |
| `accent_color` | `text` | Kode warna latar belakang aksen catatan (default: `#ffffff`). |
| `folder_id` | `bigint` (FK, Nullable) | ID folder tempat catatan bernaung (relasi ke `public.note_folders.id`). |
| `is_pinned` | `boolean` | Status apakah catatan disematkan di bagian atas. |
| `is_trashed` | `boolean` | Menandakan apakah catatan berada di dalam tong sampah. |
| `created_at` | `timestamptz` | Waktu catatan pertama kali dibuat. |
| `updated_at` | `timestamptz` | Waktu catatan terakhir kali diedit. |

---

### 2. Tabel `public.profiles`
Menyimpan profil pengguna yang disinkronkan otomatis dari `auth.users` via trigger.

| Kolom | Tipe Data | Keterangan |
|---|---|---|
| `id` | `uuid` (PK) | ID pengguna (relasi ke `auth.users.id` on delete cascade). |
| `full_name` | `text` | Nama lengkap pengguna dari akun Google/OAuth. |
| `avatar_url` | `text` (Nullable) | URL foto profil pengguna. |
| `plan` | `text` | Paket langganan: `'free'` atau `'premium'`. |
| `premium_expires_at`| `timestamptz` (Nullable) | Tanggal berakhir masa aktif paket Premium. |
| `created_at` | `timestamptz` | Waktu pendaftaran akun. |
| `updated_at` | `timestamptz` | Waktu pembaruan profil terakhir. |

---

### 3. Tabel `public.note_folders`
Menyimpan folder-folder pengelompokan catatan (Fitur Premium).

| Kolom | Tipe Data | Keterangan |
|---|---|---|
| `id` | `bigint` (PK) | ID unik folder catatan. |
| `user_id` | `uuid` (FK) | ID pengguna pemilik folder (relasi ke `auth.users.id`). |
| `name` | `text` | Nama folder (panjang 1–80 karakter, unik per user). |
| `created_at` | `timestamptz` | Waktu pembuatan folder. |

---

### 4. Tabel `public.note_members`
Menyimpan daftar kolaborator pada catatan bersama (*Group Collaboration*).

| Kolom | Tipe Data | Keterangan |
|---|---|---|
| `note_id` | `bigint` (PK, FK) | ID catatan yang dikolaborasikan (relasi ke `public.notes.id`). |
| `user_id` | `uuid` (PK, FK) | ID kolaborator yang memiliki akses (relasi ke `auth.users.id`). |
| `invited_by` | `uuid` (FK) | ID pengguna yang mengundang ke kolaborasi. |
| `created_at` | `timestamptz` | Waktu bergabung dalam catatan bersama. |

---

### 5. Tabel `public.note_deletion_notices`
Mencatat informasi penghapusan catatan bersama agar kolaborator mendapatkan pemberitahuan ketika catatan dipindahkan ke tong sampah atau dihapus oleh pemiliknya.

| Kolom | Tipe Data | Keterangan |
|---|---|---|
| `id` | `uuid` (PK) | ID unik notifikasi penghapusan. |
| `note_id` | `bigint` | ID catatan yang dihapus/dibuang. |
| `user_id` | `uuid` (FK) | ID penerima notifikasi (kolaborator). |
| `deleted_at` | `timestamptz` | Waktu pencatatan notifikasi. |

---

## 🚀 Panduan Instalasi & Menjalankan Proyek

Ikuti langkah-langkah di bawah ini untuk menjalankan proyek di komputer lokal:

### 1. Prasyarat Sistem
- **Node.js**: Versi 18.18 atau lebih tinggi (disarankan Node.js 20+ LTS).
- **NPM / PNPM / Yarn**: Pengelola paket bawaan Node.js.
- **Akun Supabase**: Proyek Supabase aktif ([supabase.com](https://supabase.com)).

---

### 2. Kloning Repositori & Instal Dependensi

```bash
# 1. Kloning repositori
git clone https://github.com/username/notes-nextjs.git

# 2. Masuk ke direktori proyek
cd notes-nextjs

# 3. Instal semua paket dependensi
npm install
```

---

### 3. Konfigurasi Environment Variables

Salin file template `.env.example` menjadi `.env.local`:

```bash
cp .env.example .env.local
```

Buka file `.env.local` dan isi nilainya sesuai kredensial dari **Supabase Dashboard** (`Project Settings > API`):

```env
# URL API Supabase proyek Anda
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co

# Kunci API Anon / Public Supabase (aman diakses browser)
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Kunci Rahasia Service Role (wajib untuk operasi server-side / Role God / penghapusan akun)
# JANGAN PERNAH menyertakan prefix NEXT_PUBLIC_ pada kunci ini!
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

### 4. Eksekusi Migrasi Database di Supabase

1. Buka dashboard proyek Supabase Anda.
2. Masuk ke menu **SQL Editor**.
3. Jalankan file migrasi SQL yang berada di folder `supabase/migrations/` secara berurutan:
   - `20261022000100_premium_notes_features.sql` (Inisialisasi tabel profiles, note_folders, note_members, function, dan RLS)
   - `20261022000200_guard_shared_note_management.sql` s/d `20261022000800_fix_notes_select_policy.sql`
   - `20261029000100_account_deletion_and_note_notices.sql` (Tabel notifikasi dan trigger penghapusan akun)
   
*(Atau gunakan [Supabase CLI](https://supabase.com/docs/guides/cli) dengan perintah `supabase db push` jika proyek tertaut).*

---

### 5. Konfigurasi Google OAuth di Supabase Auth

1. Buka **Supabase Dashboard** > **Authentication** > **Providers** > pilih **Google**.
2. Aktifkan opsi Google Provider.
3. Masukkan **Client ID** dan **Client Secret** dari [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
4. Tambahkan URL redirect Supabase (`https://<project-ref>.supabase.co/auth/v1/callback`) ke dalam *Authorized Redirect URIs* di Google Cloud Console.
5. Pada **URL Configuration** di Supabase Auth, tambahkan `http://localhost:3000` ke daftar *Redirect URLs*.

---

### 6. Jalankan Server Development

```bash
npm run dev
```

Buka peramban Anda dan akses [http://localhost:3000](http://localhost:3000). Aplikasi siap digunakan!

---

### 7. Menjalankan Rangkaian Pengujian (Testing)

Proyek ini dilengkapi dengan rangkaian automated test untuk memverifikasi fungsionalitas bahasa, animasi motion, folder catatan, dan keamanan penghapusan akun:

```bash
# Pengujian kamus bahasa & isolasi sesi
npm run test:language

# Pengujian alur pembuatan dan pewarisan folder catatan
npm run test:folders

# Pengujian durasi transisi motion & reduced-motion
npm run test:motion

# Pengujian flow API dan dialog penghapusan akun
npm run test:account

# Pengujian migrasi database PostgreSQL (memerlukan local PostgreSQL binaries)
npm run test:account:database
```

---

## 📄 Lisensi

Proyek ini didistribusikan di bawah lisensi **MIT License**. Silakan gunakan dan kembangkan sesuai kebutuhan.
