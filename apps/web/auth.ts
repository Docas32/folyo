import NextAuth from 'next-auth';
import { headers } from 'next/headers';
import { createDb } from '@folyo/db';
import authConfig from './auth.config';
import { serverEnv } from './lib/runtime';
import { saveGoogleAccount } from './lib/google-account';
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ account, profile, user }) {
      if (account?.provider !== 'google') return false;
      const id = await saveGoogleAccount(
        createDb(serverEnv().DATABASE_URL),
        profile,
        (await headers()).get('accept-language'),
      );
      if (!id) return false;
      user.id = id;
      return true;
    },
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
  },
});
