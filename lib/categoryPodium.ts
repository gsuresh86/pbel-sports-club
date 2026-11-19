import type { CategoryType, Match } from '@/types';
import { categoriesMatch, collectPublicCategorySlugs, normalizeCategorySlug } from '@/lib/categoryLabels';
import {
  filterKnockoutMatchesForCategory,
  getMatchKnockoutType,
  getMatchWinner,
} from '@/lib/knockoutBracket';
import { isRubberMatch } from '@/lib/teamMatchRubbers';

/** One side of a decided final or third-place match. */
export interface CategoryPodiumSide {
  id: string;
  name: string;
  partnerName?: string;
}

export interface CategoryPodium {
  category: string;
  winner: CategoryPodiumSide | null;
  runnerUp: CategoryPodiumSide | null;
  third: CategoryPodiumSide | null;
  /** Set score of the final, winner's games first. Empty when the final is not decided. */
  finalScore: string | null;
}

function sideOf(match: Match, side: 1 | 2): CategoryPodiumSide {
  if (side === 1) {
    return {
      id: match.player1Id,
      name: match.player1Name,
      partnerName: match.player1PartnerName?.trim() || undefined,
    };
  }
  return {
    id: match.player2Id,
    name: match.player2Name,
    partnerName: match.player2PartnerName?.trim() || undefined,
  };
}

function winnerSide(match: Match): 1 | 2 | null {
  const winner = getMatchWinner(match);
  if (!winner) return null;
  if (winner.id && winner.id === match.player1Id) return 1;
  if (winner.id && winner.id === match.player2Id) return 2;
  return null;
}

function stageMatches(
  matches: Match[],
  category: string,
  stage: 'F' | 'TP',
  categoryCount: number,
): Match[] {
  const inStage = matches.filter((match) => !isRubberMatch(match) && getMatchKnockoutType(match) === stage);
  const typed = inStage.filter((match) => match.category && categoriesMatch(match.category, category));
  const uncategorized = inStage.filter((match) => !match.category);
  if (uncategorized.length === 0) return typed;

  const owners = new Set(
    inStage
      .map((match) => normalizeCategorySlug(match.category))
      .filter((slug): slug is CategoryType => !!slug),
  );
  const slug = normalizeCategorySlug(category);
  const canClaimUncategorized =
    owners.size === 0
      ? categoryCount === 1
      : owners.size === 1 && !!slug && owners.has(slug);
  if (!canClaimUncategorized) return typed;

  // Same bracket helper the knockout page uses, so legacy finals without a category still resolve.
  const legacy = filterKnockoutMatchesForCategory(matches, stage, category as CategoryType);
  const byId = new Map<string, Match>();
  for (const match of [...typed, ...uncategorized, ...legacy]) byId.set(match.id, match);
  return [...byId.values()];
}

function matchTime(match: Match): number {
  const time = match.scheduledTime ? new Date(match.scheduledTime).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

/** Prefer a completed match. When several are complete, use the latest. */
function pickStageMatch(matches: Match[]): Match | undefined {
  const decided = matches.filter((match) => winnerSide(match) != null);
  const pool = decided.length > 0 ? decided : matches;
  return [...pool].sort((a, b) => matchTime(b) - matchTime(a))[0];
}

function finalScore(match: Match, side: 1 | 2): string | null {
  const left = match.player1Score;
  const right = match.player2Score;
  if (left == null || right == null) return null;
  if (left === 0 && right === 0) return null;
  const winnerGames = side === 1 ? left : right;
  const loserGames = side === 1 ? right : left;
  return `${winnerGames}–${loserGames}`;
}

/**
 * Champion and runner-up for every category, taken from the completed final.
 * Third place is included when a completed third-place match exists.
 * Categories with no decided final are still returned so the public page can list them.
 */
export function buildCategoryPodiums(
  categories: Array<string | undefined | null> | undefined,
  matches: Match[],
): CategoryPodium[] {
  const fromMatches = matches.filter((match) => !isRubberMatch(match)).map((match) => match.category);
  const slugs = collectPublicCategorySlugs(categories, fromMatches);

  return slugs.map((category) => {
    const finalMatch = pickStageMatch(stageMatches(matches, category, 'F', slugs.length));
    const decidedSide = finalMatch ? winnerSide(finalMatch) : null;
    const thirdMatch = pickStageMatch(
      stageMatches(matches, category, 'TP', slugs.length).filter((match) => winnerSide(match) != null),
    );
    const thirdSide = thirdMatch ? winnerSide(thirdMatch) : null;

    return {
      category,
      winner: finalMatch && decidedSide ? sideOf(finalMatch, decidedSide) : null,
      runnerUp: finalMatch && decidedSide ? sideOf(finalMatch, decidedSide === 1 ? 2 : 1) : null,
      third: thirdMatch && thirdSide ? sideOf(thirdMatch, thirdSide) : null,
      finalScore: finalMatch && decidedSide ? finalScore(finalMatch, decidedSide) : null,
    };
  });
}
