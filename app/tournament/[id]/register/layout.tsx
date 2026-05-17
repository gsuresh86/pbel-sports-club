import { Metadata } from 'next';
import { getAdminFirestore } from '@/lib/firebase-admin';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const db = getAdminFirestore();
    const snap = await db.collection('tournaments').doc(id).get();
    if (!snap.exists) {
      return { title: 'Tournament Registration' };
    }
    const d = snap.data()!;
    const sport = (d.sport as string | undefined) ?? '';
    const venue = (d.venue as string | undefined) ?? '';
    return {
      title: `Register – ${d.name}`,
      description: d.description || `Register for ${d.name}${sport ? `, a ${sport} tournament` : ''}${venue ? ` at ${venue}` : ''}.`,
    };
  } catch {
    return { title: 'Tournament Registration' };
  }
}

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
