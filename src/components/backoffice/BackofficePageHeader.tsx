import type { ReactNode } from 'react'

type Props = { eyebrow?: string; title: string; description?: string; actions?: ReactNode }

export default function BackofficePageHeader({ eyebrow, title, description, actions }: Props) {
  return <header className="bo-page-header"><div>{eyebrow && <p className="bo-eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p className="bo-page-description">{description}</p>}</div>{actions && <div className="bo-page-actions">{actions}</div>}</header>
}
