import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sizeParam = parseInt(searchParams.get('size') || '192', 10);
  const size = sizeParam === 512 ? 512 : 192;

  const dotSize = Math.round(size * 0.18);
  const fontSize = Math.round(size * 0.15);
  const radius = Math.round(size * 0.22);

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          background: 'linear-gradient(135deg, #0a0a0f 0%, #12121a 100%)',
          borderRadius: radius,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: Math.round(size * 0.04),
          }}
        >
          <div
            style={{
              width: dotSize,
              height: dotSize,
              borderRadius: '50%',
              background: '#00ff87',
              boxShadow: `0 0 ${Math.round(size * 0.08)}px rgba(0,255,135,0.6)`,
            }}
          />
          <div
            style={{
              fontSize,
              fontWeight: 700,
              color: '#e8e8f0',
              letterSpacing: -1,
              fontFamily: 'monospace',
            }}
          >
            MP
          </div>
        </div>
      </div>
    ),
    { width: size, height: size }
  );
}
