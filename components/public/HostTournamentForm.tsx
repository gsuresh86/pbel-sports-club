'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { useAuth } from '@/contexts/AuthContext';
import { authErrorMessage } from '@/lib/auth-errors';

export function HostTournamentForm() {
  const { user, loading, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleGoogle() {
    setError('');
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      router.push('/host');
    } catch (err) {
      setError(authErrorMessage(err, 'Google sign-in failed. Please try again.'));
      setGoogleLoading(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (user) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Signed in as {user.name || user.email}. Submit a tournament and we&apos;ll review it before it goes live.
        </p>
        <Link
          href="/host"
          className="w-full inline-flex items-center justify-center bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-black px-8 py-4 rounded-xl text-sm"
        >
          {user.role === 'public' ? 'Create a tournament' : 'Go to your tournaments'}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-500">{error}</p>}
      <GoogleSignInButton
        onClick={handleGoogle}
        disabled={googleLoading}
        label={googleLoading ? 'Opening Google…' : 'Continue with Google'}
      />
      <Link
        href="/signup"
        className="w-full inline-flex items-center justify-center border border-border rounded-xl px-8 py-3 text-sm font-semibold hover:bg-muted"
      >
        Sign up with email
      </Link>
      <p className="text-xs text-muted-foreground">
        Already registered?{' '}
        <Link href="/login" className="underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </div>
  );
}
