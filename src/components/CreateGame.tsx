'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { useSupabase } from './Providers'
import { useFlashMessage } from '@/contexts/FlashMessageContext'
import { createGame } from '@/lib/createGame'
import { GameVariant } from '@/types/game'
import { VARIANT_DESCRIPTIONS, VARIANT_NAMES } from '@/lib/variantLogic'
import { ChevronDownIcon, CloseIcon } from './icons/ClubIcons'

const variants: GameVariant[] = ['classic', 'descending', 'ascending']

export default function CreateGame({ beforeCreate, disabled = false }: { beforeCreate?: () => Promise<void>; disabled?: boolean } = {}) {
  const router = useRouter()
  const { isAnonymous } = useSupabase()
  const { showAchievement } = useFlashMessage()
  const [loading, setLoading] = useState(false)
  const [variantSheetOpen, setVariantSheetOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [visibility, setVisibility] = useState<'PRIVATE' | 'PUBLIC'>('PRIVATE')
  const [selected, setSelected] = useState<GameVariant>('classic')
  const [error, setError] = useState<string | null>(null)
  const [compactPickerOpen, setCompactPickerOpen] = useState(false)

  useEffect(() => setMounted(true), [])
  useEffect(() => {
    if (!variantSheetOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setVariantSheetOpen(false) }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', onKeyDown) }
  }, [variantSheetOpen])

  async function create() {
    if (isAnonymous && !beforeCreate) return router.push('/play')
    setLoading(true); setError(null)
    try {
      await beforeCreate?.()
      const result = await createGame(selected, visibility)
      if (result.error) { setError(result.error); setLoading(false); return }
      result.achievements.forEach(showAchievement)
      router.push(`/game/${result.id}`)
    } catch (err) { setError(err instanceof Error ? err.message : 'La partie n’a pas pu être créée. Réessayez.'); setLoading(false) }
  }

  const compactVariantOptions = variants.map((variant, index) => <label key={variant} className={`club-compact-variant ${selected === variant ? 'is-selected' : ''}`}>
    <input type="radio" name="compact-variant" value={variant} checked={selected === variant} onChange={() => setSelected(variant)}/>
    <span>0{index + 1}</span>
    <strong>{VARIANT_NAMES[variant]}</strong>
  </label>)

  const visibilityChoice = (name: string) => <fieldset className="club-visibility">
    <legend className="club-eyebrow">Qui peut rejoindre ?</legend>
    <div className="club-visibility-options">
      {([{ value: 'PRIVATE', title: 'Privée', detail: 'Avec un code' }, { value: 'PUBLIC', title: 'Publique', detail: 'Visible par tous' }] as const).map(option => <label key={option.value} className={`club-visibility-option ${visibility === option.value ? 'is-selected' : ''}`}>
        <input type="radio" name={name} value={option.value} checked={visibility === option.value} onChange={() => setVisibility(option.value)}/>
        <span><strong>{option.title}</strong><small>{option.detail}</small></span><i aria-hidden="true"/>
      </label>)}
    </div>
  </fieldset>

  return <>
    <div className="club-create-inline">
      <p className="club-eyebrow">Choisissez un mode de jeu</p>
      <button type="button" className="club-compact-select club-mobile-variant-trigger" onClick={() => setVariantSheetOpen(true)} aria-haspopup="dialog" aria-expanded={variantSheetOpen}>
        <span><small>Variante</small><strong>{VARIANT_NAMES[selected]}</strong></span><ChevronDownIcon/>
      </button>
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
      {visibilityChoice('inline-visibility')}
      {error && <p className="club-form-error" role="alert">{error}</p>}
      <button className="club-button club-button-primary" onClick={create} disabled={loading || disabled}>{loading ? 'Création…' : 'Créer la partie'}</button>
    </div>
    {mounted && variantSheetOpen && createPortal(<div className="club-dialog-layer" onMouseDown={() => setVariantSheetOpen(false)}>
      <section className="club-dialog" role="dialog" aria-modal="true" aria-labelledby="mobile-variant-title" onMouseDown={event => event.stopPropagation()}>
        <header><div><p className="club-eyebrow">Nouvelle partie</p><h2 id="mobile-variant-title">Choisissez une variante</h2></div><button type="button" className="club-icon-button" onClick={() => setVariantSheetOpen(false)} aria-label="Fermer"><CloseIcon/></button></header>
        <div className="club-variant-list">{variants.map((variant, index) => <label key={variant} className={`club-variant-option ${selected === variant ? 'is-selected' : ''}`}>
          <input type="radio" name="mobile-variant" value={variant} checked={selected === variant} onChange={() => { setSelected(variant); setVariantSheetOpen(false) }}/>
          <span className="club-variant-number">0{index + 1}</span><span><strong>{VARIANT_NAMES[variant]}</strong><small>{VARIANT_DESCRIPTIONS[variant]}</small></span><i/>
        </label>)}</div>
      </section>
    </div>, document.body)}
  </>
}
