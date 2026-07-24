import { NextResponse } from 'next/server'

/**
 * Page-level authentication is enforced by the protected route layout. This
 * middleware deliberately keeps static assets and API routes transparent.
 */
export function middleware() {
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
