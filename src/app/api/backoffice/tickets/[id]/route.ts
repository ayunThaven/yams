import { NextRequest, NextResponse } from 'next/server'
import { requireBackoffice, verifySameOrigin } from '@/lib/backofficeAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import type { BugTicketStatus, TicketPriority } from '@/types/backoffice'

const transitions: Record<BugTicketStatus, BugTicketStatus[]> = {
  new: ['confirmed', 'rejected'], confirmed: ['in_progress', 'resolved', 'rejected'], in_progress: ['resolved', 'rejected'], resolved: [], rejected: [],
}
const priorities: TicketPriority[] = ['low', 'normal', 'high', 'critical']

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireBackoffice(request); if (auth.response) return auth.response
  const { id } = await context.params; const supabase = createAdminClient(); if (!supabase) return NextResponse.json({ error: 'Service indisponible.' }, { status: 503 })
  const { data: ticket } = await supabase.from('bug_tickets').select('*, reporter:users(*), assignee:backoffice_users(id,email)').eq('id', id).maybeSingle()
  if (!ticket) return new NextResponse('Not Found', { status: 404 })
  const [{ data: attachment }, { data: result }, { data: actions }, { data: audit }, { data: team }] = await Promise.all([
    supabase.from('bug_ticket_attachments').select('*').eq('ticket_id', id).maybeSingle(),
    ticket.game_id ? supabase.from('game_results').select('*').eq('game_id', ticket.game_id).eq('user_id', ticket.reporter_user_id).maybeSingle() : Promise.resolve({ data: null }),
    ticket.game_id ? supabase.from('game_score_actions').select('*').eq('game_id', ticket.game_id).eq('user_id', ticket.reporter_user_id).order('created_at') : Promise.resolve({ data: [] }),
    supabase.from('backoffice_audit_logs').select('*').eq('target_type', 'ticket').eq('target_id', id).order('created_at'),
    supabase.from('backoffice_users').select('id,email').is('disabled_at', null).order('email'),
  ])
  let attachmentUrl = null
  if (attachment) { const { data } = await supabase.storage.from('bug-report-attachments').createSignedUrl(attachment.storage_path, 300); attachmentUrl = data?.signedUrl ?? null }
  return NextResponse.json({ data: { ticket, attachment: attachment ? { ...attachment, url: attachmentUrl } : null, result, actions, audit, team } }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireBackoffice(request); if (auth.response) return auth.response
  if (!verifySameOrigin(request)) return NextResponse.json({ error: 'Requête refusée.' }, { status: 403 })
  const { id } = await context.params; const body = await request.json().catch(() => ({})) as { status?: BugTicketStatus; priority?: TicketPriority; assignedTo?: string | null; internalNotes?: string; publicResolution?: string }
  const supabase = createAdminClient(); if (!supabase) return NextResponse.json({ error: 'Service indisponible.' }, { status: 503 })
  const { data: before } = await supabase.from('bug_tickets').select('*').eq('id', id).maybeSingle(); if (!before) return new NextResponse('Not Found', { status: 404 })
  const updates: Record<string, unknown> = {}
  if (body.status) { if (!transitions[before.status as BugTicketStatus].includes(body.status)) return NextResponse.json({ error: 'Transition de statut interdite.' }, { status: 400 }); updates.status = body.status; if (body.status === 'confirmed') updates.confirmed_at = new Date().toISOString(); if (body.status === 'resolved') updates.resolved_at = new Date().toISOString() }
  if (body.priority && priorities.includes(body.priority)) updates.priority = body.priority
  if ('assignedTo' in body) {
    if (body.assignedTo) {
      const { data: assignee } = await supabase.from('backoffice_users').select('id').eq('id', body.assignedTo).is('disabled_at', null).maybeSingle()
      if (!assignee) return NextResponse.json({ error: 'Opérateur invalide.' }, { status: 400 })
    }
    updates.assigned_to = body.assignedTo || null
  }
  if (typeof body.internalNotes === 'string') updates.internal_notes = body.internalNotes.slice(0, 20000)
  if (typeof body.publicResolution === 'string') updates.public_resolution = body.publicResolution.slice(0, 10000)
  const { data: after, error } = await supabase.from('bug_tickets').update(updates).eq('id', id).select('*').single()
  if (error) return NextResponse.json({ error: 'Mise à jour impossible.' }, { status: 400 })
  await supabase.from('backoffice_audit_logs').insert({ actor_id: auth.user.id, action: 'ticket.updated', target_type: 'ticket', target_id: id, before_data: before, after_data: after })
  return NextResponse.json({ data: after }, { headers: { 'Cache-Control': 'no-store' } })
}
