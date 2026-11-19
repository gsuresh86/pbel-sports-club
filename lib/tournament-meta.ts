export type TournamentMeta = {
  id: string;
  name: string;
  description: string;
  sport: string;
  venue: string;
  banner: string;
  status: string;
  isPublic: boolean;
};

function str(fields: Record<string, unknown>, key: string): string {
  const v = fields[key] as { stringValue?: string } | undefined;
  return v?.stringValue ?? '';
}

function bool(fields: Record<string, unknown>, key: string, fallback = true): boolean {
  const v = fields[key] as { booleanValue?: boolean } | undefined;
  if (typeof v?.booleanValue === 'boolean') return v.booleanValue;
  return fallback;
}

export async function fetchTournamentMeta(id: string): Promise<TournamentMeta | null> {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) return null;
  try {
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/tournaments/${id}`,
      { next: { revalidate: 300 } },
    );
    if (!res.ok) return null;
    const doc = await res.json();
    if (doc.error) return null;
    const f = (doc.fields ?? {}) as Record<string, unknown>;
    const isPublic = bool(f, 'isPublic', true);
    const approval = str(f, 'approvalStatus');
    if (!isPublic || approval === 'pending' || approval === 'rejected') return null;
    return {
      id,
      name: str(f, 'name'),
      description: str(f, 'description'),
      sport: str(f, 'sport'),
      venue: str(f, 'venue'),
      banner: str(f, 'banner'),
      status: str(f, 'status'),
      isPublic,
    };
  } catch {
    return null;
  }
}

export async function listPublicTournamentIds(): Promise<
  { id: string; updatedAt?: string }[]
> {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) return [];
  try {
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/tournaments?pageSize=200`,
      { next: { revalidate: 600 } },
    );
    if (!res.ok) return [];
    const data = await res.json();
    const docs = (data.documents ?? []) as Array<{
      name: string;
      fields?: Record<string, unknown>;
      updateTime?: string;
    }>;

    return docs
      .map((doc) => {
        const id = doc.name.split('/').pop() ?? '';
        const f = doc.fields ?? {};
        const isPublic = bool(f, 'isPublic', true);
        const approval = str(f, 'approvalStatus');
        return { id, isPublic, approval, updatedAt: doc.updateTime };
      })
      .filter((t) => t.id && t.isPublic && t.approval !== 'pending' && t.approval !== 'rejected')
      .map(({ id, updatedAt }) => ({ id, updatedAt }));
  } catch {
    return [];
  }
}

export function tournamentPageMetadata(
  t: TournamentMeta | null,
  fallbackTitle: string,
  opts?: { titlePrefix?: string; descriptionFallback?: (name: string) => string },
) {
  if (!t?.name) {
    return { title: fallbackTitle };
  }

  const title = opts?.titlePrefix ? `${opts.titlePrefix} – ${t.name}` : t.name;
  const description =
    t.description ||
    opts?.descriptionFallback?.(t.name) ||
    `${t.name}${t.sport ? `, a ${t.sport} tournament` : ''}${t.venue ? ` at ${t.venue}` : ''}.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website' as const,
      ...(t.banner
        ? { images: [{ url: t.banner, width: 1200, height: 400, alt: t.name }] }
        : {}),
    },
    twitter: {
      card: (t.banner ? 'summary_large_image' : 'summary') as
        | 'summary_large_image'
        | 'summary',
      title,
      description,
      ...(t.banner ? { images: [t.banner] } : {}),
    },
  };
}
