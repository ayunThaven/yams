import Link from 'next/link'

export function DiceMonogram({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 256 256" fill="none" aria-hidden="true">
      <g transform="rotate(-9 128 128)">
        <rect x="62" y="62" width="146" height="146" rx="31" fill="#8E2F3F"/>
        <circle cx="98" cy="98" r="10" fill="#F4EBDD" opacity=".9"/>
        <circle cx="172" cy="172" r="10" fill="#F4EBDD" opacity=".9"/>
      </g>
      <g transform="rotate(5 128 128)">
        <rect x="48" y="47" width="160" height="160" rx="35" fill="#F4EBDD" stroke="#C08A5B" strokeWidth="7"/>
        <circle cx="84" cy="83" r="12" fill="#8E2F3F"/>
        <circle cx="172" cy="83" r="12" fill="#8E2F3F"/>
        <circle cx="128" cy="127" r="14" fill="#C08A5B"/>
        <circle cx="84" cy="171" r="12" fill="#8E2F3F"/>
        <circle cx="172" cy="171" r="12" fill="#8E2F3F"/>
      </g>
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
