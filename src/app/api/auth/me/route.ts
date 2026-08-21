import { NextRequest, NextResponse } from 'next/server'
import { verifyJwtToken, getUserProfileById } from '@/lib/authServer'
import { AUTH_COOKIE_NAME } from '@/lib/authRequest'

export async function GET(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value

  if (!token) {
    return NextResponse.json({ user: null, profile: null }, { status: 200 })
  }

  const authUser = verifyJwtToken(token)
  if (!authUser) {
    return NextResponse.json({ user: null, profile: null }, { status: 200 })
  }

  try {
    const profile = await getUserProfileById(authUser.id)
    return NextResponse.json(
      {
        user: authUser,
        profile,
      },
      { status: 200 }
    )
  } catch {
    return NextResponse.json(
      {
        user: authUser,
        profile: null,
      },
      { status: 200 }
    )
  }
}


