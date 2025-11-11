import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Define your public/marketing paths
  // Users can visit these pages without logging in
  const publicPaths = [
    '/',           // Homepage
    '/login',
    '/register',   // Add register if you have it
    '/about',
    '/contact',
    '/blog',
    '/services',
    '/download'
  ];
  
  // 2. Get the session cookie
  const authToken = request.cookies.get('session')?.value;

  // 3. Check if the current path is public
  // We use 'some' and 'startsWith' to handle sub-pages (e.g., /blog/post-1)
  const isPublicPath = publicPaths.some(path => {
    if (path === '/') return pathname === '/'; // Exact match for homepage
    return pathname.startsWith(path);
  });

  // 4. REDIRECT LOGIC:

  // Case A: User is NOT logged in and tries to access a PRIVATE page (like /dashboard)
  // Logic: If it's NOT public, has NO token, and is NOT an auth API request -> Redirect to Login
  if (!isPublicPath && !authToken && !pathname.startsWith('/api/auth')) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectedFrom', pathname); 
    return NextResponse.redirect(loginUrl);
  }

  // Case B: User IS logged in and tries to access a PUBLIC AUTH page (like /login)
  // Logic: If they are already logged in, send them straight to the dashboard
  if (pathname.startsWith('/login') && authToken) {
     const dashboardUrl = new URL('/dashboard', request.url);
     return NextResponse.redirect(dashboardUrl);
  }

  // Allow the request to proceed normally
  return NextResponse.next();
}

// 5. CONFIGURATION (The Fix for Images)
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Any path containing a dot (.) which indicates a file extension (e.g. .png, .jpg, .css)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
};