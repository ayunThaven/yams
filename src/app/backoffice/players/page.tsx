'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import BackofficePageHeader from '@/components/backoffice/BackofficePageHeader'

type Player = { id: string; username: string; email?: string; level: number; parties_jouees: number; parties_gagnees: number }
export default function PlayersPage() {
  const [q, setQ] = useState(''); const [players, setPlayers] = useState<Player[]>([]); const [loading, setLoading] = useState(true)
  async function load(search = '') { setLoading(true); const response = await fetch(`/api/backoffice/players?q=${encodeURIComponent(search)}`); if (response.ok) setPlayers((await response.json()).data ?? []); setLoading(false) }
  useEffect(() => { void load() }, [])
  return <div><BackofficePageHeader eyebrow="Référentiel joueurs" title="Joueurs" description="Recherchez un profil, vérifiez son parcours puis intervenez avec une preuve et un motif." /><form className="bo-panel mb-6 flex flex-wrap gap-3 p-4" onSubmit={(event) => { event.preventDefault(); void load(q) }}><label className="min-w-60 flex-1"><span className="bo-label">Pseudo ou email</span><input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Ex. yams_master ou joueur@email.fr" className="bo-input" /></label><button className="bo-button-primary self-end" type="submit">Rechercher</button></form>{loading ? <div className="bo-panel p-10 text-center text-slate-400">Chargement des joueurs…</div> : <div className="bo-panel overflow-hidden"><div className="border-b border-slate-800 px-5 py-4 text-sm text-slate-400"><strong className="text-slate-200">{players.length}</strong> résultat{players.length > 1 ? 's' : ''}</div><div className="overflow-x-auto"><table className="bo-table"><thead><tr><th>Joueur</th><th>Email</th><th>Niveau</th><th>Parties</th><th>Victoires</th><th aria-label="Ouvrir" /></tr></thead><tbody>{players.map((player) => <tr key={player.id}><td className="font-semibold text-slate-100">{player.username}</td><td className="text-slate-400">{player.email || '—'}</td><td><span className="rounded-lg bg-slate-800 px-2 py-1 text-xs font-bold text-emerald-300">Niv. {player.level}</span></td><td>{player.parties_jouees}</td><td>{player.parties_gagnees}</td><td className="text-right"><Link className="text-sm font-semibold text-emerald-300 hover:text-emerald-200" href={`/backoffice/players/${player.id}`}>Ouvrir →</Link></td></tr>)}</tbody></table></div>{players.length === 0 && <p className="p-8 text-center text-slate-400">Aucun joueur ne correspond à cette recherche.</p>}</div>}</div>
}
