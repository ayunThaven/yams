'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { useSupabase } from './Providers'
import { useFlashMessage } from '@/contexts/FlashMessageContext'
import { createGame } from '@/lib/createGame'
import { GameVariant } from '@/types/game'
import { VARIANT_DESCRIPTIONS, VARIANT_NAMES } from '@/lib/variantLogic'
import { ChevronDownIcon, CloseIcon, PlusCircleIcon } from './icons/ClubIcons'

const variants: GameVariant[] = ['classic', 'descending', 'ascending']

export default function CreateGame() {
  const router = useRouter()
  const { user } = useSupabase()
  const { showAchievement } = useFlashMessage()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<GameVariant>('classic')
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [compactPickerOpen, setCompactPickerOpen] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [open])

  async function create() {
    if (!user) return router.push('/login')
    setLoading(true); setError(null)
    try {
      const result = await createGame(selected)
      if (result.error) { setError(result.error); setLoading(false); return }
      result.achievements.forEach(showAchievement)
      setOpen(false)
      router.push(`/game/${result.id}`)
    } catch { setError('La partie n’a pas pu être créée. Réessayez.'); setLoading(false) }
  }

  const compactVariantOptions = variants.map((variant, index) => <label key={variant} className={`club-compact-variant ${selected === variant ? 'is-selected' : ''}`}>
    <input type="radio" name="compact-variant" value={variant} checked={selected === variant} onChange={() => setSelected(variant)}/>
    <span>0{index + 1}</span>
    <strong>{VARIANT_NAMES[variant]}</strong>
  </label>)

  const dialog = open && <div className="club-dialog-layer" role="presentation" onMouseDown={() => !loading && setOpen(false)}>
      <section className="club-dialog" role="dialog" aria-modal="true" aria-labelledby="variant-title" onMouseDown={e => e.stopPropagation()}>
        <header><div><p className="club-eyebrow">Nouvelle partie</p><h2 id="variant-title">Choisissez un mode de jeu</h2></div><button className="club-icon-button" onClick={() => setOpen(false)} aria-label="Fermer"><CloseIcon/></button></header>
        {error && <p className="club-form-error" role="alert">{error}</p>}
        <div className="club-variant-list">{variants.map((variant, index) => <label key={variant} className={`club-variant-option ${selected === variant ? 'is-selected' : ''}`}>
          <input type="radio" name="variant" value={variant} checked={selected === variant} onChange={() => setSelected(variant)}/>
          <span className="club-variant-number">0{index + 1}</span><span><strong>{VARIANT_NAMES[variant]}</strong><small>{VARIANT_DESCRIPTIONS[variant]}</small></span><i/>
        </label>)}</div>
        <footer><button className="club-button club-button-secondary" onClick={() => setOpen(false)} disabled={loading}>Annuler</button><button className="club-button club-button-primary" onClick={create} disabled={loading}>{loading ? 'Création…' : 'Créer la partie'}</button></footer>
      </section>
    </div>

  return <>
    <button className="club-button club-button-primary club-create-trigger" onClick={() => user ? setOpen(true) : router.push('/login')}><PlusCircleIcon className="h-5 w-5"/>Choisir la variante</button>
    <div className="club-create-inline">
      <p className="club-eyebrow">Choisissez un mode de jeu</p>
      <div className="club-compact-variants" data-variant-count={variants.length} data-variant-layout={variants.length > 4 ? 'picker' : undefined} role="radiogroup" aria-label="Choisissez la variante">{compactVariantOptions}</div>
      <div className={`club-compact-picker ${compactPickerOpen ? 'is-open' : ''}`}>
        <button type="button" className="club-compact-select" aria-expanded={compactPickerOpen} aria-haspopup="listbox" aria-controls="compact-variant-list" onClick={() => setCompactPickerOpen(value => !value)}>
          <span><small>Variante</small><strong>{VARIANT_NAMES[selected]}</strong></span><ChevronDownIcon/>
        </button>
        {compactPickerOpen && <div id="compact-variant-list" className="club-compact-select-menu" role="listbox" aria-label="Variantes disponibles">
          {variants.map((variant, index) => <button type="button" key={variant} role="option" aria-selected={selected === variant} className={selected === variant ? 'is-selected' : ''} onClick={() => { setSelected(variant); setCompactPickerOpen(false) }}>
            <span className="club-variant-number">0{index + 1}</span><span><strong>{VARIANT_NAMES[variant]}</strong><small>{VARIANT_DESCRIPTIONS[variant]}</small></span><i aria-hidden="true"/>
          </button>)}
        </div>}
      </div>
      {error && <p className="club-form-error" role="alert">{error}</p>}
      <button className="club-button club-button-primary" onClick={create} disabled={loading}>{loading ? 'Création…' : 'Créer la partie'}</button>
    </div>
    {mounted && dialog ? createPortal(dialog, document.body) : null}
  </>
}
