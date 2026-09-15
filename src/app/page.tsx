'use client'

import Link from 'next/link'
import { useSupabase } from '@/components/Providers'
import { DiceMonogram } from '@/components/BrandMark'
import { ArrowRightIcon } from '@/components/icons/ClubIcons'

const scoreRows = [['As', '3'], ['Brelan', '24'], ['Full', '25'], ['Yams', '—']]

export default function HomePage() {
  const { user } = useSupabase()
  return <div className="club-home">
    <section className="club-hero">
      <div className="club-hero-copy">
        <p className="club-eyebrow">Le club est ouvert</p>
        <h1>Les dés sont jetés.<br/><em>À vous de jouer.</em></h1>
        <p className="club-hero-lead">Retrouvez le plaisir d’une feuille de score, le frisson du dernier lancer et vos amis autour de la même table — où qu’ils soient.</p>
        <div className="club-hero-actions">
          <Link href={user ? '/dashboard' : '/register'} className="club-button club-button-primary">{user ? 'Entrer dans le Hall' : 'Prendre place'}<ArrowRightIcon className="h-5 w-5"/></Link>
          {!user && <Link href="/login" className="club-button club-button-secondary">J’ai déjà un compte</Link>}
        </div>
        <dl className="club-hero-facts"><div><dt>3</dt><dd>variantes</dd></div><div><dt>8</dt><dd>joueurs</dd></div><div><dt>13</dt><dd>tours décisifs</dd></div></dl>
      </div>
      <div className="club-table-preview" aria-label="Aperçu d’une partie de Yams">
        <div className="club-preview-top"><span>Table n° 24</span><span className="club-live-dot">En cours</span></div>
        <div className="club-preview-dice" aria-hidden="true">{[5, 2, 6, 6, 3].map((n, i) => <span key={i}>{n}</span>)}</div>
        <div className="club-preview-player"><DiceMonogram/><span><small>Au tour de</small><strong>Camille</strong></span><b>02:14</b></div>
        <div className="club-preview-sheet"><div className="club-preview-sheet-head"><span>Feuille de score</span><span>148 pts</span></div>{scoreRows.map(([name, score]) => <div key={name}><span>{name}</span><b>{score}</b></div>)}</div>
      </div>
    </section>
    <section className="club-home-steps">
      <header><p className="club-eyebrow">Une table, un code, une soirée</p><h2>Le classique, sans la paperasse.</h2></header>
      <ol><li><span>01</span><h3>Ouvrez une table</h3><p>Choisissez votre variante et invitez jusqu’à sept amis.</p></li><li><span>02</span><h3>Lancez ensemble</h3><p>Chaque tour est synchronisé en temps réel, sans installation.</p></li><li><span>03</span><h3>Entrez dans l’histoire</h3><p>Scores, séries et succès rejoignent votre carnet de joueur.</p></li></ol>
    </section>
  </div>
}
