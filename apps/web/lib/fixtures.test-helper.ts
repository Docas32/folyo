import { vi } from 'vitest';
import type { Repository, Site, User } from './account-service';
export const now = new Date('2026-10-03T12:00:00.000Z');
export const user: User = {
  id: '10000000-0000-4000-8000-000000000001',
  googleSub: 'google-123',
  email: 'test@example.com',
  name: 'Maria',
  avatarUrl: null,
  locale: 'pt-BR',
  createdAt: now,
  termsAcceptedAt: now,
  termsVersion: '2026-10-v1',
};
export const site: Site = {
  id: '20000000-0000-4000-8000-000000000002',
  userId: user.id,
  handle: 'maria',
  handleChangedAt: null,
  title: null,
  description: null,
  faviconKey: null,
  templateId: 'blank',
  theme: {},
  status: 'draft',
  publishedVersion: 0,
  createdAt: now,
  updatedAt: now,
};
export function mockRepository() {
  return {
    findUser: vi.fn<Repository['findUser']>().mockResolvedValue(user),
    findSite: vi.fn<Repository['findSite']>().mockResolvedValue(undefined),
    isReserved: vi.fn<Repository['isReserved']>().mockResolvedValue(false),
    isTaken: vi.fn<Repository['isTaken']>().mockResolvedValue(false),
    createSite: vi.fn<Repository['createSite']>().mockResolvedValue(undefined),
    acceptTerms: vi
      .fn<Repository['acceptTerms']>()
      .mockResolvedValue(undefined),
    updateSite: vi.fn<Repository['updateSite']>().mockResolvedValue(true),
    deleteUser: vi.fn<Repository['deleteUser']>().mockResolvedValue(undefined),
  } satisfies Repository;
}
