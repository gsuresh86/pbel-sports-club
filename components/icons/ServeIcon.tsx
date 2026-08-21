import { Hand } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Sport-agnostic serving indicator (raised hand). Uses `currentColor` so it can
 * be tinted white on dark scoreboards or coloured per side on light backgrounds.
 */
export function ServeIcon({ className, title }: { className?: string; title?: string }) {
  return (
    <Hand
      className={cn('h-5 w-5', className)}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
    </Hand>
  );
}
