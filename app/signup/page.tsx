'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getLoginRedirect } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { authErrorMessage } from '@/lib/auth-errors';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';

export default function SignUpPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { signUp, signInWithGoogle, user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace(getLoginRedirect(user));
    }
  }, [user, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    try {
      // Default role is 'public' - admin will need to be set manually in Firebase Console
      await signUp(email, password, name, 'public');
      setSuccess(true);
      router.push('/host');
    } catch (err: unknown) {
      console.error('Signup error:', err);
      setError(authErrorMessage(err, 'Failed to create account. Please try again.'));
    }
  };

  const handleGoogle = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      router.push('/host');
    } catch (err: unknown) {
      console.error('Google signup error:', err);
      setError(authErrorMessage(err, 'Google sign-up failed. Please try again.'));
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create Account</CardTitle>
          <CardDescription>
            Sign up, submit a tournament, and we&apos;ll review it before you can run it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {success && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
              <p className="font-semibold">Account created successfully!</p>
              <p className="text-sm mt-1">Taking you to your tournament page…</p>
            </div>
          )}

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
              {error}
            </div>
          )}

          <GoogleSignInButton
            onClick={handleGoogle}
            disabled={success || googleLoading}
            label={googleLoading ? 'Opening Google…' : 'Sign up with Google'}
          />
          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs uppercase tracking-wide text-gray-400">or</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Enter your full name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="your.email@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Minimum 6 characters"
              />
              <p className="text-xs text-gray-500">Must be at least 6 characters</p>
            </div>

            <Button type="submit" className="w-full" disabled={success}>
              {success ? 'Account Created!' : 'Sign Up'}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <p className="text-gray-600">
              Already have an account?{' '}
              <Link href="/login" className="text-blue-600 hover:underline">
                Sign in
              </Link>
            </p>
          </div>

          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              After you create an account you can submit a tournament. TourneyCraft reviews it, and once it is approved you can set it up and run it.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
