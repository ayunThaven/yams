'use client'

import Image from 'next/image'
import { useFlashMessage } from '@/contexts/FlashMessageContext'
import { CloseIcon } from '@/components/icons/ClubIcons'

export default function FlashMessages() {
  const { messages, removeMessage } = useFlashMessage()
  if (!messages.length) return null
  return <aside className="club-unlock-stack" aria-live="polite">
    {messages.map(message => <article key={message.id} className={`club-unlock-toast rarity-${message.achievement.rarity.toLowerCase()}`}>
      <div className="club-unlock-medal"><Image src={message.achievement.image_path} alt="" width={76} height={76}/></div>
      <div><p>Nouvelle médaille</p><h3>{message.achievement.name}</h3><small>{message.achievement.description}</small></div>
      <button onClick={() => removeMessage(message.id)} aria-label="Fermer la notification"><CloseIcon/></button>
    </article>)}
  </aside>
}
