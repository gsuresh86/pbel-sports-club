import type { MetadataRoute } from 'next';
import { listPublicTournamentIds } from '@/lib/tournament-meta';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = 'https://tourneycraft.app';
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    {
      url: `${base}/tournament`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${base}/schedules`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.7,
    },
    {
      url: `${base}/winners`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
  ];

  const tournaments = await listPublicTournamentIds();
  const tournamentRoutes: MetadataRoute.Sitemap = tournaments.flatMap((t) => {
    const lastModified = t.updatedAt ? new Date(t.updatedAt) : now;
    const paths = [
      `/tournament/${t.id}`,
      `/tournament/${t.id}/register`,
      `/tournament/${t.id}/standings`,
      `/tournament/${t.id}/rules`,
      `/tournament/${t.id}/fixtures`,
      `/tournament/${t.id}/results`,
    ];
    return paths.map((path) => ({
      url: `${base}${path}`,
      lastModified,
      changeFrequency: 'daily' as const,
      priority: path.endsWith(t.id) ? 0.8 : 0.6,
    }));
  });

  return [...staticRoutes, ...tournamentRoutes];
}
