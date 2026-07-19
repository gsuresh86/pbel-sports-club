'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { BarChart3, ExternalLink, Users2 } from 'lucide-react';
import type { Match, Pool, PublicPlayer, Team, Tournament } from '@/types';
import { formatCategoryLabel } from '@/lib/categoryLabels';
import { isTeamCategory } from '@/lib/poolStandings';
import PoolPointsTable from '@/components/public/PoolPointsTable';

interface Props {
  tournament: Tournament;
  pools: Pool[];
  matches: Match[];
  teams: Team[];
  participants: PublicPlayer[];
  initialCategory?: string;
  hideCategoryFilter?: boolean;
  showFullPageLink?: boolean;
  /** When true, category filter updates the URL (standings page only). */
  syncUrl?: boolean;
}

function sortPools(a: Pool, b: Pool) {
  const cat = a.category.localeCompare(b.category);
  if (cat !== 0) return cat;
  return a.name.localeCompare(b.name, undefined, { numeric: true });
}

export default function TournamentStandingsView({
  tournament,
  pools,
  matches,
  teams,
  participants,
  initialCategory,
  hideCategoryFilter = false,
  showFullPageLink = false,
  syncUrl = false,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlCategory = searchParams.get('category');

  const [categoryFilter, setCategoryFilter] = useState<string>(() => {
    if (initialCategory) return initialCategory;
    if (urlCategory && tournament.categories?.includes(urlCategory as typeof tournament.categories[number])) {
      return urlCategory;
    }
    return 'all';
  });

  useEffect(() => {
    if (initialCategory) {
      setCategoryFilter(initialCategory);
      return;
    }
    if (urlCategory && tournament.categories?.includes(urlCategory as typeof tournament.categories[number])) {
      setCategoryFilter(urlCategory);
    }
  }, [initialCategory, urlCategory, tournament.categories]);

  const updateCategory = useCallback((cat: string) => {
    setCategoryFilter(cat);
    if (!syncUrl || hideCategoryFilter || initialCategory) return;
    const params = new URLSearchParams(searchParams.toString());
    if (cat === 'all') params.delete('category');
    else params.set('category', cat);
    const qs = params.toString();
    router.replace(`/tournament/${tournament.id}/standings${qs ? `?${qs}` : ''}`, { scroll: false });
  }, [syncUrl, hideCategoryFilter, initialCategory, router, searchParams, tournament.id]);

  const filteredPools = useMemo(
    () => pools
      .filter(p => categoryFilter === 'all' || p.category === categoryFilter)
      .sort(sortPools),
    [pools, categoryFilter],
  );

  const poolsByCategory = useMemo(() => {
    if (categoryFilter !== 'all') return null;
    const groups = new Map<string, Pool[]>();
    for (const pool of filteredPools) {
      const list = groups.get(pool.category) ?? [];
      list.push(pool);
      groups.set(pool.category, list);
    }
    return groups;
  }, [categoryFilter, filteredPools]);

  const categories = tournament.categories ?? [];

  const renderPool = (pool: Pool) => {
    const isTeamCat = isTeamCategory(pool.category);
    const isDoubles = pool.category.includes('doubles');
    return (
      <PoolPointsTable
        key={pool.id}
        pool={pool}
        matches={matches}
        isTeamCat={isTeamCat}
        teams={teams}
        participants={participants}
        isDoubles={isDoubles}
        categoryQualifyCounts={tournament.categoryQualifyCounts}
      />
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">
            2 pts per win · PG = points given · PT = points taken · PD = PT − PG
          </p>
        </div>
        {showFullPageLink && (
          <Link
            href={`/tournament/${tournament.id}/standings${categoryFilter !== 'all' ? `?category=${categoryFilter}` : ''}`}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-yellow-400 hover:text-yellow-300 transition-colors shrink-0"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open full standings page
          </Link>
        )}
      </div>

      {!hideCategoryFilter && categories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          <button
            type="button"
            onClick={() => updateCategory('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
              categoryFilter === 'all'
                ? 'bg-yellow-400 text-black'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => updateCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
                categoryFilter === cat
                  ? 'bg-yellow-400 text-black'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {formatCategoryLabel(cat)}
            </button>
          ))}
        </div>
      )}

      {pools.length === 0 ? (
        <div className="text-center py-24">
          <Users2 className="h-12 w-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">Pools will appear once they are created</p>
        </div>
      ) : filteredPools.length === 0 ? (
        <div className="text-center py-16">
          <BarChart3 className="h-10 w-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No pools in this category</p>
        </div>
      ) : categoryFilter === 'all' && poolsByCategory ? (
        <div className="space-y-10">
          {Array.from(poolsByCategory.entries()).map(([cat, catPools]) => (
            <section key={cat}>
              <h3 className="text-xs uppercase tracking-widest text-yellow-400 font-bold mb-4 flex items-center gap-2">
                <BarChart3 className="h-3.5 w-3.5" />
                {formatCategoryLabel(cat)}
              </h3>
              <div className="space-y-4">
                {catPools.map(renderPool)}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPools.map(renderPool)}
        </div>
      )}
    </div>
  );
}
