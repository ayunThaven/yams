import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { resolveRequestIdentity } from '@/server/playerIdentity'
import { isValidRoomId } from '@/server/socketValidation'

export default async function GameLayout({ children, params }: { children: React.ReactNode; params: Promise<{ uuid: string }> }) {
  const { uuid } = await params
  if (!isValidRoomId(uuid)) redirect('/play')
  if (!await resolveRequestIdentity(await cookies())) redirect(`/play?join=${encodeURIComponent(uuid)}`)
  return children
}
