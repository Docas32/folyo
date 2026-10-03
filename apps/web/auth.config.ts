import type { NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';
// Middleware uses only JWT verification: no DB, Workers bindings or Node-only code.
export default {
  providers: [Google],
  session: { strategy: 'jwt' },
  trustHost: true,
  pages: { signIn: '/', error: '/' },
  callbacks: {
    session({ session, token }) {
      if (session.user && typeof token.sub === 'string')
        session.user.id = token.sub;
      return session;
    },
  },
} satisfies NextAuthConfig;
