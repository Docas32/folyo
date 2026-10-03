import { users, type Database } from '@folyo/db';
import { googleProfileSchema } from './schemas';
export async function saveGoogleAccount(
  db: Pick<Database, 'insert'>,
  profile: unknown,
  acceptLanguage: string | null,
) {
  const parsed = googleProfileSchema.safeParse(profile);
  if (!parsed.success) return null;
  const data = parsed.data;
  const language = acceptLanguage?.split(',')[0]?.trim().toLowerCase();
  const [saved] = await db
    .insert(users)
    .values({
      googleSub: data.sub,
      email: data.email,
      name: data.name,
      avatarUrl: data.picture ?? null,
      locale: language?.startsWith('pt') ? 'pt-BR' : 'en',
    })
    .onConflictDoUpdate({
      target: users.googleSub,
      // Relogin refreshes the profile but preserves locale, terms and account ID.
      set: {
        email: data.email,
        name: data.name,
        avatarUrl: data.picture ?? null,
      },
    })
    .returning({ id: users.id });
  return saved?.id ?? null;
}
