import { redirect } from 'next/navigation';

type Props = {
  params: Promise<{ id: string }>;
};

/** Legacy URL: /admin/matches/[id] → /admin/matches/[id]/score */
export default async function AdminMatchLegacyRedirect({ params }: Props) {
  const { id } = await params;
  redirect(`/admin/matches/${id}/score`);
}
