import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';

const handleI18nRouting = createMiddleware(routing);

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  
  // Define protected routes (paths that require auth)
  const protectedPaths = ['/dashboard', '/profile', '/inbox', '/group', '/tasks', '/classroom'];
  
  // Check if current path matches any protected path
  const isProtectedPath = protectedPaths.some(p => pathname.includes(p)) || pathname.includes('/courses/new');

  if (isProtectedPath) {
    const token = req.cookies.get('access_token')?.value;
    if (!token) {
      // Extract locale from the pathname if it exists, otherwise use default
      const pathnameLocale = routing.locales.find(
        (l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`
      ) || routing.defaultLocale;
      
      const loginUrl = new URL(`/${pathnameLocale}/login`, req.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Handle i18n routing
  return handleI18nRouting(req);
}

export const config = {
  matcher: [
    // Enable a redirect to a matching locale at the root
    '/',
    // Set a cookie to remember the previous locale for all requests that have a locale prefix
    '/(ar|de|en|es|fr)/:path*',
    // Enable redirects that add a locale to any path
    '/((?!api|_next|_vercel|.*\\..*).*)'
  ]
};
