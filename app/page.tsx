import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function Home() {
  const sports = [
    {
      name: 'Badminton',
      description: 'Fast-paced racket sport played on a court with a net',
      icon: '🏸',
      slug: 'badminton',
    },
    {
      name: 'Table Tennis',
      description: 'Indoor sport played on a table with paddles and a lightweight ball',
      icon: '🏓',
      slug: 'table-tennis',
    },
    {
      name: 'Volleyball',
      description: 'Team sport played with a ball over a high net',
      icon: '🏐',
      slug: 'volleyball',
    },
  ];

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
        {/* Hero Section */}
        <section className="py-20 px-4">
          <div className="max-w-7xl mx-auto text-center">
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
              PBEL City Sports Association
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              Join our community sports events. Compete, connect, and celebrate athleticism
              in badminton, table tennis, and volleyball tournaments.
            </p>
            <div className="flex gap-4 justify-center">
              <Link href="/tournaments">
                <Button size="lg" className="text-lg px-8">
                  View Tournaments
                </Button>
              </Link>
              <Link href="/register">
                <Button size="lg" variant="outline" className="text-lg px-8">
                  Register Now
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Sports Categories */}
        <section className="py-16 px-4">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">Our Sports</h2>
            <div className="grid md:grid-cols-3 gap-8">
              {sports.map((sport) => (
                <Card key={sport.slug} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="text-6xl mb-4 text-center">{sport.icon}</div>
                    <CardTitle className="text-center">{sport.name}</CardTitle>
                    <CardDescription className="text-center">
                      {sport.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Link href={`/tournaments?sport=${sport.slug}`}>
                      <Button className="w-full">View Tournaments</Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Quick Links */}
        <section className="py-16 px-4 bg-blue-600 text-white">
          <div className="max-w-7xl mx-auto">
            <div className="grid md:grid-cols-4 gap-8 text-center">
              <Link href="/schedules" className="hover:opacity-80 transition">
                <div className="text-4xl mb-2">📅</div>
                <h3 className="text-xl font-semibold mb-2">Match Schedules</h3>
                <p className="text-blue-100">View upcoming matches and fixtures</p>
              </Link>
              <Link href="/live-scores" className="hover:opacity-80 transition">
                <div className="text-4xl mb-2">🔴</div>
                <h3 className="text-xl font-semibold mb-2">Live Scores</h3>
                <p className="text-blue-100">Follow matches in real-time</p>
              </Link>
              <Link href="/winners" className="hover:opacity-80 transition">
                <div className="text-4xl mb-2">🏆</div>
                <h3 className="text-xl font-semibold mb-2">Winners</h3>
                <p className="text-blue-100">Celebrate our champions</p>
              </Link>
              <Link href="/register" className="hover:opacity-80 transition">
                <div className="text-4xl mb-2">📝</div>
                <h3 className="text-xl font-semibold mb-2">Register</h3>
                <p className="text-blue-100">Sign up for tournaments</p>
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
