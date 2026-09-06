import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';

const handleI18nRouting = createMiddleware(routing);

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  
  // Extract locale from the pathname if it exists
  const pathnameLocale = routing.locales.find(
    (l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`
  );
  
  // Normalize path without locale prefix
  const pathWithoutLocale = pathnameLocale 
    ? (pathname.replace(new RegExp(`^/${pathnameLocale}`), '') || '/')
    : pathname;

  // Define protected routes (paths requiring authentication)
  const protectedPaths = [
    '/dashboard',
    '/profile',
    '/settings',
    '/inbox',
    '/group',
    '/tasks',
    '/assignments',
    '/classroom',
    '/courses/new'
  ];
  
  const isProtectedPath = protectedPaths.some(
    (p) => pathWithoutLocale === p || pathWithoutLocale.startsWith(p + '/')
  );

  if (isProtectedPath) {
    const token = req.cookies.get('access_token')?.value;
    if (!token) {
      const targetLocale = pathnameLocale || routing.defaultLocale;
      const loginUrl = new URL(`/${targetLocale}/login`, req.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Handle i18n routing
  const response = handleI18nRouting(req);

  // Guard against 307/308 redirect loops on RSC (React Server Component) requests
  // when the path is already localized:
  const isRscRequest = req.nextUrl.searchParams.has('_rsc') || req.headers.get('RSC') === '1';
  if (isRscRequest && pathnameLocale && (response.status === 307 || response.status === 308)) {
    return NextResponse.next();
  }

  return response;
}

export const config = {
  matcher: [
    // Enable a redirect to a matching locale at the root
    '/',
    // Match all localized paths
    '/(ar|de|en|es|fr)/:path*',
    // Match all unlocalized paths, excluding API, _next internals, and static assets
    '/((?!api|_next|_vercel|.*\\..*).*)'
  ]
};
