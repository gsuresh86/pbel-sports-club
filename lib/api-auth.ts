import { DecodedIdToken } from 'firebase-admin/auth';
import { getAdminAuth } from '@/lib/firebase-admin';

export async function verifyAuthToken(request: Request): Promise<DecodedIdToken | null> {
  const header = request.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) return null;

  const token = header.slice(7).trim();
  if (!token) return null;

  try {
    return await getAdminAuth().verifyIdToken(token);
  } catch {
    return null;
  }
}
