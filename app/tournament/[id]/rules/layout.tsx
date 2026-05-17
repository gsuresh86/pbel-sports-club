import { Metadata } from 'next';
import { getAdminFirestore } from '@/lib/firebase-admin';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const db = getAdminFirestore();
    const snap = await db.collection('tournaments').doc(id).get();
    if (!snap.exists) {
      return { title: 'Tournament Rules' };
    }
    const d = snap.data()!;
    return {
      title: `Rules – ${d.name}`,
      description: `Official rules and regulations for ${d.name}.`,
    };
  } catch {
    return { title: 'Tournament Rules' };
  }
}

export default function RulesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
