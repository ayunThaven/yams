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
        <p className="club-eyebrow">Yams en ligne</p>
        <h1>Les dés sont jetés.<br/><em>À vous de jouer.</em></h1>
        <p className="club-hero-lead">Jouez au Yams avec vos proches, en ligne et en temps réel.</p>
        <div className="club-hero-actions">
          <Link href={user ? '/dashboard' : '/register'} className="club-button club-button-primary">{user ? 'Accéder à l’accueil' : 'Créer un compte'}<ArrowRightIcon className="h-5 w-5"/></Link>
          {!user && <Link href="/login" className="club-button club-button-secondary">J’ai déjà un compte</Link>}
        </div>
        <dl className="club-hero-facts"><div><dt>3</dt><dd>variantes</dd></div><div><dt>8</dt><dd>joueurs</dd></div><div><dt>13</dt><dd>tours décisifs</dd></div></dl>
      </div>
      <div className="club-table-preview" aria-label="Aperçu d’une partie de Yams">
        <div className="club-preview-top"><span>Partie n° 24</span><span className="club-live-dot">En cours</span></div>
        <div className="club-preview-dice" aria-hidden="true">{[5, 2, 6, 6, 3].map((n, i) => <span key={i}>{n}</span>)}</div>
        <div className="club-preview-player"><DiceMonogram/><span><small>Au tour de</small><strong>Camille</strong></span><b>02:14</b></div>
        <div className="club-preview-sheet"><div className="club-preview-sheet-head"><span>Feuille de score</span><span>148 pts</span></div>{scoreRows.map(([name, score]) => <div key={name}><span>{name}</span><b>{score}</b></div>)}</div>
      </div>
    </section>
    <section className="club-home-steps">
      <header><p className="club-eyebrow">Simple et rapide</p><h2>Jouez sans installation.</h2></header>
      <ol><li><span>01</span><h3>Créez une partie</h3><p>Choisissez un mode et invitez jusqu’à sept amis.</p></li><li><span>02</span><h3>Partagez le code</h3><p>Chaque tour est synchronisé en temps réel.</p></li><li><span>03</span><h3>Suivez votre progression</h3><p>Retrouvez vos scores, vos séries et vos succès.</p></li></ol>
    </section>
  </div>
}
