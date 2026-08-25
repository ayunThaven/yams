import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/authRequest'
import { createAdminClient } from '@/lib/supabase/admin'

const ALLOWED = new Map([['image/png', 'png'], ['image/jpeg', 'jpg'], ['image/webp', 'webp']])

function matchesImageSignature(type: string, bytes: Uint8Array) {
  if (type === 'image/png') return bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((value, index) => bytes[index] === value)
  if (type === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
  if (type === 'image/webp') return bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP'
  return false
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = requireAuth(request)
  if (auth.response) return auth.response
  const { id } = await context.params
  const supabase = createAdminClient()
  if (!supabase) return NextResponse.json({ error: 'Service indisponible.' }, { status: 503 })
  const { data: ticket } = await supabase.from('bug_tickets').select('id').eq('id', id).eq('reporter_user_id', auth.user.id).eq('status', 'new').maybeSingle()
  if (!ticket) return new NextResponse('Not Found', { status: 404 })
  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Capture manquante.' }, { status: 400 })
  const extension = ALLOWED.get(file.type)
  if (!extension || file.size <= 0 || file.size > 5 * 1024 * 1024) return NextResponse.json({ error: 'Capture invalide (PNG, JPEG ou WebP, 5 Mo maximum).' }, { status: 400 })
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (!matchesImageSignature(file.type, bytes)) return NextResponse.json({ error: 'Le contenu du fichier ne correspond pas à une image autorisée.' }, { status: 400 })
  const existing = await supabase.from('bug_ticket_attachments').select('id').eq('ticket_id', id).maybeSingle()
  if (existing.data) return NextResponse.json({ error: 'Une capture existe déjà.' }, { status: 409 })
  const path = `${auth.user.id}/${id}/${randomUUID()}.${extension}`
  const { error: uploadError } = await supabase.storage.from('bug-report-attachments').upload(path, bytes, { contentType: file.type, upsert: false })
  if (uploadError) return NextResponse.json({ error: 'Téléversement impossible.' }, { status: 500 })
  const { data, error } = await supabase.from('bug_ticket_attachments').insert({ ticket_id: id, storage_path: path, mime_type: file.type, size_bytes: file.size }).select('id').single()
  if (error) {
    await supabase.storage.from('bug-report-attachments').remove([path])
    return NextResponse.json({ error: 'Enregistrement impossible.' }, { status: 500 })
  }
  return NextResponse.json({ data }, { status: 201 })
}
