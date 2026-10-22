import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname !== '/**') {
    return NextResponse.next()
  }

  const destination = request.nextUrl.clone()
  destination.pathname = '/'
  destination.search = ''

  return NextResponse.redirect(destination)
}

export const config = {
  matcher: '/:path*',
}