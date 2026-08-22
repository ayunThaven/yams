import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { verifyJwtToken } from '@/lib/authServer'

const COOKIE_NAME = 'yams_auth_token'

export default async function ProtectedRouteLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value

  if (!token || !verifyJwtToken(token)) {
    redirect('/login')
  }

  return children
}
