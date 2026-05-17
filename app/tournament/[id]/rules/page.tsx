'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tournament } from '@/types';
import { ArrowLeft, Trophy, Calendar, MapPin, ScrollText, ExternalLink } from 'lucide-react';
import Link from 'next/link';

// --------------- inline bold / italic renderer ---------------
function renderInline(text: string): React.ReactNode {
  const INLINE = /(\*{3}[^*]+\*{3}|\*{2}[^*]+\*{2}|\*[^*]+\*)/g;
  const parts = text.split(INLINE);
  if (parts.length === 1) return text;
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('***') && part.endsWith('***'))
          return <strong key={i}><em>{part.slice(3, -3)}</em></strong>;
        if (part.startsWith('**') && part.endsWith('**'))
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        if (part.startsWith('*') && part.endsWith('*') && part.length >= 3)
          return <em key={i}>{part.slice(1, -1)}</em>;
        return part || null;
      })}
    </>
  );
}

// --------------- block parser ---------------
interface RulesBlock {
  type: 'h2' | 'h3' | 'bullet' | 'numbered' | 'paragraph' | 'spacer';
  text?: string;
  items?: string[];
  start?: number;
}

function parseRules(raw: string): RulesBlock[] {
  const lines = raw.split('\n');
  const blocks: RulesBlock[] = [];
  let bulletGroup: string[] = [];
  let numberedGroup: string[] = [];
  let numberedStart = 1;

  const flush = () => {
    if (bulletGroup.length) {
      blocks.push({ type: 'bullet', items: [...bulletGroup] });
      bulletGroup = [];
    }
    if (numberedGroup.length) {
      blocks.push({ type: 'numbered', items: [...numberedGroup], start: numberedStart });
      numberedGroup = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trim();

    if (!line) {
      flush();
      if (blocks.length && blocks[blocks.length - 1].type !== 'spacer') {
        blocks.push({ type: 'spacer' });
      }
      continue;
    }

    if (line.startsWith('## ')) {
      flush();
      blocks.push({ type: 'h3', text: line.slice(3) });
      continue;
    }

    if (line.startsWith('# ')) {
      flush();
      blocks.push({ type: 'h2', text: line.slice(2) });
      continue;
    }

    const bulletMatch = line.match(/^[-•*]\s+(.+)/);
    if (bulletMatch) {
      if (numberedGroup.length) flush();
      bulletGroup.push(bulletMatch[1]);
      continue;
    }

    const numberedMatch = line.match(/^(\d+)[.)]\s+(.+)/);
    if (numberedMatch) {
      if (bulletGroup.length) flush();
      if (!numberedGroup.length) numberedStart = parseInt(numberedMatch[1]);
      numberedGroup.push(numberedMatch[2]);
      continue;
    }

    flush();
    blocks.push({ type: 'paragraph', text: line });
  }

  flush();
  return blocks.filter((b, i, arr) => !(b.type === 'spacer' && i === arr.length - 1));
}

export function RulesContent({ rules }: { rules: string }) {
  const blocks = parseRules(rules);

  if (!blocks.length) {
    return (
      <p className="text-gray-500 italic text-center py-8">
        No rules have been published for this tournament yet.
      </p>
    );
  }

  return (
    <div className="prose prose-gray max-w-none space-y-1">
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'h2':
            return (
              <h2 key={i} className="text-xl font-bold text-gray-900 mt-6 mb-2 pb-2 border-b border-gray-200 first:mt-0">
                {renderInline(block.text!)}
              </h2>
            );
          case 'h3':
            return (
              <h3 key={i} className="text-base font-semibold text-gray-800 mt-4 mb-1">
                {renderInline(block.text!)}
              </h3>
            );
          case 'bullet':
            return (
              <ul key={i} className="list-disc list-outside ml-5 space-y-1 my-2">
                {block.items!.map((item, j) => (
                  <li key={j} className="text-gray-700 text-sm leading-relaxed">{renderInline(item)}</li>
                ))}
              </ul>
            );
          case 'numbered':
            return (
              <ol key={i} start={block.start} className="list-decimal list-outside ml-5 space-y-1 my-2">
                {block.items!.map((item, j) => (
                  <li key={j} className="text-gray-700 text-sm leading-relaxed">{renderInline(item)}</li>
                ))}
              </ol>
            );
          case 'paragraph':
            return (
              <p key={i} className="text-gray-700 text-sm leading-relaxed">
                {renderInline(block.text!)}
              </p>
            );
          case 'spacer':
            return <div key={i} className="h-3" />;
          default:
            return null;
        }
      })}
    </div>
  );
}

// --------------- page ---------------
export default function TournamentRulesPage() {
  const params = useParams();
  const tournamentId = params.id as string;
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tournamentId) return;
    getDoc(doc(db, 'tournaments', tournamentId))
      .then(snap => {
        if (snap.exists()) {
          const d = snap.data();
          setTournament({
            id: snap.id,
            ...d,
            startDate: d.startDate?.toDate(),
            endDate: d.endDate?.toDate(),
            registrationDeadline: d.registrationDeadline?.toDate(),
            createdAt: d.createdAt?.toDate(),
            updatedAt: d.updatedAt?.toDate(),
          } as Tournament);
        }
      })
      .finally(() => setLoading(false));
  }, [tournamentId]);

  const getSportBanner = (sport: string) => {
    switch (sport) {
      case 'badminton': return 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&h=400&q=80';
      case 'table-tennis': return 'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&h=400&q=80';
      case 'volleyball': return 'https://images.unsplash.com/photo-1612872087720-b8768760e99a?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&h=400&q=80';
      default: return 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&h=400&q=80';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900" />
          <p className="mt-4 text-gray-600">Loading tournament details...</p>
        </div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Tournament Not Found</h1>
          <Link href="/tournament"><Button>Browse Tournaments</Button></Link>
        </div>
      </div>
    );
  }

  const registrationOpen = tournament.registrationOpen && new Date() <= tournament.registrationDeadline;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Banner */}
      <div className="relative h-80 w-full overflow-hidden">
        <img
          src={tournament.banner || getSportBanner(tournament.sport)}
          alt={tournament.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/40 to-black/60 flex items-center justify-center">
          <div className="text-center text-white max-w-4xl px-4">
            <ScrollText className="h-16 w-16 mx-auto mb-4 text-yellow-400" />
            <h1 className="text-5xl font-bold mb-3 drop-shadow-lg">{tournament.name}</h1>
            <p className="text-2xl capitalize drop-shadow-md">Rules &amp; Regulations</p>
          </div>
        </div>
      </div>

      <div className="py-8 px-4">
        <div className="max-w-5xl mx-auto">
          {/* Back navigation */}
          <div className="mb-6">
            <Link href={`/tournament/${tournamentId}`}>
              <Button variant="ghost" className="gap-2 text-gray-600 hover:text-gray-900 pl-0">
                <ArrowLeft className="h-4 w-4" />
                Back to Tournament
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main rules content */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50">
                  <ScrollText className="h-5 w-5 text-blue-600" />
                  <h2 className="text-lg font-semibold text-gray-900">Official Rules</h2>
                </div>
                <div className="px-6 py-5">
                  {tournament.rules ? (
                    <RulesContent rules={tournament.rules} />
                  ) : (
                    <div className="text-center py-12">
                      <ScrollText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 font-medium">No rules published yet</p>
                      <p className="text-sm text-gray-400 mt-1">Check back closer to the tournament date.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Tournament summary card */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  <h3 className="font-semibold text-gray-900">Tournament Details</h3>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-2">
                    <Calendar className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-700">Dates</p>
                      <p className="text-gray-500">
                        {new Date(tournament.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} –{' '}
                        {new Date(tournament.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-700">Venue</p>
                      <p className="text-gray-500">{tournament.venue}</p>
                    </div>
                  </div>
                  <div className="pt-1">
                    <p className="font-medium text-gray-700 mb-1">Categories</p>
                    <div className="flex flex-wrap gap-1">
                      {tournament.categories?.map(cat => (
                        <Badge key={cat} variant="secondary" className="text-xs capitalize">
                          {cat.replace(/-/g, ' ')}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  {tournament.entryFee && (
                    <div className="pt-1 border-t border-gray-100">
                      <p className="font-medium text-gray-700">Entry Fee</p>
                      <p className="text-gray-500">₹{tournament.entryFee}</p>
                    </div>
                  )}
                  {tournament.prizePool && (
                    <div>
                      <p className="font-medium text-gray-700">Prize Pool</p>
                      <p className="text-gray-500">₹{tournament.prizePool}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Registration CTA */}
              <div className={`rounded-lg p-5 border ${registrationOpen ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                <p className={`text-sm font-semibold mb-1 ${registrationOpen ? 'text-green-800' : 'text-gray-700'}`}>
                  {registrationOpen ? 'Registration is Open' : 'Registration Closed'}
                </p>
                <p className={`text-xs mb-3 ${registrationOpen ? 'text-green-700' : 'text-gray-500'}`}>
                  {registrationOpen
                    ? `Deadline: ${new Date(tournament.registrationDeadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
                    : 'Registration for this tournament is closed.'}
                </p>
                {registrationOpen && (
                  <Link href={`/tournament/${tournamentId}/register`}>
                    <Button size="sm" className="w-full gap-2">
                      <ExternalLink className="h-3.5 w-3.5" />
                      Register Now
                    </Button>
                  </Link>
                )}
              </div>

              <p className="text-xs text-gray-400 text-center px-2">
                Rules are published by the tournament organizers and are subject to change.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
