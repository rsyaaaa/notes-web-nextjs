import { createClient } from '@supabase/supabase-js'

export async function DELETE(request: Request) {
  const authorization = request.headers.get('authorization')
  const token = authorization?.match(/^Bearer ([^\s,]+)$/i)?.[1]
  if (!token) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !serviceKey) {
    return Response.json({ error: 'unavailable' }, { status: 503 })
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  const { data, error: authError } = await admin.auth.getUser(token)
  if (authError || !data?.user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const userId = data.user.id
  const requestUrl = new URL(request.url)
  const noticeId = requestUrl.searchParams.get('id')
  const noteId = requestUrl.searchParams.get('note_id')

  if (!noticeId && !noteId) {
    return Response.json({ error: 'missing_params' }, { status: 400 })
  }

  if (noticeId) {
    await admin
      .from('note_deletion_notices')
      .delete()
      .eq('id', noticeId)
      .eq('user_id', userId)
  } else if (noteId) {
    await admin
      .from('note_deletion_notices')
      .delete()
      .eq('note_id', noteId)
      .eq('user_id', userId)
  }

  if (noteId) {
    await admin
      .from('note_members')
      .delete()
      .eq('note_id', noteId)
      .eq('user_id', userId)
  }

  return Response.json({ success: true })
}

