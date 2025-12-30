'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, user, loading } = useAuth();
  const router = useRouter();

  // Redirect to admin if user is already logged in
  useEffect(() => {
    if (!loading && user && (user.role === 'admin' || user.role === 'super-admin' || user.role === 'tournament-admin')) {
      console.log('User already logged in, redirecting to admin...');
      router.push('/admin');
    }
  }, [user, loading, router]);

  // Reset loading state when user state changes
  useEffect(() => {
    if (!loading) {
      setIsLoading(false);
    }
  }, [loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      console.log('Attempting to sign in with:', email);
      await signIn(email, password);
      console.log('Sign in successful, waiting for auth state update...');
      // Don't redirect here - let the useEffect handle it after user state is updated
    } catch (err: unknown) {
      console.error('Sign in error:', err);
      setError('Failed to sign in. Please check your credentials.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Sports Background */}
      <div 
        className="hidden lg:flex lg:w-1/2 relative bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `
            linear-gradient(135deg, rgba(15, 23, 42, 0.75), rgba(30, 58, 138, 0.65), rgba(15, 23, 42, 0.75)),
            url('/images/sports-background.png')
          `
        }}
      >
        {/* Overlay for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/80 via-blue-900/70 to-slate-900/80"></div>
        
        {/* Decorative Sports Icons */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-20 left-20 text-7xl">🏸</div>
          <div className="absolute top-32 right-24 text-6xl">🏓</div>
          <div className="absolute top-48 left-1/4 text-5xl">🏐</div>
          <div className="absolute top-64 right-1/3 text-6xl">🏆</div>
          <div className="absolute bottom-48 left-24 text-5xl">⚡</div>
          <div className="absolute bottom-24 right-16 text-7xl">🏸</div>
          <div className="absolute bottom-64 left-1/2 text-6xl">🏓</div>
          <div className="absolute top-1/2 left-16 text-5xl">🏐</div>
          <div className="absolute top-1/3 right-1/4 text-6xl">🏆</div>
          <div className="absolute top-1/4 right-1/2 text-6xl">🏅</div>
        </div>

        {/* Welcome Content */}
        <div className="relative z-10 flex flex-col justify-center items-start p-12 text-white">
          <div className="max-w-md space-y-6 animate-fade-in">
            <h1 className="text-5xl font-bold leading-tight">
              Welcome to
              <span className="block text-blue-400">Sports Club</span>
            </h1>
            <p className="text-xl text-gray-200 leading-relaxed">
              Join our community of athletes and compete in exciting tournaments. 
              Track your progress, view live scores, and stay connected with your team.
            </p>
            <div className="flex items-center gap-4 pt-4">
              <div className="flex flex-col">
                <span className="text-3xl font-bold text-blue-400">🏆</span>
                <span className="text-sm text-gray-300 mt-1">Tournaments</span>
              </div>
              <div className="flex flex-col">
                <span className="text-3xl font-bold text-green-400">📊</span>
                <span className="text-sm text-gray-300 mt-1">Live Scores</span>
              </div>
              <div className="flex flex-col">
                <span className="text-3xl font-bold text-orange-400">👥</span>
                <span className="text-sm text-gray-300 mt-1">Community</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-gray-50 px-4 py-12">
        <div className="w-full max-w-md">
          <Card className="shadow-xl border-0 animate-fade-in">
            <CardHeader className="space-y-1 pb-6">
              <CardTitle className="text-3xl font-bold text-center">Welcome Back</CardTitle>
              <CardDescription className="text-center text-base">
                Sign in to your account to continue
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                    {error}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium">
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-11"
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full h-11 text-base font-semibold" 
                  disabled={isLoading || loading}
                >
                  {isLoading ? 'Signing In...' : 'Sign In'}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-sm text-gray-600">
                  Don&apos;t have an account?{' '}
                  <Link 
                    href="/signup" 
                    className="text-blue-600 hover:text-blue-700 font-medium hover:underline transition-colors"
                  >
                    Sign up
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
