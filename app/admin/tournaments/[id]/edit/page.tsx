import { redirect } from 'next/navigation';

export default async function EditTournamentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin/tournaments?edit=${encodeURIComponent(id)}`);
}
