'use client';

export const TEAM_LOGO_PLACEHOLDER = '/placeholder-team.svg';

interface TeamLogoProps {
  logoUrl?: string | null;
  name: string;
  size?: number;
  className?: string;
  /** When false, logo renders square with natural aspect ratio instead of a circle crop. */
  circular?: boolean;
}

export function TeamLogo({
  logoUrl,
  name,
  size = 40,
  className = '',
  circular = true,
}: TeamLogoProps) {
  const src = logoUrl || TEAM_LOGO_PLACEHOLDER;
  const hasClassDimensions = /\b(w|h)-/.test(className);
  const dimensionStyle = hasClassDimensions ? undefined : { width: size, height: size };
  return (
    <div
      className={`relative overflow-hidden flex-shrink-0 ${
        circular ? 'rounded-full bg-slate-800' : 'rounded-md bg-transparent'
      } ${className}`}
      style={dimensionStyle}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={`${name} logo`}
        onError={(e) => { (e.currentTarget as HTMLImageElement).src = TEAM_LOGO_PLACEHOLDER; }}
        className={circular ? 'h-full w-full object-cover' : 'h-full w-full object-contain'}
      />
    </div>
  );
}
