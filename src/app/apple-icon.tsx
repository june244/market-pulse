import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          background: 'linear-gradient(135deg, #0a0a0f 0%, #12121a 100%)',
          borderRadius: 40,
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
            gap: 8,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: '#00ff87',
              boxShadow: '0 0 30px rgba(0,255,135,0.6)',
            }}
          />
          <div
            style={{
              fontSize: 24,
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
    { ...size }
  );
}
