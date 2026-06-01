import Link from 'next/link';
import { PublicLayout } from '@/components/PublicLayout';
import { ChevronRight } from 'lucide-react';

const SPORTS = [
  {
    name: 'Badminton',
    emoji: '🏸',
    bar: 'from-yellow-500 to-amber-500',
    desc: 'Singles, doubles, and mixed doubles across all skill levels',
    href: '/tournament',
  },
  {
    name: 'Table Tennis',
    emoji: '🏓',
    bar: 'from-blue-500 to-cyan-500',
    desc: 'Competitive table tennis with live scoring and brackets',
    href: '/tournament',
  },
  {
    name: 'Volleyball',
    emoji: '🏐',
    bar: 'from-purple-500 to-violet-500',
    desc: 'Team volleyball with pool stages and knockout rounds',
    href: '/tournament',
  },
  {
    name: 'Throw Ball',
    emoji: '🎯',
    bar: 'from-pink-500 to-rose-500',
    desc: 'Community throw ball with team and open categories',
    href: '/tournament',
  },
];

const QUICK_LINKS = [
  {
    emoji: '📅',
    label: 'Schedules',
    desc: 'Upcoming fixtures and court assignments',
    href: '/schedules',
    border: 'hover:border-blue-400/40',
  },
  {
    emoji: '🔴',
    label: 'Live Scores',
    desc: 'Real-time updates for ongoing matches',
    href: '/live-scores',
    border: 'hover:border-red-400/40',
    live: true,
  },
  {
    emoji: '🏆',
    label: 'Winners',
    desc: 'Results, brackets, and champion gallery',
    href: '/winners',
    border: 'hover:border-yellow-400/40',
  },
  {
    emoji: '📝',
    label: 'Register',
    desc: 'Join an upcoming tournament or event',
    href: '/tournament',
    border: 'hover:border-green-400/40',
  },
];

export default function Home() {
  return (
    <PublicLayout hideAuth={true}>

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="min-h-screen flex items-center justify-center px-4 pt-16 pb-12">
        <div className="max-w-4xl mx-auto w-full text-center">

          {/* Pill label */}
          <div className="flex justify-center mb-8">
            <span className="inline-flex items-center gap-2 bg-yellow-400/10 border border-yellow-400/30 text-yellow-300 text-xs font-bold px-5 py-2 rounded-full uppercase tracking-widest">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
              PBEL City · Hyderabad
            </span>
          </div>

          {/* Main title */}
          <h1 className="text-5xl sm:text-7xl md:text-8xl font-black text-white leading-none tracking-tight mb-2">
            PBEL
          </h1>
          <h1 className="text-5xl sm:text-7xl md:text-8xl font-black leading-none tracking-tight mb-6">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500">
              Sports Club
            </span>
          </h1>

          <p className="text-slate-400 text-base sm:text-lg max-w-xl mx-auto mb-10 leading-relaxed">
            Your community sports hub for residents. Tournaments, live scores, brackets, and more — all in one place.
          </p>

          {/* Sport chips */}
          <div className="flex flex-wrap justify-center gap-2 mb-10">
            {['🏸 Badminton', '🏓 Table Tennis', '🏐 Volleyball', '🎯 Throw Ball'].map(s => (
              <span key={s} className="text-xs text-slate-400 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full">
                {s}
              </span>
            ))}
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href="/tournament">
              <div className="inline-flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-black font-black px-8 py-4 rounded-full text-sm shadow-2xl shadow-yellow-400/30 transition-all duration-200 hover:scale-105">
                View Tournaments <ChevronRight className="h-4 w-4" />
              </div>
            </Link>
            <Link href="/live-scores">
              <div className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white font-bold px-8 py-4 rounded-full text-sm transition-all duration-200">
                <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                Live Scores
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Quick access ──────────────────────────────────────────────── */}
      <section className="py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs text-yellow-400 font-bold uppercase tracking-widest text-center mb-6">Quick Access</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {QUICK_LINKS.map(ql => (
              <Link key={ql.href + ql.label} href={ql.href}>
                <div className={`group h-full bg-black/30 backdrop-blur-md rounded-2xl border border-white/5 ${ql.border} p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl cursor-pointer`}>
                  <div className="text-3xl mb-3">{ql.emoji}</div>
                  <h3 className="text-sm font-black text-white mb-1 group-hover:text-yellow-400 transition-colors flex items-center gap-1.5">
                    {ql.label}
                    {ql.live && <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />}
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{ql.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Sports ────────────────────────────────────────────────────── */}
      <section className="py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <p className="text-xs text-yellow-400 font-bold uppercase tracking-widest mb-2">Sports</p>
            <h2 className="text-3xl font-black text-white">What We Play</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {SPORTS.map(s => (
              <Link key={s.name} href={s.href}>
                <div className="group relative bg-slate-900/70 backdrop-blur-sm rounded-2xl border border-white/5 overflow-hidden hover:border-white/15 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer">
                  <div className={`h-1 bg-gradient-to-r ${s.bar}`} />
                  <div className="p-5">
                    <div className="text-4xl mb-3">{s.emoji}</div>
                    <h3 className="text-sm font-black text-white mb-2 group-hover:text-yellow-400 transition-colors">
                      {s.name}
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed">{s.desc}</p>
                    <div className="mt-4 flex items-center gap-1 text-xs text-yellow-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                      Browse <ChevronRight className="h-3 w-3" />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA strip ─────────────────────────────────────────────────── */}
      <section className="py-16 px-4 pb-20">
        <div className="max-w-5xl mx-auto">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-yellow-400/15 via-amber-500/5 to-transparent border border-yellow-400/20 p-10 sm:p-14 text-center">
            {/* Glow orb */}
            <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-72 h-72 bg-yellow-400/8 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10">
              <p className="text-5xl mb-5">🏆</p>
              <h2 className="text-3xl sm:text-4xl font-black text-white mb-3">Ready to Compete?</h2>
              <p className="text-slate-400 text-sm mb-8 max-w-sm mx-auto leading-relaxed">
                Register for an upcoming tournament and represent your tower. All skill levels welcome.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/tournament">
                  <div className="inline-flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-black font-black px-7 py-3.5 rounded-full text-sm shadow-lg shadow-yellow-400/25 transition-all duration-200 hover:scale-105">
                    Browse Tournaments <ChevronRight className="h-4 w-4" />
                  </div>
                </Link>
                <Link href="/schedules">
                  <div className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white font-bold px-7 py-3.5 rounded-full text-sm transition-all duration-200">
                    View Schedule
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

    </PublicLayout>
  );
}
