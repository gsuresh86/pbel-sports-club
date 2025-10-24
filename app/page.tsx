import Link from 'next/link';
import { PublicLayout } from '@/components/PublicLayout';
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
    <PublicLayout hideAuth={true}>
      {/* Hero Section */}
      <section className="pt-24 pb-24 px-4 min-h-screen flex items-center justify-center overflow-hidden">
          <div className="max-w-7xl mx-auto text-center text-white">
            <div className="mb-8">
              <Badge variant="secondary" className="bg-blue-600/30 text-blue-100 border-blue-400/50 mb-6 px-8 py-3 text-lg backdrop-blur-sm">
                Professional Tournament Management
              </Badge>
            </div>
            <h1 className="text-6xl md:text-8xl font-bold mb-6 text-white drop-shadow-2xl">
              Tournament Craft
            </h1>
            <h2 className="text-3xl md:text-4xl font-semibold mb-8 text-blue-100 drop-shadow-lg">
              Tournament Management System
            </h2>
            <p className="text-xl md:text-2xl text-gray-200 mb-12 max-w-4xl mx-auto leading-relaxed drop-shadow-md">
              Professional-grade tournament management platform for competitive sports. 
              Advanced bracket systems, live scoring, and comprehensive analytics for serious athletes and organizers.
            </p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
              <Link href="/tournament">
                <Button size="lg" className="text-lg px-12 py-5 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-105">
                  View Active Tournaments
                </Button>
              </Link>
              <Link href="/register">
                <Button size="lg" variant="outline" className="text-lg px-12 py-5 border-2 text-blue-600 border-white hover:text-slate-900 font-semibold shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-105 backdrop-blur-sm">
                  Register for Tournament
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-24 px-4 bg-white/90 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-20">
              <h2 className="text-5xl font-bold text-gray-900 mb-6">Tournament Statistics</h2>
              <p className="text-xl text-gray-600">Professional sports management at scale</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {stats.map((stat, index) => (
                <div key={index} className="text-center group bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100">
                  <div className="text-5xl md:text-6xl font-bold text-blue-600 mb-4 group-hover:scale-110 transition-transform duration-300">
                    {stat.number}
                  </div>
                  <div className="text-xl font-semibold text-gray-900 mb-2">{stat.label}</div>
                  <div className="text-gray-600">{stat.description}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Sports Categories */}
        <section className="py-24 px-4 bg-white/80 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-20">
              <h2 className="text-5xl font-bold text-gray-900 mb-6">Professional Sports Leagues</h2>
              <p className="text-xl text-gray-600">Competitive tournaments with advanced management systems</p>
            </div>
            <div className="grid md:grid-cols-3 gap-10">
              {sports.map((sport, index) => (
                <Card key={sport.slug} className="bg-white hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-3 border border-gray-200 rounded-2xl overflow-hidden group">
                  <CardHeader className="text-center pb-6 bg-gradient-to-br from-blue-50 to-gray-50">
                    <div className="text-8xl mb-6 group-hover:scale-110 transition-transform duration-300">{sport.icon}</div>
                    <CardTitle className="text-3xl font-bold text-gray-900 mb-4">{sport.name}</CardTitle>
                    <CardDescription className="text-gray-600 text-lg leading-relaxed">
                      {sport.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6 p-8">
                    <div className="flex justify-between text-sm text-gray-500 bg-gray-50 rounded-lg p-4">
                      <span>Active Tournaments: <span className="font-semibold text-blue-600">{sport.tournaments}</span></span>
                      <span>Registered Players: <span className="font-semibold text-blue-600">{sport.players}</span></span>
                    </div>
                    <Link href={`/tournament?sport=${sport.slug}`}>
                      <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 text-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
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
        <section className="py-24 px-4 bg-white/90 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-20">
              <h2 className="text-5xl font-bold text-gray-900 mb-6">Tournament Management Features</h2>
              <p className="text-xl text-gray-600">Professional tools for competitive sports management</p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {features.map((feature, index) => (
                <Card key={index} className="bg-white hover:shadow-2xl transition-all duration-300 border border-gray-200 rounded-2xl overflow-hidden group">
                  <CardContent className="p-8 text-center">
                    <div className="text-6xl mb-6 group-hover:scale-110 transition-transform duration-300">{feature.icon}</div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-4">{feature.title}</h3>
                    <p className="text-gray-600 leading-relaxed text-lg">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section className="py-24 px-4 bg-white/80 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-20">
              <h2 className="text-5xl font-bold text-gray-900 mb-6">Professional Testimonials</h2>
              <p className="text-xl text-gray-600">What tournament directors and coaches say about our platform</p>
            </div>
            <div className="grid md:grid-cols-3 gap-10">
              {testimonials.map((testimonial, index) => (
                <Card key={index} className="bg-white hover:shadow-2xl transition-all duration-300 border border-gray-200 rounded-2xl overflow-hidden group">
                  <CardContent className="p-8">
                    <div className="text-6xl mb-6 group-hover:scale-110 transition-transform duration-300">{testimonial.avatar}</div>
                    <blockquote className="text-lg text-gray-700 mb-8 italic leading-relaxed">
                      &ldquo;{testimonial.quote}&rdquo;
                    </blockquote>
                    <div className="border-t pt-6">
                      <div className="font-semibold text-gray-900 text-xl">{testimonial.name}</div>
                      <div className="text-blue-600 font-medium text-lg">{testimonial.role}</div>
                      <div className="text-gray-500">{testimonial.sport}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Quick Links */}
        <section className="py-24 px-4 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 text-white relative overflow-hidden">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-5">
            <div className="absolute top-10 left-10 text-6xl">🏸</div>
            <div className="absolute top-20 right-20 text-5xl">🏓</div>
            <div className="absolute top-40 left-1/4 text-4xl">🏐</div>
            <div className="absolute top-60 right-1/3 text-5xl">🏆</div>
            <div className="absolute bottom-40 left-20 text-4xl">⚡</div>
            <div className="absolute bottom-20 right-10 text-6xl">🏸</div>
            <div className="absolute bottom-60 left-1/2 text-5xl">🏓</div>
            <div className="absolute top-1/2 left-10 text-4xl">🏐</div>
            <div className="absolute top-1/3 right-1/4 text-5xl">🏆</div>
          </div>
          
          <div className="max-w-7xl mx-auto relative z-10">
            <div className="text-center mb-20">
              <h2 className="text-5xl font-bold mb-6">Tournament Management Tools</h2>
              <p className="text-xl text-gray-300">Essential features for competitive sports</p>
            </div>
            <div className="grid md:grid-cols-4 gap-8">
              <Link href="/schedules" className="group">
                <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl p-8 text-center hover:bg-slate-700/80 transition-all duration-300 transform hover:-translate-y-2 border border-slate-700/50 shadow-xl hover:shadow-2xl">
                  <div className="text-6xl mb-6 group-hover:scale-110 transition-transform duration-300">📅</div>
                  <h3 className="text-2xl font-bold mb-4">Match Schedules</h3>
                  <p className="text-gray-300 text-lg">Professional tournament scheduling and fixture management</p>
                </div>
              </Link>
              <Link href="/live-scores" className="group">
                <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl p-8 text-center hover:bg-slate-700/80 transition-all duration-300 transform hover:-translate-y-2 border border-slate-700/50 shadow-xl hover:shadow-2xl">
                  <div className="text-6xl mb-6 group-hover:scale-110 transition-transform duration-300">🔴</div>
                  <h3 className="text-2xl font-bold mb-4">Live Scoring</h3>
                  <p className="text-gray-300 text-lg">Real-time score updates and match tracking</p>
                </div>
              </Link>
              <Link href="/winners" className="group">
                <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl p-8 text-center hover:bg-slate-700/80 transition-all duration-300 transform hover:-translate-y-2 border border-slate-700/50 shadow-xl hover:shadow-2xl">
                  <div className="text-6xl mb-6 group-hover:scale-110 transition-transform duration-300">🏆</div>
                  <h3 className="text-2xl font-bold mb-4">Results & Rankings</h3>
                  <p className="text-gray-300 text-lg">Comprehensive tournament results and player rankings</p>
                </div>
              </Link>
              <Link href="/register" className="group">
                <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl p-8 text-center hover:bg-slate-700/80 transition-all duration-300 transform hover:-translate-y-2 border border-slate-700/50 shadow-xl hover:shadow-2xl">
                  <div className="text-6xl mb-6 group-hover:scale-110 transition-transform duration-300">📝</div>
                  <h3 className="text-2xl font-bold mb-4">Player Registration</h3>
                  <p className="text-gray-300 text-lg">Streamlined registration for tournaments and leagues</p>
                </div>
              </Link>
            </div>
          </div>
        </section>

        {/* Call to Action */}
        <section className="py-24 px-4 bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 text-white relative overflow-hidden">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-10 left-10 text-6xl">🏸</div>
            <div className="absolute top-20 right-20 text-5xl">🏓</div>
            <div className="absolute top-40 left-1/4 text-4xl">🏐</div>
            <div className="absolute top-60 right-1/3 text-5xl">🏆</div>
            <div className="absolute bottom-40 left-20 text-4xl">⚡</div>
            <div className="absolute bottom-20 right-10 text-6xl">🏸</div>
            <div className="absolute bottom-60 left-1/2 text-5xl">🏓</div>
            <div className="absolute top-1/2 left-10 text-4xl">🏐</div>
            <div className="absolute top-1/3 right-1/4 text-5xl">🏆</div>
          </div>
          
          <div className="max-w-4xl mx-auto text-center relative z-10">
            <h2 className="text-5xl font-bold mb-8">Ready to Compete?</h2>
            <p className="text-2xl mb-12 text-blue-100">
              Join our professional tournament management platform and elevate your competitive sports experience.
            </p>
            <div className="flex flex-col sm:flex-row gap-8 justify-center">
              <Link href="/register">
                <Button size="lg" className="text-xl px-12 py-6 font-semibold shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-105">
                  Register for Tournament
                </Button>
              </Link>
              <Link href="/tournament">
                <Button size="lg" variant="outline" className="text-xl px-12 py-6 border-2 text-blue-800 border-white hover:bg-white hover:text-blue-600 font-semibold shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-105 backdrop-blur-sm">
                  View Active Tournaments
                </Button>
              </Link>
            </div>
          </div>
        </section>

      </PublicLayout>
  );
}
