import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'TourneyCraft — Run Sports Tournaments End to End';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 64,
          background: 'linear-gradient(135deg, #020617 0%, #0f172a 45%, #1e3a8a 100%)',
          color: '#ffffff',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 18,
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 34,
              fontWeight: 800,
              color: '#0f172a',
            }}
          >
            TC
          </div>
          <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: -0.5 }}>
            TourneyCraft
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 980 }}>
          <div
            style={{
              fontSize: 64,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: -1.5,
            }}
          >
            Run sports tournaments end to end
          </div>
          <div style={{ fontSize: 28, color: '#cbd5e1', lineHeight: 1.35 }}>
            Online registration, smart draws, live scoring, and results — for clubs,
            communities, and organisations.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 22,
            color: '#94a3b8',
          }}
        >
          <div style={{ display: 'flex', gap: 24 }}>
            <span>Badminton</span>
            <span>Table Tennis</span>
            <span>Volleyball</span>
            <span>Throw Ball</span>
          </div>
          <div style={{ color: '#fbbf24', fontWeight: 700 }}>tourneycraft.app</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
