import { redirect } from 'next/navigation';

export default function TournamentPage({ params }: { params: { id: string } }) {
  redirect(`/admin/tournaments/${params.id}/overview`);
}
