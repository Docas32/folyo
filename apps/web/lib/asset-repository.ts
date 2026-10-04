import { assets, createDb } from '@folyo/db';
export type NewAsset = typeof assets.$inferInsert;
export interface AssetRepository {
  insert(asset: NewAsset): Promise<string>;
}
export function createAssetRepository(databaseUrl: string): AssetRepository {
  const db = createDb(databaseUrl);
  return {
    async insert(asset) {
      const [row] = await db
        .insert(assets)
        .values(asset)
        .returning({ id: assets.id });
      if (!row) throw new Error('Asset insert failed');
      return row.id;
    },
  };
}
