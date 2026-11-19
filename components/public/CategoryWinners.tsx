'use client';

import { useState } from 'react';
import { Medal, Trophy } from 'lucide-react';
import type { CategoryPodium, CategoryPodiumSide } from '@/lib/categoryPodium';
import { formatCategoryLabel } from '@/lib/categoryLabels';
import { getInitials, getMatchSideDisplay } from '@/lib/utils';

type RegistrationLike = {
  name?: string;
  partnerName?: string | null;
  profilePhotoUrl?: string | null;
  partnerProfilePhotoUrl?: string | null;
};

interface CategoryWinnersProps {
  podiums: CategoryPodium[];
  regById: Map<string, RegistrationLike>;
  teamsById: Map<string, { logoUrl?: string; name?: string }>;
}

interface PlaceView {
  names: string[];
  avatars: (string | undefined)[];
}

function placeView(
  side: CategoryPodiumSide,
  regById: Map<string, RegistrationLike>,
  teamsById: Map<string, { logoUrl?: string; name?: string }>,
): PlaceView {
  const display = getMatchSideDisplay(side.id, side.name, regById, teamsById);
  if (side.partnerName && display.names.length < 2) {
    return {
      names: [side.name, side.partnerName],
      avatars: [display.avatars[0], undefined],
    };
  }
  return { names: display.names.filter(Boolean), avatars: display.avatars };
}

/** Title-case shouty names without turning "Men's Team" into "Men'S Team". */
function displayName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed || trimmed !== trimmed.toUpperCase()) return trimmed;
  return trimmed
    .toLowerCase()
    .replace(/(^|[\s-])(\p{L})/gu, (_, separator: string, letter: string) => separator + letter.toUpperCase());
}

function Portrait({ name, photoUrl }: { name: string; photoUrl?: string }) {
  const [failed, setFailed] = useState(false);
  const showPhoto = !!photoUrl && !failed;
  return (
    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-muted">
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt={name}
          onError={() => setFailed(true)}
          className="h-full w-full object-cover object-top"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs font-bold text-muted-foreground">
          {getInitials(name) || '?'}
        </div>
      )}
    </div>
  );
}

const TONES = {
  gold: {
    title: 'Winner',
    shell: 'bg-amber-500/10',
    label: 'text-amber-600 dark:text-amber-400',
  },
  silver: {
    title: 'Runner-up',
    shell: 'bg-muted/60',
    label: 'text-slate-500 dark:text-slate-300',
  },
  bronze: {
    title: 'Third place',
    shell: 'bg-orange-500/10',
    label: 'text-orange-600 dark:text-orange-400',
  },
} as const;

function Place({
  tone,
  side,
  regById,
  teamsById,
}: {
  tone: keyof typeof TONES;
  side: CategoryPodiumSide;
  regById: Map<string, RegistrationLike>;
  teamsById: Map<string, { logoUrl?: string; name?: string }>;
}) {
  const view = placeView(side, regById, teamsById);
  const style = TONES[tone];
  return (
    <div className={`flex items-center gap-3 px-4 py-4 ${style.shell}`}>
      <div className="flex -space-x-3">
        {view.names.map((name, index) => (
          <Portrait key={`${side.id}-${index}`} name={name} photoUrl={view.avatars[index]} />
        ))}
      </div>
      <div className="min-w-0">
        <p className={`text-[10px] font-bold uppercase tracking-widest ${style.label}`}>{style.title}</p>
        {view.names.map((name, index) => (
          <p key={`${side.id}-name-${index}`} className="truncate text-sm font-bold text-foreground">
            {displayName(name)}
          </p>
        ))}
      </div>
    </div>
  );
}

export default function CategoryWinners({ podiums, regById, teamsById }: CategoryWinnersProps) {
  const ordered = [...podiums].sort((a, b) => Number(Boolean(b.winner)) - Number(Boolean(a.winner)));
  const decided = ordered.filter((podium) => podium.winner).length;

  if (ordered.length === 0) {
    return (
      <div className="py-24 text-center">
        <Trophy className="mx-auto mb-4 h-12 w-12 text-slate-600" />
        <p className="text-slate-400">No categories yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-foreground">Winners</h2>
          <p className="text-sm text-muted-foreground">
            Champion and runner-up for each category
            {decided > 0 ? ` · ${decided} decided` : ''}
          </p>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {ordered.map((podium) => (
          <article key={podium.category} className="overflow-hidden rounded-2xl border border-border bg-card">
            <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <h3 className="text-sm font-bold text-foreground">{formatCategoryLabel(podium.category)}</h3>
              {podium.finalScore ? (
                <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                  Final {podium.finalScore}
                </span>
              ) : (
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Awaiting final
                </span>
              )}
            </header>
            {podium.winner && podium.runnerUp ? (
              <div className="grid sm:grid-cols-2">
                <Place tone="gold" side={podium.winner} regById={regById} teamsById={teamsById} />
                <Place tone="silver" side={podium.runnerUp} regById={regById} teamsById={teamsById} />
              </div>
            ) : (
              <div className="flex items-center gap-3 px-4 py-8 text-sm text-muted-foreground">
                <Medal className="h-4 w-4 text-slate-500" />
                Winner and runner-up will appear when the final is completed.
              </div>
            )}
            {podium.third && (
              <div className="border-t border-border">
                <Place tone="bronze" side={podium.third} regById={regById} teamsById={teamsById} />
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
