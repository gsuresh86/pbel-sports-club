import { redirect } from 'next/navigation';

export default async function SpinWheelRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin/tournaments/${id}/assignments`);
}
