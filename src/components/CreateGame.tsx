'use client'

import { useRouter } from 'next/navigation'
import { useSupabase } from '@/components/Providers'
import { useState } from 'react'
import { GameVariant } from '@/types/game'
import { VARIANT_NAMES, VARIANT_DESCRIPTIONS } from '@/lib/variantLogic'
import PlusIcon from './icons/PlusIcon'
import { createGame } from '@/lib/createGame'

export default function CreateGame() {
  const router = useRouter()
  const { user } = useSupabase()
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [selectedVariant, setSelectedVariant] = useState<GameVariant>('classic')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!user) {
      return router.push('/login')
    }

    setLoading(true)
    setErrorMessage(null)
    
    // Petit délai pour garantir que React affiche le loading avant l'opération async
    await new Promise(resolve => setTimeout(resolve, 50))
    
    try {
      const { id, error } = await createGame(selectedVariant)

      if (error) {
        console.error('[CREATE] ❌ Erreur API:', error)
        setLoading(false)
        setErrorMessage(error || 'Erreur inconnue')
      } else {
        setShowModal(false)
        await new Promise(resolve => setTimeout(resolve, 200))
        router.push(`/game/${id}`)
      }
    } catch (err) {
      console.error('[CREATE] ❌ Exception:', err)
      setLoading(false)
      setErrorMessage('Erreur inattendue lors de la création de la partie')
    }
  }

  const openModal = () => {
    if (!user) {
      return router.push('/login')
    }
    setShowModal(true)
  }

  return (
    <>
      <button
        onClick={openModal}
        className="btn btn-primary"
      >
        <PlusIcon className="w-4 h-4" />
        <span>Nouvelle partie</span>
      </button>

      {showModal && (
        <div className="modal modal-open">
          <div className="modal-box card-bordered max-w-2xl">
            <h3 className="font-bold text-2xl mb-6">Choisir une variante</h3>
            {errorMessage && <div className="alert alert-error mb-4" role="alert">{errorMessage}</div>}
            
            <div className="space-y-4">
              {/* Variante Classique */}
              <div
                onClick={() => setSelectedVariant('classic')}
                className={`card glass cursor-pointer transition-all ${
                  selectedVariant === 'classic' 
                    ? 'bg-primary text-primary-content shadow-lg' 
                    : 'bg-base-200 hover:bg-base-300'
                }`}
              >
                <div className="card-body">
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="variant"
                      className="radio"
                      checked={selectedVariant === 'classic'}
                      onChange={() => setSelectedVariant('classic')}
                    />
                    <div className="flex-1">
                      <h4 className="font-bold text-lg">{VARIANT_NAMES.classic}</h4>
                      <p className={selectedVariant === 'classic' ? 'opacity-90' : 'text-base-content/70'}>
                        {VARIANT_DESCRIPTIONS.classic}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Variante Descendante */}
              <div
                onClick={() => setSelectedVariant('descending')}
                className={`card glass cursor-pointer transition-all ${
                  selectedVariant === 'descending' 
                    ? 'bg-primary text-primary-content shadow-lg' 
                    : 'bg-base-200 hover:bg-base-300'
                }`}
              >
                <div className="card-body">
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="variant"
                      className="radio"
                      checked={selectedVariant === 'descending'}
                      onChange={() => setSelectedVariant('descending')}
                    />
                    <div className="flex-1">
                      <h4 className="font-bold text-lg">{VARIANT_NAMES.descending}</h4>
                      <p className={selectedVariant === 'descending' ? 'opacity-90' : 'text-base-content/70'}>
                        {VARIANT_DESCRIPTIONS.descending}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Variante Montante */}
              <div
                onClick={() => setSelectedVariant('ascending')}
                className={`card glass cursor-pointer transition-all ${
                  selectedVariant === 'ascending' 
                    ? 'bg-primary text-primary-content shadow-lg' 
                    : 'bg-base-200 hover:bg-base-300'
                }`}
              >
                <div className="card-body">
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="variant"
                      className="radio"
                      checked={selectedVariant === 'ascending'}
                      onChange={() => setSelectedVariant('ascending')}
                    />
                    <div className="flex-1">
                      <h4 className="font-bold text-lg">{VARIANT_NAMES.ascending}</h4>
                      <p className={selectedVariant === 'ascending' ? 'opacity-90' : 'text-base-content/70'}>
                        {VARIANT_DESCRIPTIONS.ascending}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-action">
              <button
                onClick={() => setShowModal(false)}
                className="btn"
                disabled={loading}
              >
                Annuler
              </button>
              <button
                onClick={handleCreate}
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? 'Création...' : 'Créer la partie'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

