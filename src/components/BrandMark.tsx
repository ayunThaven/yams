import Link from 'next/link'

export function DiceMonogram({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="M24 3 42 13.5v21L24 45 6 34.5v-21L24 3Z" fill="currentColor" opacity=".16"/>
      <path d="m24 3 18 10.5-18 10.4L6 13.5 24 3Zm0 20.9V45m18-31.5v21L24 45 6 34.5v-21" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
      <circle cx="24" cy="13" r="2" fill="currentColor"/>
      <circle cx="14" cy="21" r="2" fill="currentColor"/>
      <circle cx="19" cy="33" r="2" fill="currentColor"/>
      <circle cx="34" cy="21" r="2" fill="currentColor"/>
      <circle cx="29" cy="33" r="2" fill="currentColor"/>
      <circle cx="36" cy="29" r="2" fill="currentColor"/>
    </svg>
  )
}

export default function BrandMark({ compact = false, href = '/' }: { compact?: boolean; href?: string }) {
  return (
    <Link href={href} className="club-brand" aria-label="Yams — accueil">
      <DiceMonogram className="club-brand-die" />
      {!compact && <span>Yams</span>}
    </Link>
  )
}
