import { homeTranslations } from './i18n-home'
import { noteTranslations } from './i18n-notes'
import { deletionTranslations } from './i18n-deletion'

export type Language = 'id' | 'en'
export type TranslationValues = Record<string, string | number>

export const languageLocales: Record<Language, string> = {
  id: 'id-ID',
  en: 'en-US',
}

// Normalize legacy labels without changing note content or user-defined names.
const indonesianLabels: Record<string, string> = {
  'New Notes': 'Catatan Baru',
  'New Note': 'Catatan Baru',
  'Free Plan': 'Paket Gratis',
  'Premium Plan': 'Paket Premium',
  'Autosave complete': 'Tersimpan otomatis',
  'Memuat Notes...': 'Memuat Catatan...',
  'Gak ada isi teks...': 'Belum ada isi catatan...',
  'Notes ini adalah shared dari pembuat kolaborasi': 'Catatan ini dibagikan oleh pemiliknya',
  'Paket Free memiliki batas 3 catatan pin. Premium membuka pin tanpa batas.': 'Paket Gratis memiliki batas 3 catatan yang disematkan. Premium membuka sematan tanpa batas.',
  'Dipin': 'Disematkan',
  'Pin Catatan': 'Sematkan Catatan',
  'Pin catatan': 'Sematkan catatan',
  'Lepas Pin': 'Lepas Sematan',
  'Lepas pin catatan': 'Lepas sematan catatan',
  'Pin catatan tanpa batas': 'Sematkan catatan tanpa batas',
  'Sembunyikan password': 'Sembunyikan kata sandi',
  'Tampilkan password': 'Tampilkan kata sandi',
  'Akun ini masuk dengan Google. Penggantian password dikelola melalui akun Google.': 'Akun ini masuk dengan Google. Penggantian kata sandi dikelola melalui akun Google.',
}

export const englishTranslations: Record<string, string> = {
  ...noteTranslations,
  ...homeTranslations,
  ...deletionTranslations,
  'New Notes': 'New Note',
  'Autosave complete': 'Saved automatically',
  'Buang': 'Move to Trash',
  'Keluar': 'Sign Out',
  'Kolaborator': 'Collaborators',
  'Pengaturan Aplikasi': 'Application Settings',
  'Atur bahasa tampilan aplikasi untuk akunmu.': 'Choose the display language for your account.',
  'Bahasa Aplikasi': 'Application Language',
  'Pilihan bahasa tersimpan di akun dan digunakan saat kamu masuk di perangkat lain.': 'Your language preference is saved to your account and used when you sign in on other devices.',
  'Simpan Perubahan': 'Save Changes',
  'Bahasa aplikasi berhasil disimpan.': 'Application language saved successfully.',
  'Bahasa gagal disimpan. Periksa koneksi lalu coba lagi.': 'Could not save your language. Check your connection and try again.',
  'Masuk kembali untuk menyimpan pengaturan bahasa.': 'Sign in again to save your language preference.',
  'Tutup pengaturan aplikasi': 'Close application settings',
  'Bahasa tidak didukung.': 'Unsupported language.',
  'Memuat preferensi akun...': 'Loading account preferences...',
  'Notes — Ruang tenang untuk semua idemu': 'Notes — A quiet space for all your ideas',
}

export function isLanguage(value: unknown): value is Language {
  return value === 'id' || value === 'en'
}

export function getAccountLanguage(metadata?: Record<string, unknown> | null): Language {
  return isLanguage(metadata?.language) ? metadata.language : 'id'
}

export function translate(language: Language, source: string, values: TranslationValues = {}): string {
  const text = language === 'en'
    ? englishTranslations[source] ?? source
    : indonesianLabels[source] ?? source

  // Replacement callbacks preserve literal dollar signs and never translate user data.
  return text.replace(/\{(\w+)\}/g, (placeholder, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : placeholder,
  )
}
