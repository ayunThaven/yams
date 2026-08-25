import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { BACKOFFICE_DEVICE_COOKIE, validateDeviceToken } from '@/lib/backofficeAuth'
import BackofficeNav from '@/components/backoffice/BackofficeNav'

export const metadata: Metadata = { title: 'Administration', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function BackofficeLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies()
  if (!(await validateDeviceToken(store.get(BACKOFFICE_DEVICE_COOKIE)?.value))) notFound()
  return <div className="bo-shell fixed inset-0 z-[100] overflow-auto text-slate-100"><main className="mx-auto min-h-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8"><BackofficeNav />{children}</main></div>
}
