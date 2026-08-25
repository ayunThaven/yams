import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/authRequest'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = requireAuth(request)
  if (auth.response) return auth.response
  const { id } = await context.params
  const supabase = createAdminClient()
  if (!supabase) return NextResponse.json({ error: 'Service indisponible.' }, { status: 503 })
  const { data } = await supabase.from('bug_tickets')
    .select('id, reporter_user_id, game_id, title, description, reproduction_steps, expected_behavior, actual_behavior, status, priority, public_resolution, confirmed_at, resolved_at, created_at, updated_at')
    .eq('id', id).eq('reporter_user_id', auth.user.id).maybeSingle()
  if (!data) return new NextResponse('Not Found', { status: 404 })
  const { data: attachment } = await supabase.from('bug_ticket_attachments').select('id, storage_path, mime_type, size_bytes').eq('ticket_id', id).maybeSingle()
  let attachmentUrl: string | null = null
  if (attachment) {
    const { data: signed } = await supabase.storage.from('bug-report-attachments').createSignedUrl(attachment.storage_path, 300)
    attachmentUrl = signed?.signedUrl ?? null
  }
  return NextResponse.json({ data: { ...data, attachment: attachment ? { id: attachment.id, mime_type: attachment.mime_type, size_bytes: attachment.size_bytes, url: attachmentUrl } : null } }, { headers: { 'Cache-Control': 'no-store' } })
}

