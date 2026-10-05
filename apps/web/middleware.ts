import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import { isAdminEmail } from './lib/admin-access';
import authConfig from './auth.config';
const { auth } = NextAuth(authConfig);
export default auth((request) => {
  if (
    request.nextUrl.pathname.startsWith('/admin') ||
    request.nextUrl.pathname.startsWith('/api/admin/')
  ) {
    if (!request.auth?.user?.id || !isAdminEmail(request.auth.user.email))
      return new NextResponse(null, { status: 404 });
    return;
  }
  if (!request.auth?.user?.id)
    return NextResponse.redirect(new URL('/', request.url));
});
export const config = {
  matcher: [
    '/admin/:path*',
    '/api/admin/:path*',
    '/dashboard/:path*',
    '/templates/:path*',
    '/onboarding/:path*',
    '/settings/:path*',
    '/accept-terms/:path*',
    '/editor/:path*',
    '/post-login',
  ],
};
