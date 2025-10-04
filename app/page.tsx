import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function Home() {
  const sports = [
    {
      name: 'Badminton',
      description: 'Professional badminton tournaments with advanced bracket management',
      icon: '🏸',
      slug: 'badminton',
      tournaments: 15,
      players: 120,
    },
    {
      name: 'Table Tennis',
      description: 'Competitive table tennis events with live scoring and rankings',
      icon: '🏓',
      slug: 'table-tennis',
      tournaments: 12,
      players: 95,
    },
    {
      name: 'Volleyball',
      description: 'Team volleyball competitions with comprehensive match tracking',
      icon: '🏐',
      slug: 'volleyball',
      tournaments: 8,
      players: 80,
    },
  ];

  const features = [
    {
      title: 'Live Tournament Management',
      description: 'Real-time bracket updates, match scheduling, and score tracking',
      icon: '⚡',
    },
    {
      title: 'Professional Scoring',
      description: 'Advanced scoring systems with detailed statistics and analytics',
      icon: '📊',
    },
    {
      title: 'Player Registration',
      description: 'Streamlined registration process with automated tournament placement',
      icon: '👥',
    },
    {
      title: 'Results & Rankings',
      description: 'Comprehensive results tracking and player ranking systems',
      icon: '🏆',
    },
  ];

  const stats = [
    { number: '500+', label: 'Active Players', description: 'Competitive athletes' },
    { number: '35+', label: 'Tournaments', description: 'Completed this year' },
    { number: '3', label: 'Sports', description: 'Professional leagues' },
    { number: '98%', label: 'Satisfaction', description: 'Player satisfaction rate' },
  ];

  const testimonials = [
    {
      name: 'Sarah Mitchell',
      role: 'Tournament Director',
      sport: 'Badminton',
      quote: 'The platform has revolutionized how we manage tournaments. The live scoring and bracket management features are exceptional.',
      avatar: '👩‍💼',
    },
    {
      name: 'Michael Rodriguez',
      role: 'Head Coach',
      sport: 'Table Tennis',
      quote: 'Professional-grade tournament management with real-time updates. Our players love the seamless experience.',
      avatar: '👨‍🏫',
    },
    {
      name: 'Jennifer Chen',
      role: 'League Coordinator',
      sport: 'Volleyball',
      quote: 'Outstanding platform for competitive sports. The analytics and reporting features give us valuable insights.',
      avatar: '👩‍🎓',
    },
  ];

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50">
        {/* Hero Section */}
        <section className="relative py-24 px-4 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800">
          <div className="absolute inset-0 bg-black/20"></div>
          <div className="relative max-w-7xl mx-auto text-center text-white">
            <div className="mb-8">
              <Badge variant="secondary" className="bg-blue-600/20 text-blue-200 border-blue-400/30 mb-6 px-6 py-2 text-lg">
                Professional Tournament Management
              </Badge>
            </div>
            <h1 className="text-5xl md:text-7xl font-bold mb-6 text-white">
              PBEL City Sports
            </h1>
            <h2 className="text-2xl md:text-3xl font-semibold mb-8 text-blue-200">
              Tournament Management System
            </h2>
            <p className="text-xl md:text-2xl text-gray-300 mb-12 max-w-4xl mx-auto leading-relaxed">
              Professional-grade tournament management platform for competitive sports. 
              Advanced bracket systems, live scoring, and comprehensive analytics for serious athletes and organizers.
            </p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
              <Link href="/tournaments">
                <Button size="lg" className="text-lg px-10 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300">
                  View Active Tournaments
                </Button>
              </Link>
              <Link href="/register">
                <Button size="lg" variant="outline" className="text-lg px-10 py-4 border-2 border-white text-white hover:bg-white hover:text-slate-900 font-semibold shadow-lg hover:shadow-xl transition-all duration-300">
                  Register for Tournament
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-20 px-4 bg-white">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">Tournament Statistics</h2>
              <p className="text-xl text-gray-600">Professional sports management at scale</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {stats.map((stat, index) => (
                <div key={index} className="text-center group">
                  <div className="text-4xl md:text-5xl font-bold text-blue-600 mb-2 group-hover:scale-105 transition-transform duration-300">
                    {stat.number}
                  </div>
                  <div className="text-xl font-semibold text-gray-900 mb-1">{stat.label}</div>
                  <div className="text-gray-600">{stat.description}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Sports Categories */}
        <section className="py-24 px-4 bg-gray-50">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">Professional Sports Leagues</h2>
              <p className="text-xl text-gray-600">Competitive tournaments with advanced management systems</p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {sports.map((sport, index) => (
                <Card key={sport.slug} className="bg-white hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-gray-200">
                  <CardHeader className="text-center pb-4">
                    <div className="text-6xl mb-4">{sport.icon}</div>
                    <CardTitle className="text-2xl font-bold text-gray-900 mb-2">{sport.name}</CardTitle>
                    <CardDescription className="text-gray-600 text-lg leading-relaxed">
                      {sport.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>Active Tournaments: <span className="font-semibold text-blue-600">{sport.tournaments}</span></span>
                      <span>Registered Players: <span className="font-semibold text-blue-600">{sport.players}</span></span>
                    </div>
                    <Link href={`/tournaments?sport=${sport.slug}`}>
                      <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3">
                        View Tournaments
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-24 px-4 bg-white">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">Tournament Management Features</h2>
              <p className="text-xl text-gray-600">Professional tools for competitive sports management</p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {features.map((feature, index) => (
                <Card key={index} className="bg-white hover:shadow-lg transition-all duration-300 border border-gray-200">
                  <CardContent className="p-8 text-center">
                    <div className="text-4xl mb-4">{feature.icon}</div>
                    <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                    <p className="text-gray-600 leading-relaxed">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section className="py-24 px-4 bg-gray-50">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">Professional Testimonials</h2>
              <p className="text-xl text-gray-600">What tournament directors and coaches say about our platform</p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {testimonials.map((testimonial, index) => (
                <Card key={index} className="bg-white hover:shadow-lg transition-all duration-300 border border-gray-200">
                  <CardContent className="p-8">
                    <div className="text-4xl mb-4">{testimonial.avatar}</div>
                    <blockquote className="text-lg text-gray-700 mb-6 italic leading-relaxed">
                      &ldquo;{testimonial.quote}&rdquo;
                    </blockquote>
                    <div className="border-t pt-4">
                      <div className="font-semibold text-gray-900 text-lg">{testimonial.name}</div>
                      <div className="text-blue-600 font-medium">{testimonial.role}</div>
                      <div className="text-gray-500 text-sm">{testimonial.sport}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Quick Links */}
        <section className="py-24 px-4 bg-slate-900 text-white">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold mb-4">Tournament Management Tools</h2>
              <p className="text-xl text-gray-300">Essential features for competitive sports</p>
            </div>
            <div className="grid md:grid-cols-4 gap-8">
              <Link href="/schedules" className="group">
                <div className="bg-slate-800 rounded-lg p-8 text-center hover:bg-slate-700 transition-all duration-300 transform hover:-translate-y-1 border border-slate-700">
                  <div className="text-5xl mb-4 group-hover:scale-110 transition-transform duration-300">📅</div>
                  <h3 className="text-xl font-bold mb-3">Match Schedules</h3>
                  <p className="text-gray-300">Professional tournament scheduling and fixture management</p>
                </div>
              </Link>
              <Link href="/live-scores" className="group">
                <div className="bg-slate-800 rounded-lg p-8 text-center hover:bg-slate-700 transition-all duration-300 transform hover:-translate-y-1 border border-slate-700">
                  <div className="text-5xl mb-4 group-hover:scale-110 transition-transform duration-300">🔴</div>
                  <h3 className="text-xl font-bold mb-3">Live Scoring</h3>
                  <p className="text-gray-300">Real-time score updates and match tracking</p>
                </div>
              </Link>
              <Link href="/winners" className="group">
                <div className="bg-slate-800 rounded-lg p-8 text-center hover:bg-slate-700 transition-all duration-300 transform hover:-translate-y-1 border border-slate-700">
                  <div className="text-5xl mb-4 group-hover:scale-110 transition-transform duration-300">🏆</div>
                  <h3 className="text-xl font-bold mb-3">Results & Rankings</h3>
                  <p className="text-gray-300">Comprehensive tournament results and player rankings</p>
                </div>
              </Link>
              <Link href="/register" className="group">
                <div className="bg-slate-800 rounded-lg p-8 text-center hover:bg-slate-700 transition-all duration-300 transform hover:-translate-y-1 border border-slate-700">
                  <div className="text-5xl mb-4 group-hover:scale-110 transition-transform duration-300">📝</div>
                  <h3 className="text-xl font-bold mb-3">Player Registration</h3>
                  <p className="text-gray-300">Streamlined registration for tournaments and leagues</p>
                </div>
              </Link>
            </div>
          </div>
        </section>

        {/* Call to Action */}
        <section className="py-24 px-4 bg-blue-600 text-white">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl font-bold mb-6">Ready to Compete?</h2>
            <p className="text-xl mb-12 text-blue-100">
              Join our professional tournament management platform and elevate your competitive sports experience.
            </p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <Link href="/register">
                <Button size="lg" className="text-lg px-10 py-4 bg-white text-blue-600 hover:bg-gray-100 font-semibold shadow-lg hover:shadow-xl transition-all duration-300">
                  Register for Tournament
                </Button>
              </Link>
              <Link href="/tournaments">
                <Button size="lg" variant="outline" className="text-lg px-10 py-4 border-2 border-white text-white hover:bg-white hover:text-blue-600 font-semibold shadow-lg hover:shadow-xl transition-all duration-300">
                  View Active Tournaments
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
