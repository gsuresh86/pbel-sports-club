import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Generate a public registration link for a tournament
 * Uses environment variable for base URL, falls back to current origin
 */
export function generateRegistrationLink(tournamentId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                 (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
  return `${baseUrl}/tournament/${tournamentId}/register`;
}

/**
 * Generate a public tournament view link
 */
export function generateTournamentLink(tournamentId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                 (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
  return `${baseUrl}/tournament/${tournamentId}`;
}
