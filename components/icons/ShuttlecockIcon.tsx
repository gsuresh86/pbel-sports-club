import { cn } from '@/lib/utils';

/**
 * Shuttlecock (serving indicator) icon. Uses `currentColor` so it can be
 * tinted white on dark scoreboards or coloured per side on light backgrounds.
 */
export function ShuttlecockIcon({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('h-5 w-5', className)}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      {/* feather skirt */}
      <path d="M9 14.2 4.2 4" />
      <path d="M15 14.2 19.8 4" />
      <path d="M4.2 4Q12 1.6 19.8 4" />
      <path d="M12 14.2V2.2" />
      <path d="M10.7 14.3 7.4 3" />
      <path d="M13.3 14.3 16.6 3" />
      <path d="M7 9.2Q12 7.6 17 9.2" />
      {/* cork */}
      <path d="M9 14.2Q12 19.4 15 14.2Z" fill="currentColor" />
    </svg>
  );
}
