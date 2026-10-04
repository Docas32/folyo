import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import authConfig from './auth.config';
const { auth } = NextAuth(authConfig);
export default auth((request) => {
  if (!request.auth?.user?.id)
    return NextResponse.redirect(new URL('/', request.url));
});
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/templates/:path*',
    '/onboarding/:path*',
    '/settings/:path*',
    '/accept-terms/:path*',
    '/editor/:path*',
    '/post-login',
  ],
};
