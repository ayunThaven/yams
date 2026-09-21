'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useSupabase } from './Providers'
import type { Achievement, AchievementRarity } from '@/types/achievement'
import { CloseIcon, ChevronRightIcon } from './icons/ClubIcons'

type AchievementWithStatus = { id: string; achievement: Achievement; unlocked_at: string | null }
type Preview = Achievement & { unlocked: boolean; unlockedAt: string | null }

const rarityLabel: Record<AchievementRarity, string> = {
  Bronze: 'Bronze', Silver: 'Argent', Gold: 'Or', Crystal: 'Cristal',
}

function AchievementMedal({ item, onOpen, compact = false }: { item: AchievementWithStatus; onOpen: (preview: Preview) => void; compact?: boolean }) {
  const achievement = item.achievement
  const unlocked = Boolean(item.unlocked_at)
  const hidden = !unlocked && achievement.rarity === 'Crystal'
  return <button type="button" className={`club-achievement-medal ${unlocked ? 'is-unlocked' : 'is-locked'} ${compact ? 'is-compact' : ''}`} onClick={() => onOpen({ ...achievement, unlocked, unlockedAt: item.unlocked_at })}>
    <span className="club-medal-art"><Image src={achievement.image_path} alt="" width={96} height={96}/></span>
    {!compact && <span className="club-medal-copy"><strong>{hidden ? 'Mystère' : achievement.name}</strong><small>{unlocked ? rarityLabel[achievement.rarity] : 'À découvrir'}</small></span>}
  </button>
}

export default function RecentAchievements() {
  const { userProfile } = useSupabase()
  const [items, setItems] = useState<AchievementWithStatus[]>([])
  const [allItems, setAllItems] = useState<AchievementWithStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingCollection, setLoadingCollection] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [collectionOpen, setCollectionOpen] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(null)

  useEffect(() => {
    if (!userProfile?.id) { setLoading(false); return }
    fetch(`/api/users/${userProfile.id}/achievements`)
      .then(async response => {
        const json = await response.json()
        if (!response.ok) throw new Error(json.error || 'Chargement impossible.')
        setItems(json.data as AchievementWithStatus[])
      })
      .catch(error => setError(error instanceof Error ? error.message : 'Chargement impossible.'))
      .finally(() => setLoading(false))
  }, [userProfile?.id])

  useEffect(() => {
    if (!collectionOpen) return
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = oldOverflow }
  }, [collectionOpen])

  async function openCollection() {
    setCollectionOpen(true)
    if (!userProfile?.id || allItems.length) return
    setLoadingCollection(true); setError(null)
    try {
      const response = await fetch(`/api/users/${userProfile.id}/achievements?all=1`)
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Chargement impossible.')
      setAllItems(json.data as AchievementWithStatus[])
    } catch (error) { setError(error instanceof Error ? error.message : 'Chargement impossible.') }
    finally { setLoadingCollection(false) }
  }

  if (!userProfile) return null
  const unlockedCount = allItems.filter(item => item.unlocked_at).length

  return <section className="club-achievements-panel">
    <header className="club-achievements-header"><div><p className="club-eyebrow">Cabinet des trophées</p><h2>Vos derniers succès</h2></div><button onClick={openCollection} className="club-text-action">Voir la collection <ChevronRightIcon/></button></header>
    {loading && <div className="club-achievements-state"><span className="loading loading-spinner"/>Chargement de vos succès…</div>}
    {!loading && error && <p className="club-form-error">{error}</p>}
    {!loading && !error && items.length === 0 && <div className="club-achievements-empty"><span>Votre vitrine est encore vide.</span><small>Les premières médailles viendront avec vos parties.</small></div>}
    {!loading && !error && items.length > 0 && <div className="club-achievement-strip">{items.slice(0, 5).map(item => <AchievementMedal key={item.id} item={item} onOpen={setPreview} compact/>)}</div>}

    {collectionOpen && <div className="club-dialog-layer" role="presentation" onMouseDown={() => setCollectionOpen(false)}>
      <section className="club-collection-dialog" role="dialog" aria-modal="true" aria-labelledby="collection-title" onMouseDown={event => event.stopPropagation()}>
        <header><div><p className="club-eyebrow">Cabinet des trophées</p><h2 id="collection-title">Votre collection</h2><p>{loadingCollection ? 'Inventaire en cours…' : `${unlockedCount} succès obtenus sur ${allItems.length || '—'}`}</p></div><button className="club-icon-button" onClick={() => setCollectionOpen(false)} aria-label="Fermer"><CloseIcon/></button></header>
        {loadingCollection && <div className="club-achievements-state"><span className="loading loading-spinner"/>Ouverture de la collection…</div>}
        {!loadingCollection && error && <p className="club-form-error">{error}</p>}
        {!loadingCollection && !error && <div className="club-collection-grid">{allItems.map(item => <AchievementMedal key={item.id} item={item} onOpen={setPreview}/>)}</div>}
      </section>
    </div>}

    {preview && <div className="club-dialog-layer club-achievement-detail-layer" role="presentation" onMouseDown={() => setPreview(null)}>
      <section className="club-achievement-detail" role="dialog" aria-modal="true" aria-labelledby="achievement-title" onMouseDown={event => event.stopPropagation()}>
        <button className="club-icon-button club-detail-close" onClick={() => setPreview(null)} aria-label="Fermer"><CloseIcon/></button>
        <div className={`club-detail-medal ${preview.unlocked ? 'is-unlocked' : 'is-locked'}`}><Image src={preview.image_path} alt="" width={260} height={260}/></div>
        <p className="club-eyebrow">{preview.unlocked ? rarityLabel[preview.rarity] : 'Succès à découvrir'}</p>
        <h2 id="achievement-title">{!preview.unlocked && preview.rarity === 'Crystal' ? 'Mystère' : preview.name}</h2>
        <p>{!preview.unlocked && preview.rarity === 'Crystal' ? 'Continuez à jouer pour révéler cette médaille.' : preview.description}</p>
        {preview.unlockedAt && <small>Obtenu le {new Date(preview.unlockedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</small>}
      </section>
    </div>}
  </section>
}
