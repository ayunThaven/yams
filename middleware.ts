import { NextResponse } from 'next/server'

/**
 * Middleware UX pour les pages.
 *
 * La sécurité réelle reste dans les API routes et le serveur Socket.IO, où le JWT
 * est vérifié côté serveur. Ici on ne fait qu'une redirection rapide basée sur
 * la présence du cookie HTTP-only, car le middleware Edge ne doit pas importer
 * jsonwebtoken.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hasAuthCookie = !!request.cookies.get('yams_auth_token')?.value
  
  // Routes d'authentification
  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register')
  
  // Routes protégées
  const isProtectedRoute = pathname.startsWith('/dashboard') || pathname.startsWith('/game/')

  if (isProtectedRoute && !hasAuthCookie) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (isAuthPage && hasAuthCookie) {
    const dashboardUrl = request.nextUrl.clone()
    dashboardUrl.pathname = '/dashboard'
    dashboardUrl.search = ''
    return NextResponse.redirect(dashboardUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
