'use client';

export const TEAM_LOGO_PLACEHOLDER = '/placeholder-team.svg';

interface TeamLogoProps {
  logoUrl?: string | null;
  name: string;
  size?: number;
  className?: string;
}

export function TeamLogo({ logoUrl, name, size = 40, className = '' }: TeamLogoProps) {
  const src = logoUrl || TEAM_LOGO_PLACEHOLDER;
  return (
    <div
      className={`relative overflow-hidden rounded-full bg-slate-800 flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={`${name} logo`}
        onError={(e) => { (e.currentTarget as HTMLImageElement).src = TEAM_LOGO_PLACEHOLDER; }}
        className="h-full w-full object-cover"
      />
    </div>
  );
}
