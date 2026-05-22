import { auth } from '@/auth';
import { NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login'];
const PUBLIC_API_PREFIXES = ['/api/auth'];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();
  if (PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();

  // Allow Vercel cron — authenticated via Bearer token in route handler itself
  if (pathname.startsWith('/api/cron/')) return NextResponse.next();

  // Allow server-to-server internal calls (forwarded by daily-brief / cron)
  // when they carry the AUTH_SECRET via the x-internal-key header.
  const internalKey = req.headers.get('x-internal-key');
  if (internalKey && process.env.AUTH_SECRET && internalKey === process.env.AUTH_SECRET) {
    return NextResponse.next();
  }

  if (!req.auth) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const url = new URL('/login', req.url);
    if (pathname !== '/') url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  // Match everything except static assets, images, and the service worker
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon-.*\\.png|apple-icon.*|manifest\\.webmanifest|sw\\.js).*)',
  ],
};
