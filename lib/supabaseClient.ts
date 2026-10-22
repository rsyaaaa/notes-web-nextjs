import { createClient } from '@supabase/supabase-js'

const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const configuredAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

const isValidSupabaseUrl = (value: string | undefined): value is string => {
	if (!value) return false

	try {
		const parsedUrl = new URL(value)
		return (parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'http:') && Boolean(parsedUrl.hostname)
	} catch {
		return false
	}
}

const validSupabaseUrl = isValidSupabaseUrl(configuredUrl) ? configuredUrl : undefined
const validSupabaseAnonKey = validSupabaseUrl && configuredAnonKey ? configuredAnonKey : undefined

export const supabaseConfigReady = Boolean(validSupabaseUrl && validSupabaseAnonKey)

export const supabase = createClient(
	validSupabaseUrl ?? 'https://missing-config.supabase.co',
	validSupabaseAnonKey ?? 'missing-config-anon-key',
)