import 'server-only';

import { prisma } from '@/lib/prisma';
// Single source of truth for source metadata + allowlisted fetch config.
// Only the metadata (never the fetch functions) is persisted to DataSource.
import { SOURCE_REGISTRY } from '../../scripts/ingestion/registry.mjs';

/**
 * Upsert the code-defined source registry into the DataSource table.
 *
 * Security: DB rows are display/health metadata ONLY — they can never make
 * the worker fetch a URL. Fetch behavior is exclusively the allowlisted code
 * in scripts/ingestion. Idempotent and cheap (≤ a handful of rows); called on
 * every ingestion run and on read by the sources API so the table can never
 * drift far from the code.
 */
export async function syncSourceRegistry(): Promise<number> {
  const upserts = SOURCE_REGISTRY.map((source) => {
    const { id, fetch: _fetch, ...metadata } = source;
    return prisma.dataSource.upsert({
      where: { slug: id },
      update: {
        label: metadata.label,
        category: metadata.category,
        transport: metadata.transport,
        authorityType: metadata.authorityType,
        trustTier: metadata.trustTier,
        displayOrder: metadata.displayOrder,
        homepage: metadata.homepage,
        description: metadata.description,
        enabled: metadata.enabled
      },
      create: {
        slug: id,
        label: metadata.label,
        category: metadata.category,
        transport: metadata.transport,
        authorityType: metadata.authorityType,
        trustTier: metadata.trustTier,
        displayOrder: metadata.displayOrder,
        homepage: metadata.homepage,
        description: metadata.description,
        enabled: metadata.enabled
      }
    });
  });
  await Promise.all(upserts);
  return SOURCE_REGISTRY.length;
}
