'use client'

import { useEffect, useState } from 'react'
import type { BugTicket } from '@/types/backoffice'

type HistoryGame = { id: string; created_at: string; variant: string }

export default function TicketsPage() {
  const [tickets, setTickets] = useState<BugTicket[]>([])
  const [games, setGames] = useState<HistoryGame[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [file, setFile] = useState<File | null>(null)

  async function load() {
    const [ticketResponse, historyResponse] = await Promise.all([fetch('/api/tickets'), fetch('/api/history')])
    if (ticketResponse.ok) setTickets((await ticketResponse.json()).data ?? [])
    if (historyResponse.ok) setGames((await historyResponse.json()).data ?? [])
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    setSubmitting(true)
    setMessage('')
    const form = new FormData(formElement)
    const response = await fetch('/api/tickets', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.get('title'), description: form.get('description'), reproductionSteps: form.get('reproductionSteps'),
        expectedBehavior: form.get('expectedBehavior'), actualBehavior: form.get('actualBehavior'), gameId: form.get('gameId') || null,
        route: window.location.pathname,
      }),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) { setMessage(result.error || 'Signalement impossible.'); setSubmitting(false); return }
    let attachmentFailed = false
    if (file) {
      const upload = new FormData(); upload.set('file', file)
      const uploadResponse = await fetch(`/api/tickets/${result.data.id}/attachment`, { method: 'POST', body: upload })
      attachmentFailed = !uploadResponse.ok
    }
    formElement.reset(); setFile(null); setSubmitting(false)
    setMessage(attachmentFailed
      ? 'Ticket créé, mais la capture n’a pas pu être ajoutée.'
      : 'Ticket créé. Merci pour votre aide !')
    await load()
  }

  return <div className="mx-auto max-w-5xl space-y-8 py-8">
    <div><h1 className="text-4xl font-bold">Signaler un bug</h1><p className="text-base-content/70">Décrivez précisément le problème et suivez son traitement.</p></div>
    <form onSubmit={submit} className="card bg-base-100 border border-base-300 shadow-xl"><div className="card-body grid gap-4 md:grid-cols-2">
      <label className="form-control md:col-span-2"><span className="label-text">Titre</span><input className="input input-bordered" name="title" minLength={5} maxLength={160} required /></label>
      <label className="form-control md:col-span-2"><span className="label-text">Description</span><textarea className="textarea textarea-bordered min-h-28" name="description" minLength={10} required /></label>
      <label className="form-control"><span className="label-text">Étapes de reproduction</span><textarea className="textarea textarea-bordered" name="reproductionSteps" /></label>
      <label className="form-control"><span className="label-text">Résultat observé</span><textarea className="textarea textarea-bordered" name="actualBehavior" /></label>
      <label className="form-control"><span className="label-text">Résultat attendu</span><textarea className="textarea textarea-bordered" name="expectedBehavior" /></label>
      <label className="form-control"><span className="label-text">Partie concernée</span><select className="select select-bordered" name="gameId"><option value="">Aucune</option>{games.map((game) => <option key={game.id} value={game.id}>{game.id} — {new Date(game.created_at).toLocaleDateString('fr-FR')}</option>)}</select></label>
      <label className="form-control md:col-span-2"><span className="label-text">Capture facultative (5 Mo max.)</span><input className="file-input file-input-bordered" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
      {message && <div className="alert md:col-span-2">{message}</div>}
      <button className="btn btn-primary md:col-span-2" disabled={submitting}>{submitting ? 'Envoi…' : 'Envoyer le signalement'}</button>
    </div></form>
    <section><h2 className="text-2xl font-bold mb-4">Mes tickets</h2>{loading ? <span className="loading loading-spinner" /> : tickets.length === 0 ? <p>Aucun ticket.</p> : <div className="space-y-3">{tickets.map((ticket) => <article key={ticket.id} className="card border border-base-300 bg-base-100"><div className="card-body py-4"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-bold">{ticket.title}</h3><span className="badge badge-outline">{ticket.status}</span></div><p className="text-sm text-base-content/60">{new Date(ticket.created_at).toLocaleString('fr-FR')}{ticket.game_id ? ` · partie ${ticket.game_id}` : ''}</p>{ticket.public_resolution && <p className="alert alert-success mt-2">{ticket.public_resolution}</p>}</div></article>)}</div>}</section>
  </div>
}
