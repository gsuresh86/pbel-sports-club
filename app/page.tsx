import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { PublicLayout } from '@/components/PublicLayout';
import { HostTournamentForm } from '@/components/public/HostTournamentForm';
import { TestimonialsSection } from '@/components/public/TestimonialsSection';
import { Reveal } from '@/components/public/Reveal';
import { AnimatedCounter } from '@/components/public/AnimatedCounter';
import { JsonLd } from '@/components/public/JsonLd';
import { HeroSportsBackground } from '@/components/public/HeroSportsBackground';
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

export const metadata: Metadata = {
  title: {
    absolute: 'TourneyCraft — Run Sports Tournaments End to End',
  },
  description:
    'Run any sports tournament end-to-end — from the first registration to the final podium — for clubs, communities, and organisations of any size.',
  alternates: { canonical: 'https://www.tourneycraft.app/' },
  openGraph: {
    title: 'TourneyCraft — Run Sports Tournaments End to End',
    description:
      'Online registration, smart draws, live scoring, and results — all in one place.',
    url: 'https://www.tourneycraft.app/',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'TourneyCraft — Run Sports Tournaments End to End',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TourneyCraft — Run Sports Tournaments End to End',
    description:
      'Online registration, smart draws, live scoring, and results — all in one place.',
    images: ['/twitter-image'],
  },
};

type StatItem =
  | { kind: 'count'; value: number; suffix: string; label: string; color: string }
  | { kind: 'text'; display: string; label: string; color: string };

const STATS: StatItem[] = [
  { kind: 'count', value: 50, suffix: '+', label: 'Tournaments Hosted', color: 'text-amber-500' },
  { kind: 'count', value: 2000, suffix: '+', label: 'Players Registered', color: 'text-sky-600 dark:text-sky-400' },
  { kind: 'text', display: '∞', label: 'Sports Supported', color: 'text-emerald-600 dark:text-emerald-400' },
  { kind: 'count', value: 500, suffix: '+', label: 'Matches Completed', color: 'text-rose-600 dark:text-rose-400' },
];

const STEPS = [
  {
    step: '01',
    icon: Trophy,
    title: 'Create Your Tournament',
    desc: 'Set up your event in minutes — name, sport, format, dates, and registration details. Zero technical knowledge required.',
    accentText: 'text-amber-500',
    accentBg: 'bg-amber-500/10',
    accentBorder: 'border-amber-500/40',
  },
  {
    step: '02',
    icon: Users,
    title: 'Players Register Online',
    desc: 'Share your custom registration link. Players sign up, submit details, and track their approval status — all in one place.',
    accentText: 'text-sky-600 dark:text-sky-400',
    accentBg: 'bg-sky-500/10',
    accentBorder: 'border-sky-500/40',
  },
  {
    step: '03',
    icon: Shuffle,
    title: 'Smart Draws & Pools',
    desc: 'Use our spin-wheel draw system. Auto-assign teams, configure round-robin pools and knockout brackets in seconds.',
    accentText: 'text-violet-600 dark:text-violet-400',
    accentBg: 'bg-violet-500/10',
    accentBorder: 'border-violet-500/40',
  },
  {
    step: '04',
    icon: Star,
    title: 'Live Play & Champions',
    desc: 'Score matches in real time, standings update instantly. Crown your champions and publish results with a single click.',
    accentText: 'text-rose-600 dark:text-rose-400',
    accentBg: 'bg-rose-500/10',
    accentBorder: 'border-rose-500/40',
  },
];

const FEATURES = [
  {
    icon: Shuffle,
    title: 'Smart Team Draw',
    desc: 'Spin-wheel player assignment with skill-level balancing across teams and pools — fair by design.',
    border: 'border-amber-500/30',
    bar: 'from-amber-500 to-yellow-500',
    text: 'text-amber-500',
  },
  {
    icon: BarChart3,
    title: 'Pool & Bracket Play',
    desc: 'Configure group stages, round-robin pools, and knockout brackets in minutes. Multiple formats supported.',
    border: 'border-sky-500/30',
    bar: 'from-sky-500 to-cyan-500',
    text: 'text-sky-600 dark:text-sky-400',
  },
  {
    icon: Zap,
    title: 'Live Scoring',
    desc: 'Real-time match scores visible to all participants as games happen. No refresh, no delays.',
    border: 'border-rose-500/30',
    bar: 'from-rose-500 to-orange-500',
    text: 'text-rose-600 dark:text-rose-400',
  },
  {
    icon: QrCode,
    title: 'Online Registration',
    desc: 'Custom forms with payment tracking, approval workflows, and digital QR codes for each participant.',
    border: 'border-emerald-500/30',
    bar: 'from-emerald-500 to-teal-500',
    text: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    icon: Trophy,
    title: 'Results & Winners',
    desc: 'Automatic standings, podium results, and a champion gallery published after every event.',
    border: 'border-amber-500/30',
    bar: 'from-amber-500 to-orange-500',
    text: 'text-amber-500',
  },
  {
    icon: Calendar,
    title: 'Schedule Management',
    desc: 'Court assignments, match schedules, and fixture lists — organized and shareable at a glance.',
    border: 'border-indigo-500/30',
    bar: 'from-indigo-500 to-blue-500',
    text: 'text-indigo-600 dark:text-indigo-400',
  },
];

const SPORTS = [
  {
    name: 'Badminton',
    bar: 'from-amber-500 to-yellow-500',
    desc: 'Singles, doubles, mixed doubles and team events across all skill levels',
  },
  {
    name: 'Table Tennis',
    bar: 'from-sky-500 to-cyan-500',
    desc: 'Competitive table tennis with live scoring and bracket management',
  },
  {
    name: 'Volleyball',
    bar: 'from-indigo-500 to-blue-500',
    desc: 'Team volleyball with pool stages and knockout rounds',
  },
  {
    name: 'Throw Ball',
    bar: 'from-rose-500 to-orange-500',
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
    color: 'text-amber-500',
  },
  {
    icon: Phone,
    label: 'Call Us',
    value: '+91 9000236824',
    href: 'tel:+919000236824',
    color: 'text-sky-600 dark:text-sky-400',
  },
  {
    icon: MessageCircle,
    label: 'WhatsApp',
    value: 'Chat with us instantly',
    href: 'https://wa.me/919000236824',
    color: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    icon: MapPin,
    label: 'Location',
    value: 'PBEL City, Kokapet, Hyderabad — 500075',
    href: 'https://maps.google.com/?q=PBEL+City+Kokapet+Hyderabad',
    color: 'text-indigo-600 dark:text-indigo-400',
  },
];

const jsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'SportsOrganization',
    name: 'TourneyCraft',
    url: 'https://tourneycraft.app',
    logo: 'https://tourneycraft.app/logo.png',
    description:
      'TourneyCraft helps clubs, communities, and organisations run sports tournaments end to end.',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Hyderabad',
      addressRegion: 'Telangana',
      postalCode: '500075',
      addressCountry: 'IN',
      streetAddress: 'PBEL City, Kokapet',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+91-9000236824',
      contactType: 'customer support',
      email: 'gsuresh86@gmail.com',
      areaServed: 'IN',
    },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'TourneyCraft',
    url: 'https://tourneycraft.app',
    potentialAction: {
      '@type': 'SearchAction',
      target: 'https://tourneycraft.app/tournament?q={search_term_string}',
      'query-input': 'required name=search_term_string',
    },
  },
];

export default function Home() {
  return (
    <PublicLayout>
      <JsonLd data={jsonLd} />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center justify-center px-4 pt-24 pb-16 overflow-hidden">
        <HeroSportsBackground />
        <div className="relative z-10 max-w-5xl mx-auto w-full text-center">
          <div className="flex justify-center mb-8">
            <span className="inline-flex items-center gap-2 bg-card/80 backdrop-blur-sm border border-amber-500/40 text-amber-600 dark:text-amber-300 text-xs font-bold px-5 py-2 rounded-full uppercase tracking-widest">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Your Community&apos;s Sports Stage
            </span>
          </div>

          <h1 className="text-6xl sm:text-8xl md:text-9xl font-black text-foreground leading-[0.9] tracking-tight mb-8 drop-shadow-sm">
            Tourney
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-amber-500 via-yellow-400 to-orange-500">
              Craft
            </span>
          </h1>

          <p className="text-foreground/85 text-lg sm:text-xl max-w-2xl mx-auto mb-4 leading-relaxed font-medium">
            Run any sports tournament{' '}
            <span className="text-amber-600 dark:text-amber-400 font-bold">end-to-end</span> — from
            the first registration to the final podium — for clubs, communities, and organisations
            of any size.
          </p>

          <div className="flex flex-wrap justify-center gap-2 mb-10">
            {['Badminton', 'Table Tennis', 'Volleyball', 'Throw Ball'].map((s) => (
              <span
                key={s}
                className="text-sm text-foreground bg-card/70 backdrop-blur-sm border border-border px-4 py-1.5 rounded-full font-medium"
              >
                {s}
              </span>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href="/tournament">
              <div className="group inline-flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-black px-8 py-4 rounded-full text-sm shadow-xl shadow-amber-500/20 transition-all duration-200 hover:scale-105">
                Browse Tournaments
                <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>
            <a href="#host">
              <div className="inline-flex items-center gap-2 bg-card/70 hover:bg-card/90 backdrop-blur-sm border border-border hover:border-foreground/20 text-foreground font-bold px-8 py-4 rounded-full text-sm transition-all duration-200 hover:scale-105">
                Host a Tournament
                <ChevronRight className="h-4 w-4" />
              </div>
            </a>
          </div>

          <div className="mt-16 flex justify-center">
            <div className="flex flex-col items-center gap-2 opacity-50">
              <div className="w-px h-10 bg-gradient-to-b from-transparent via-foreground to-transparent" />
              <span className="text-xs text-foreground/70 uppercase tracking-widest">Explore</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ────────────────────────────────────────────────────────── */}
      <section className="py-10 px-4" aria-label="Platform statistics">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {STATS.map((s, i) => (
              <Reveal key={s.label} delay={i * 80}>
                <div className="bg-card rounded-2xl border border-border hover:border-foreground/20 p-6 text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                  <div className={`text-3xl sm:text-4xl font-black mb-1 ${s.color}`}>
                    {s.kind === 'count' ? (
                      <AnimatedCounter value={s.value} suffix={s.suffix} />
                    ) : (
                      s.display
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground font-semibold uppercase tracking-wide">
                    {s.label}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────────────────────────── */}
      <section className="py-16 px-4 bg-surface" aria-labelledby="how-it-works-heading">
        <div className="max-w-5xl mx-auto">
          <Reveal className="text-center mb-12">
            <p className="text-xs text-amber-600 dark:text-amber-400 font-bold uppercase tracking-widest mb-3">
              How It Works
            </p>
            <h2 id="how-it-works-heading" className="text-4xl sm:text-5xl font-black text-foreground mb-4">
              From Idea to Champions
            </h2>
            <p className="text-muted-foreground text-base max-w-xl mx-auto leading-relaxed">
              Run a complete sports tournament in four simple steps. No spreadsheets. No chaos.
            </p>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <Reveal key={step.step} delay={i * 90}>
                  <div
                    className={`relative h-full bg-card border-2 ${step.accentBorder} rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl`}
                  >
                    {i < STEPS.length - 1 && (
                      <div className="hidden lg:block absolute top-10 -right-2.5 w-5 h-px bg-border z-10" />
                    )}
                    <div className="flex items-center justify-between mb-4">
                      <div className={`text-4xl font-black ${step.accentText} opacity-50 leading-none`}>
                        {step.step}
                      </div>
                      <div
                        className={`w-9 h-9 rounded-xl ${step.accentBg} border ${step.accentBorder} flex items-center justify-center`}
                      >
                        <Icon className={`h-4 w-4 ${step.accentText}`} />
                      </div>
                    </div>
                    <h3 className="text-base font-black text-foreground mb-2">{step.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section className="py-16 px-4" aria-labelledby="features-heading">
        <div className="max-w-5xl mx-auto">
          <Reveal className="text-center mb-12">
            <p className="text-xs text-amber-600 dark:text-amber-400 font-bold uppercase tracking-widest mb-3">
              Platform Features
            </p>
            <h2 id="features-heading" className="text-4xl sm:text-5xl font-black text-foreground mb-4">
              Everything You Need
            </h2>
            <p className="text-muted-foreground text-base max-w-xl mx-auto leading-relaxed">
              Every tool a tournament organiser needs — built in, ready to go, no configuration
              nightmare.
            </p>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <Reveal key={f.title} delay={i * 70}>
                  <div
                    className={`relative h-full bg-card border-2 ${f.border} rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-xl overflow-hidden`}
                  >
                    <div
                      aria-hidden
                      className={`absolute left-6 top-0 h-1 w-12 rounded-b-full bg-gradient-to-r ${f.bar}`}
                    />
                    <div className="p-6 pt-5">
                      <div
                        className={`w-11 h-11 rounded-xl bg-muted border ${f.border} flex items-center justify-center mb-4`}
                      >
                        <Icon className={`h-5 w-5 ${f.text}`} />
                      </div>
                      <h3 className="text-base font-black text-foreground mb-2">{f.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Sports ───────────────────────────────────────────────────────── */}
      <section className="py-16 px-4 bg-surface" aria-labelledby="sports-heading">
        <div className="max-w-5xl mx-auto">
          <Reveal className="text-center mb-12">
            <p className="text-xs text-amber-600 dark:text-amber-400 font-bold uppercase tracking-widest mb-3">
              Supported Sports
            </p>
            <h2 id="sports-heading" className="text-4xl sm:text-5xl font-black text-foreground mb-4">
              Built for Multiple Sports
            </h2>
            <p className="text-muted-foreground text-base max-w-xl mx-auto leading-relaxed">
              One platform that understands the rules and format of each sport you love.
            </p>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {SPORTS.map((s, i) => (
              <Reveal key={s.name} delay={i * 70}>
                <Link href="/tournament">
                  <div className="group relative h-full bg-card rounded-2xl border border-border hover:border-foreground/20 hover:shadow-xl transition-all duration-300 hover:-translate-y-1.5 cursor-pointer overflow-hidden">
                    <div
                      aria-hidden
                      className={`absolute left-6 top-0 h-1 w-12 rounded-b-full bg-gradient-to-r ${s.bar}`}
                    />
                    <div className="p-6">
                      <h3 className="text-base font-black text-foreground mb-2 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                        {s.name}
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed mb-4">{s.desc}</p>
                      <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                        View tournaments <ChevronRight className="h-3 w-3" />
                      </div>
                    </div>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <TestimonialsSection />

      {/* ── Quick Access ─────────────────────────────────────────────────── */}
      <section className="py-8 px-4" aria-label="Quick links">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-3 gap-4">
            {[
              {
                label: 'Schedules',
                desc: 'Fixtures & court assignments',
                href: '/schedules',
              },
              {
                label: 'Winners',
                desc: 'Results & champion gallery',
                href: '/winners',
              },
              {
                label: 'Register',
                desc: 'Join an upcoming tournament',
                href: '/tournament',
              },
            ].map((ql, i) => (
              <Reveal key={ql.label} delay={i * 60}>
                <Link href={ql.href}>
                  <div className="group h-full bg-card rounded-2xl border border-border hover:border-amber-500/40 p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl cursor-pointer">
                    <h3 className="text-sm font-black text-foreground mb-1 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                      {ql.label}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed hidden sm:block">
                      {ql.desc}
                    </p>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Host a Tournament ─────────────────────────────────────────────── */}
      <section id="host" className="py-20 px-4" aria-labelledby="host-heading">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-xl">
              <div className="relative z-10 grid lg:grid-cols-2 gap-0">
                <div className="p-10 sm:p-14 lg:pr-8">
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-bold uppercase tracking-widest mb-4">
                    Host on TourneyCraft
                  </p>
                  <h2
                    id="host-heading"
                    className="text-4xl sm:text-5xl font-black text-foreground mb-5 leading-tight"
                  >
                    Ready to Run Your Tournament?
                  </h2>
                  <p className="text-muted-foreground text-base mb-8 leading-relaxed">
                    Whether you&apos;re organising a small community event or a large multi-sport
                    championship — TourneyCraft gives you the tools, without the complexity.
                  </p>

                  <ul className="space-y-3 mb-8">
                    {HOST_BENEFITS.map((b) => (
                      <li key={b} className="flex items-start gap-3">
                        <CheckCircle2 className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                        <span className="text-sm text-muted-foreground">{b}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { value: '50+', label: 'Events Run' },
                      { value: '2k+', label: 'Players' },
                      { value: '100%', label: 'Free' },
                    ].map((s) => (
                      <div
                        key={s.label}
                        className="bg-muted border border-border rounded-xl p-3 text-center"
                      >
                        <p className="text-xl font-black text-amber-600 dark:text-amber-400">
                          {s.value}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-surface lg:border-l border-border p-10 sm:p-14 lg:pl-8 rounded-b-3xl lg:rounded-bl-none lg:rounded-r-3xl">
                  <p className="text-sm font-black text-foreground mb-1">Create your account</p>
                  <p className="text-sm text-muted-foreground mb-6">
                    Sign up, submit your tournament, and we review it before you can run it.
                  </p>
                  <HostTournamentForm />
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Contact ──────────────────────────────────────────────────────── */}
      <section id="contact" className="py-16 px-4 bg-surface" aria-labelledby="contact-heading">
        <div className="max-w-5xl mx-auto">
          <Reveal className="text-center mb-12">
            <p className="text-xs text-amber-600 dark:text-amber-400 font-bold uppercase tracking-widest mb-3">
              Get In Touch
            </p>
            <h2 id="contact-heading" className="text-4xl sm:text-5xl font-black text-foreground mb-4">
              Contact Us
            </h2>
            <p className="text-muted-foreground text-base max-w-md mx-auto">
              Have questions? We&apos;re happy to help you get your tournament off the ground.
            </p>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {CONTACT.map((c, i) => {
              const Icon = c.icon;
              return (
                <Reveal key={c.label} delay={i * 70}>
                  <a
                    href={c.href}
                    target="_blank"
                    rel="noreferrer"
                    className="group block h-full bg-card border border-border hover:border-foreground/20 rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                  >
                    <div className="w-10 h-10 rounded-xl bg-muted border border-border flex items-center justify-center mb-4">
                      <Icon className={`h-5 w-5 ${c.color}`} />
                    </div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1">
                      {c.label}
                    </p>
                    <p className="text-sm font-semibold text-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                      {c.value}
                    </p>
                  </a>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <section className="py-12 px-4 pb-8">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="relative overflow-hidden rounded-3xl bg-card border border-border p-10 sm:p-14 text-center shadow-xl">
              <div className="relative z-10">
                <h2 className="text-4xl sm:text-5xl font-black text-foreground mb-4">
                  Your Tournament Awaits
                </h2>
                <p className="text-muted-foreground text-base mb-8 max-w-lg mx-auto leading-relaxed">
                  Browse active tournaments, view schedules, and register as a player — or{' '}
                  <a
                    href="#host"
                    className="text-amber-600 dark:text-amber-400 font-bold hover:underline"
                  >
                    host your own event
                  </a>{' '}
                  with TourneyCraft.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link href="/tournament">
                    <div className="inline-flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-black px-8 py-4 rounded-full text-sm shadow-lg shadow-amber-500/25 transition-all duration-200 hover:scale-105">
                      Browse Tournaments <ChevronRight className="h-4 w-4" />
                    </div>
                  </Link>
                  <Link href="/schedules">
                    <div className="inline-flex items-center gap-2 bg-muted hover:bg-muted/80 border border-border hover:border-foreground/20 text-foreground font-bold px-8 py-4 rounded-full text-sm transition-all duration-200 hover:scale-105">
                      View Schedule
                    </div>
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <footer className="py-10 px-4 border-t border-border bg-surface">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <Image src="/logo.png" alt="TourneyCraft logo" width={32} height={32} />
              <p className="text-sm font-black text-foreground">TourneyCraft</p>
            </div>
            <nav className="flex items-center gap-6" aria-label="Footer">
              {[
                { label: 'Tournaments', href: '/tournament' },
                { label: 'Schedules', href: '/schedules' },
                { label: 'Winners', href: '/winners' },
                { label: 'Login', href: '/login' },
              ].map((l) => (
                <Link
                  key={l.label}
                  href={l.href}
                  className="text-sm text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400 transition-colors font-medium"
                >
                  {l.label}
                </Link>
              ))}
            </nav>
            <p className="text-sm text-muted-foreground">© 2026 TourneyCraft</p>
          </div>
        </div>
      </footer>
    </PublicLayout>
  );
}
