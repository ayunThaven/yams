import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

function IconBase({ children, ...props }: IconProps) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{children}</svg>
}

export function HomeIcon(props: IconProps) { return <IconBase {...props}><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></IconBase> }
export function TrophyIcon(props: IconProps) { return <IconBase {...props}><path d="M8 4h8v5a4 4 0 0 1-8 0V4Z"/><path d="M8 6H4v2a4 4 0 0 0 4 4M16 6h4v2a4 4 0 0 1-4 4M12 13v4M8 21h8M9 17h6"/></IconBase> }
export function UserIcon(props: IconProps) { return <IconBase {...props}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></IconBase> }
export function BugIcon(props: IconProps) { return <IconBase {...props}><path d="M8 8h8v7a4 4 0 0 1-8 0V8Z"/><path d="M9 4.5 12 8l3-3.5M4 13h4M16 13h4M5 8l3 2M19 8l-3 2M6 18l3-2M18 18l-3-2"/></IconBase> }
export function LogoutIcon(props: IconProps) { return <IconBase {...props}><path d="M10 4H5v16h5M14 8l4 4-4 4M8 12h10"/></IconBase> }
export function PlusCircleIcon(props: IconProps) { return <IconBase {...props}><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></IconBase> }
export function ArrowRightIcon(props: IconProps) { return <IconBase {...props}><path d="M5 12h14M14 7l5 5-5 5"/></IconBase> }
export function CopyIcon(props: IconProps) { return <IconBase {...props}><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></IconBase> }
export function MenuIcon(props: IconProps) { return <IconBase {...props}><path d="M4 7h16M4 12h16M4 17h16"/></IconBase> }
export function CloseIcon(props: IconProps) { return <IconBase {...props}><path d="m6 6 12 12M18 6 6 18"/></IconBase> }
export function ChevronRightIcon(props: IconProps) { return <IconBase {...props}><path d="m9 18 6-6-6-6"/></IconBase> }
export function ChevronDownIcon(props: IconProps) { return <IconBase {...props}><path d="m6 9 6 6 6-6"/></IconBase> }
export function ClockIcon(props: IconProps) { return <IconBase {...props}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></IconBase> }
export function DotsIcon(props: IconProps) { return <IconBase {...props}><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none"/></IconBase> }
export function LockIcon(props: IconProps) { return <IconBase {...props}><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></IconBase> }
