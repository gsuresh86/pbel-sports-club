'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Star } from 'lucide-react';
import type { Testimonial } from '@/types';

const FALLBACK: Testimonial[] = [
  {
    id: 'fallback-1',
    tournamentId: '',
    tournamentName: '',
    author: 'Amit Sharma',
    authorRole: 'Sports Secretary, PBEL City',
    quote: 'Manchplay made our annual sports day incredibly smooth. Registration, draws, scoring — everything in one place.',
    rating: 5,
    sport: 'Badminton',
    published: true,
    createdAt: null,
    createdBy: '',
  },
];

export function TestimonialsSection() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getDocs(
      query(
        collection(db, 'testimonials'),
        where('published', '==', true),
      ),
    )
      .then((snap) => {
        const docs = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as Testimonial))
          .sort((a, b) => {
            const ta = a.createdAt?.toDate?.()?.getTime() ?? 0;
            const tb = b.createdAt?.toDate?.()?.getTime() ?? 0;
            return tb - ta;
          })
          .slice(0, 6);
        setTestimonials(docs.length > 0 ? docs : FALLBACK);
      })
      .catch(() => setTestimonials(FALLBACK))
      .finally(() => setLoaded(true));
  }, []);

  const items = loaded ? testimonials : FALLBACK;

  return (
    <section className="py-16 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-xs text-yellow-400 font-bold uppercase tracking-widest mb-3">What People Say</p>
          <h2 className="text-4xl sm:text-5xl font-black text-white mb-4">Trusted by Organisers</h2>
          <p className="text-slate-200 text-base max-w-md mx-auto">
            Hear from the admins and players who&apos;ve run their events on Manchplay.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((t) => (
            <div
              key={t.id}
              className="group bg-slate-800 border border-slate-600 hover:border-yellow-400/50 rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl flex flex-col"
            >
              {/* Stars */}
              <div className="flex gap-0.5 mb-4">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} className={`h-3.5 w-3.5 ${n <= t.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-700'}`} />
                ))}
              </div>

              {/* Quote */}
              <p className="text-sm text-slate-100 italic leading-relaxed flex-1 mb-5">
                &ldquo;{t.quote}&rdquo;
              </p>

              {/* Author */}
              <div className="flex items-center gap-3 pt-4 border-t border-slate-600">
                <div className="w-9 h-9 rounded-full bg-yellow-400/15 border border-yellow-400/30 flex items-center justify-center text-yellow-400 font-black text-sm flex-shrink-0">
                  {t.author.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">{t.author}</p>
                  {t.authorRole && (
                    <p className="text-xs text-slate-200 truncate">{t.authorRole}</p>
                  )}
                </div>
                {t.sport && (
                  <span className="ml-auto text-xs bg-slate-800 border border-white/15 text-slate-300 rounded-full px-2 py-0.5 flex-shrink-0">
                    {t.sport}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
