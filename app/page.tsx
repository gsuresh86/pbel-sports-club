import Link from 'next/link';
import { PublicLayout } from '@/components/PublicLayout';
import { HostTournamentForm } from '@/components/public/HostTournamentForm';
import { TestimonialsSection } from '@/components/public/TestimonialsSection';
import {
  ChevronRight,
  Trophy,
  Users,
  Zap,
  Star,
  Phone,
  Mail,
  MapPin,
  MessageCircle,
  CheckCircle2,
  Calendar,
  BarChart3,
  QrCode,
  Shuffle,
} from 'lucide-react';

const STATS = [
  { value: '50+', label: 'Tournaments Hosted', emoji: '🏆', color: 'text-yellow-400', glow: 'shadow-yellow-400/20' },
  { value: '2,000+', label: 'Players Registered', emoji: '👥', color: 'text-blue-400', glow: 'shadow-blue-400/20' },
  { value: '∞', label: 'Sports Supported', emoji: '🎮', color: 'text-green-400', glow: 'shadow-green-400/20' },
  { value: '500+', label: 'Matches Completed', emoji: '⚡', color: 'text-purple-400', glow: 'shadow-purple-400/20' },
];

const STEPS = [
  {
    step: '01',
    icon: Trophy,
    title: 'Create Your Tournament',
    desc: 'Set up your event in minutes — name, sport, format, dates, and registration details. Zero technical knowledge required.',
    accentBg: 'bg-yellow-500/10',
    accentBorder: 'border-yellow-500/60',
    accentText: 'text-yellow-400',
    dot: 'bg-yellow-400',
  },
  {
    step: '02',
    icon: Users,
    title: 'Players Register Online',
    desc: 'Share your custom registration link. Players sign up, submit details, and track their approval status — all in one place.',
    accentBg: 'bg-blue-500/10',
    accentBorder: 'border-blue-500/60',
    accentText: 'text-blue-400',
    dot: 'bg-blue-400',
  },
  {
    step: '03',
    icon: Shuffle,
    title: 'Smart Draws & Pools',
    desc: 'Use our spin-wheel draw system. Auto-assign teams, configure round-robin pools and knockout brackets in seconds.',
    accentBg: 'bg-purple-500/10',
    accentBorder: 'border-purple-500/60',
    accentText: 'text-purple-400',
    dot: 'bg-purple-400',
  },
  {
    step: '04',
    icon: Star,
    title: 'Live Play & Champions',
    desc: 'Score matches in real time, standings update instantly. Crown your champions and publish results with a single click.',
    accentBg: 'bg-rose-500/10',
    accentBorder: 'border-rose-500/60',
    accentText: 'text-rose-400',
    dot: 'bg-rose-400',
  },
];

const FEATURES = [
  {
    icon: Shuffle,
    title: 'Smart Team Draw',
    desc: 'Spin-wheel player assignment with skill-level balancing across teams and pools — fair by design.',
    border: 'border-yellow-400/30',
    bar: 'from-yellow-500 to-amber-500',
    text: 'text-yellow-400',
  },
  {
    icon: BarChart3,
    title: 'Pool & Bracket Play',
    desc: 'Configure group stages, round-robin pools, and knockout brackets in minutes. Multiple formats supported.',
    border: 'border-blue-400/30',
    bar: 'from-blue-500 to-cyan-500',
    text: 'text-blue-400',
  },
  {
    icon: Zap,
    title: 'Live Scoring',
    desc: 'Real-time match scores visible to all participants as games happen. No refresh, no delays.',
    border: 'border-red-400/30',
    bar: 'from-red-500 to-rose-500',
    text: 'text-red-400',
  },
  {
    icon: QrCode,
    title: 'Online Registration',
    desc: 'Custom forms with payment tracking, approval workflows, and digital QR codes for each participant.',
    border: 'border-green-400/30',
    bar: 'from-green-500 to-emerald-500',
    text: 'text-green-400',
  },
  {
    icon: Trophy,
    title: 'Results & Winners',
    desc: 'Automatic standings, podium results, and a champion gallery published after every event.',
    border: 'border-amber-400/30',
    bar: 'from-amber-500 to-orange-500',
    text: 'text-amber-400',
  },
  {
    icon: Calendar,
    title: 'Schedule Management',
    desc: 'Court assignments, match schedules, and fixture lists — organized and shareable at a glance.',
    border: 'border-purple-400/30',
    bar: 'from-purple-500 to-violet-500',
    text: 'text-purple-400',
  },
];

const SPORTS = [
  {
    name: 'Badminton',
    emoji: '🏸',
    bar: 'from-yellow-500 to-amber-500',
    shadow: 'shadow-yellow-500/20',
    desc: 'Singles, doubles, mixed doubles and team events across all skill levels',
  },
  {
    name: 'Table Tennis',
    emoji: '🏓',
    bar: 'from-blue-500 to-cyan-500',
    shadow: 'shadow-blue-500/20',
    desc: 'Competitive table tennis with live scoring and bracket management',
  },
  {
    name: 'Volleyball',
    emoji: '🏐',
    bar: 'from-purple-500 to-violet-500',
    shadow: 'shadow-purple-500/20',
    desc: 'Team volleyball with pool stages and knockout rounds',
  },
  {
    name: 'Throw Ball',
    emoji: '🎯',
    bar: 'from-pink-500 to-rose-500',
    shadow: 'shadow-pink-500/20',
    desc: 'Team and open categories with full bracket and scoring support',
  },
];

const HOST_BENEFITS = [
  'Zero setup cost — completely free to start',
  'End-to-end management from registration to results',
  'Scales from 10 to 1,000+ participants',
  'Dedicated support during your event',
  'Export reports and player data anytime',
  'Live scoreboard visible to all attendees',
];

const CONTACT = [
  {
    icon: Mail,
    label: 'Email Us',
    value: 'gsuresh86@gmail.com',
    href: 'mailto:gsuresh86@gmail.com',
    color: 'text-yellow-400',
    border: 'border-yellow-400/20',
    bg: 'bg-yellow-400/8',
  },
  {
    icon: Phone,
    label: 'Call Us',
    value: '+91 9000236824',
    href: 'tel:+919000236824',
    color: 'text-blue-400',
    border: 'border-blue-400/20',
    bg: 'bg-blue-400/8',
  },
  {
    icon: MessageCircle,
    label: 'WhatsApp',
    value: 'Chat with us instantly',
    href: 'https://wa.me/919000236824',
    color: 'text-green-400',
    border: 'border-green-400/20',
    bg: 'bg-green-400/8',
  },
  {
    icon: MapPin,
    label: 'Location',
    value: 'PBEL City, Kokapet, Hyderabad — 500075',
    href: 'https://maps.google.com/?q=PBEL+City+Kokapet+Hyderabad',
    color: 'text-purple-400',
    border: 'border-purple-400/20',
    bg: 'bg-purple-400/8',
  },
];

export default function Home() {
  return (
    <PublicLayout hideAuth={true}>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center justify-center px-4 pt-24 pb-16">

        <div className="relative z-10 max-w-5xl mx-auto w-full text-center">

          {/* Live badge */}
          <div className="flex justify-center mb-8">
            <span className="inline-flex items-center gap-2 bg-slate-800 border border-yellow-400/50 text-yellow-300 text-xs font-bold px-5 py-2 rounded-full uppercase tracking-widest">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
              Your Community&apos;s Sports Stage
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-6xl sm:text-8xl md:text-9xl font-black text-white leading-[0.9] tracking-tight mb-3">
            Manch
          </h1>
          <h1 className="text-6xl sm:text-8xl md:text-9xl font-black leading-[0.9] tracking-tight mb-8">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-300 to-orange-400">
              play
            </span>
          </h1>

          {/* Subhead */}
          <p className="text-slate-100 text-lg sm:text-xl max-w-2xl mx-auto mb-4 leading-relaxed font-medium">
            Run any sports tournament <span className="text-yellow-400 font-bold">end-to-end</span> — from the first registration to the final podium — for clubs, communities, and organisations of any size.
          </p>

          {/* Sport chips */}
          <div className="flex flex-wrap justify-center gap-2 mb-10">
            {['🏸 Badminton', '🏓 Table Tennis', '🏐 Volleyball', '🎯 Throw Ball'].map(s => (
              <span key={s} className="text-sm text-slate-100 bg-slate-800 border border-slate-600 px-4 py-1.5 rounded-full font-medium">
                {s}
              </span>
            ))}
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href="/tournament">
              <div className="group inline-flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-black font-black px-8 py-4 rounded-full text-sm shadow-2xl shadow-yellow-400/30 transition-all duration-200 hover:scale-105">
                Browse Tournaments
                <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>
            <a href="#host">
              <div className="inline-flex items-center gap-2 bg-white/8 hover:bg-white/15 border border-white/20 hover:border-white/35 text-white font-bold px-8 py-4 rounded-full text-sm backdrop-blur-sm transition-all duration-200 hover:scale-105">
                Host a Tournament
                <ChevronRight className="h-4 w-4" />
              </div>
            </a>
          </div>

          {/* Scroll hint */}
          <div className="mt-16 flex justify-center">
            <div className="flex flex-col items-center gap-2 opacity-40">
              <div className="w-px h-10 bg-gradient-to-b from-transparent via-white to-transparent" />
              <span className="text-xs text-slate-400 uppercase tracking-widest">Explore</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ────────────────────────────────────────────────────────── */}
      <section className="py-10 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {STATS.map(s => (
              <div key={s.label} className={`group relative bg-slate-800 rounded-2xl border border-slate-600 hover:border-slate-500 p-6 text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${s.glow}`}>
                <div className="text-3xl mb-2">{s.emoji}</div>
                <div className={`text-3xl sm:text-4xl font-black mb-1 ${s.color}`}>{s.value}</div>
                <div className="text-sm text-slate-100 font-semibold uppercase tracking-wide">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────────────────────────── */}
      <section className="py-16 px-4 bg-slate-900">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs text-yellow-400 font-bold uppercase tracking-widest mb-3">How It Works</p>
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-4">From Idea to Champions</h2>
            <p className="text-slate-200 text-base max-w-xl mx-auto leading-relaxed">
              Run a complete sports tournament in four simple steps. No spreadsheets. No chaos.
            </p>
          </div>

          {/* Steps */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.step} className={`group relative bg-slate-800 border-2 ${step.accentBorder} rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl`}>
                  {/* Connector line (desktop) */}
                  {i < STEPS.length - 1 && (
                    <div className="hidden lg:block absolute top-10 -right-2.5 w-5 h-px bg-white/20 z-10" />
                  )}
                  <div className="flex items-center justify-between mb-4">
                    <div className={`text-4xl font-black ${step.accentText} opacity-50 leading-none`}>{step.step}</div>
                    <div className={`w-9 h-9 rounded-xl ${step.accentBg} border ${step.accentBorder} flex items-center justify-center`}>
                      <Icon className={`h-4 w-4 ${step.accentText}`} />
                    </div>
                  </div>
                  <h3 className="text-base font-black text-white mb-2">{step.title}</h3>
                  <p className="text-sm text-slate-100 leading-relaxed">{step.desc}</p>
                  <div className={`mt-4 w-8 h-0.5 bg-gradient-to-r ${step.dot === 'bg-yellow-400' ? 'from-yellow-400' : step.dot === 'bg-blue-400' ? 'from-blue-400' : step.dot === 'bg-purple-400' ? 'from-purple-400' : 'from-rose-400'} to-transparent`} />
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs text-yellow-400 font-bold uppercase tracking-widest mb-3">Platform Features</p>
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-4">Everything You Need</h2>
            <p className="text-slate-200 text-base max-w-xl mx-auto leading-relaxed">
              Every tool a tournament organiser needs — built in, ready to go, no configuration nightmare.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(f => {
              const Icon = f.icon;
              return (
                <div key={f.title} className={`group relative bg-slate-800 border-2 ${f.border} rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-xl overflow-hidden`}>
                  <div className={`h-1.5 bg-gradient-to-r ${f.bar}`} />
                  <div className="p-6 pt-5">
                    <div className={`w-11 h-11 rounded-xl bg-slate-900 border ${f.border} flex items-center justify-center mb-4`}>
                      <Icon className={`h-5 w-5 ${f.text}`} />
                    </div>
                    <h3 className="text-base font-black text-white mb-2">{f.title}</h3>
                    <p className="text-sm text-slate-100 leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Sports ───────────────────────────────────────────────────────── */}
      <section className="py-16 px-4 bg-slate-900">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs text-yellow-400 font-bold uppercase tracking-widest mb-3">Supported Sports</p>
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-4">Built for Multiple Sports</h2>
            <p className="text-slate-200 text-base max-w-xl mx-auto leading-relaxed">
              One platform that understands the rules and format of each sport you love.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {SPORTS.map(s => (
              <Link key={s.name} href="/tournament">
                <div className={`group relative bg-slate-800 rounded-2xl border border-slate-600 hover:border-slate-500 hover:shadow-2xl ${s.shadow} transition-all duration-300 hover:-translate-y-1.5 cursor-pointer overflow-hidden`}>
                  <div className={`h-1.5 bg-gradient-to-r ${s.bar}`} />
                  <div className="p-6">
                    <div className="text-5xl mb-4">{s.emoji}</div>
                    <h3 className="text-base font-black text-white mb-2 group-hover:text-yellow-400 transition-colors">{s.name}</h3>
                    <p className="text-sm text-slate-100 leading-relaxed mb-4">{s.desc}</p>
                    <div className="flex items-center gap-1 text-xs text-yellow-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                      View tournaments <ChevronRight className="h-3 w-3" />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ─────────────────────────────────────────────────── */}
      <TestimonialsSection />

      {/* ── Quick Access ─────────────────────────────────────────────────── */}
      <section className="py-8 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-3 gap-4">
            {[
              { emoji: '📅', label: 'Schedules', desc: 'Fixtures & court assignments', href: '/schedules', border: 'border-blue-400/20', hover: 'hover:border-blue-400/40' },
              { emoji: '🏆', label: 'Winners', desc: 'Results & champion gallery', href: '/winners', border: 'border-yellow-400/20', hover: 'hover:border-yellow-400/40' },
              { emoji: '📝', label: 'Register', desc: 'Join an upcoming tournament', href: '/tournament', border: 'border-green-400/20', hover: 'hover:border-green-400/40' },
            ].map(ql => (
              <Link key={ql.label} href={ql.href}>
                <div className={`group h-full bg-slate-800 rounded-2xl border border-slate-600 ${ql.hover} p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl cursor-pointer`}>
                  <div className="text-3xl mb-3">{ql.emoji}</div>
                  <h3 className="text-sm font-black text-white mb-1 group-hover:text-yellow-400 transition-colors">{ql.label}</h3>
                  <p className="text-sm text-slate-100 leading-relaxed hidden sm:block">{ql.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Host a Tournament ─────────────────────────────────────────────── */}
      <section id="host" className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="relative overflow-hidden rounded-3xl border border-slate-600 bg-slate-800 shadow-xl">

            <div className="relative z-10 grid lg:grid-cols-2 gap-0">

              {/* Left — pitch */}
              <div className="p-10 sm:p-14 lg:pr-8">
                <p className="text-xs text-yellow-400 font-bold uppercase tracking-widest mb-4">Host on Manchplay</p>
                <h2 className="text-4xl sm:text-5xl font-black text-white mb-5 leading-tight">
                  Ready to Run Your Tournament?
                </h2>
                <p className="text-slate-100 text-base mb-8 leading-relaxed">
                  Whether you&apos;re organising a small community event or a large multi-sport championship — Manchplay gives you the tools, without the complexity.
                </p>

                {/* Benefits */}
                <ul className="space-y-3 mb-8">
                  {HOST_BENEFITS.map(b => (
                    <li key={b} className="flex items-start gap-3">
                      <CheckCircle2 className="h-4 w-4 text-yellow-400 mt-0.5 shrink-0" />
                      <span className="text-sm text-slate-100">{b}</span>
                    </li>
                  ))}
                </ul>

                {/* Trust strip */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: '50+', label: 'Events Run' },
                    { value: '2k+', label: 'Players' },
                    { value: '100%', label: 'Free' },
                  ].map(s => (
                    <div key={s.label} className="bg-slate-900 border border-slate-600 rounded-xl p-3 text-center">
                      <p className="text-xl font-black text-yellow-400">{s.value}</p>
                      <p className="text-xs text-slate-200 mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right — form */}
              <div className="bg-slate-900 lg:border-l border-slate-600 p-10 sm:p-14 lg:pl-8 rounded-b-3xl lg:rounded-bl-none lg:rounded-r-3xl">
                <p className="text-sm font-black text-white mb-1">Register Your Interest</p>
                <p className="text-sm text-slate-200 mb-6">Fill in the form and our team will get back to you within 24 hours.</p>
                <HostTournamentForm />
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* ── Contact ──────────────────────────────────────────────────────── */}
      <section id="contact" className="py-16 px-4 bg-slate-900">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs text-yellow-400 font-bold uppercase tracking-widest mb-3">Get In Touch</p>
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-4">Contact Us</h2>
            <p className="text-slate-200 text-base max-w-md mx-auto">
              Have questions? We&apos;re happy to help you get your tournament off the ground.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {CONTACT.map(c => {
              const Icon = c.icon;
              return (
                <a key={c.label} href={c.href} target="_blank" rel="noreferrer"
                  className="group block bg-slate-800 border border-slate-600 hover:border-slate-500 rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-600 flex items-center justify-center mb-4">
                    <Icon className={`h-5 w-5 ${c.color}`} />
                  </div>
                  <p className="text-xs font-bold text-slate-200 uppercase tracking-wide mb-1">{c.label}</p>
                  <p className="text-sm font-semibold text-white group-hover:text-yellow-400 transition-colors">{c.value}</p>
                </a>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <section className="py-12 px-4 pb-8">
        <div className="max-w-5xl mx-auto">
          <div className="relative overflow-hidden rounded-3xl bg-slate-800 border border-slate-600 p-10 sm:p-14 text-center shadow-xl">
            <div className="relative z-10">
              <div className="text-5xl mb-5">🏆</div>
              <h2 className="text-4xl sm:text-5xl font-black text-white mb-4">Your Tournament Awaits</h2>
              <p className="text-slate-100 text-base mb-8 max-w-lg mx-auto leading-relaxed">
                Browse active tournaments, view schedules, and register as a player — or <a href="#host" className="text-yellow-400 font-bold hover:underline">host your own event</a> with Manchplay.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/tournament">
                  <div className="inline-flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-black font-black px-8 py-4 rounded-full text-sm shadow-lg shadow-yellow-400/25 transition-all duration-200 hover:scale-105">
                    Browse Tournaments <ChevronRight className="h-4 w-4" />
                  </div>
                </Link>
                <Link href="/schedules">
                  <div className="inline-flex items-center gap-2 bg-white/8 hover:bg-white/15 border border-white/15 hover:border-white/25 text-white font-bold px-8 py-4 rounded-full text-sm transition-all duration-200 hover:scale-105">
                    View Schedule
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="py-10 px-4 border-t border-slate-700 bg-[#020617]">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-yellow-400/15 border border-yellow-400/30 flex items-center justify-center">
                <Trophy className="h-4 w-4 text-yellow-400" />
              </div>
              <div>
                <p className="text-sm font-black text-white">Manchplay</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              {[
                { label: 'Tournaments', href: '/tournament' },
                { label: 'Schedules', href: '/schedules' },
                { label: 'Winners', href: '/winners' },
                { label: 'Login', href: '/login' },
              ].map(l => (
                <Link key={l.label} href={l.href}
                  className="text-sm text-slate-300 hover:text-yellow-400 transition-colors font-medium">
                  {l.label}
                </Link>
              ))}
            </div>
            <p className="text-sm text-slate-400">© 2026 Manchplay</p>
          </div>
        </div>
      </footer>

    </PublicLayout>
  );
}
