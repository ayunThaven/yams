import { NextRequest, NextResponse } from 'next/server'

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
  const isBackoffice = pathname === '/backoffice' || pathname.startsWith('/backoffice/') || pathname.startsWith('/api/backoffice/')

  // Première couche de camouflage. La validité réelle du jeton opaque est
  // contrôlée côté serveur par le layout et chaque API back-office.
  if (isBackoffice && !request.cookies.get('yams_bo_device')?.value) {
    return new NextResponse('Not Found', {
      status: 404,
      headers: {
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    })
  }
  
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

  const response = NextResponse.next()
  if (isBackoffice) {
    response.headers.set('Cache-Control', 'no-store')
    response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  }
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
