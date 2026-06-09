import { Metadata } from 'next';

type Props = { params: Promise<{ id: string }> };

async function fetchTournamentMeta(id: string) {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) return null;
  try {
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/tournaments/${id}`,
      { next: { revalidate: 300 } }
    );
    if (!res.ok) return null;
    const doc = await res.json();
    if (doc.error) return null;
    const f = doc.fields ?? {};
    const str = (key: string): string => f[key]?.stringValue ?? '';
    return {
      name: str('name'),
      description: str('description'),
      banner: str('banner'),
    };
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const t = await fetchTournamentMeta(id);
  if (!t?.name) return { title: 'Tournament Standings' };

  const title = `Standings – ${t.name}`;
  const description = t.description || `Live pool standings for ${t.name}.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      ...(t.banner ? { images: [{ url: t.banner, width: 1200, height: 400, alt: t.name }] } : {}),
    },
    twitter: {
      card: t.banner ? 'summary_large_image' : 'summary',
      title,
      description,
    },
  };
}

export default function StandingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
