import { signIn, auth } from '@/auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: { from?: string; error?: string };
}

export default async function LoginPage({ searchParams }: PageProps) {
  const session = await auth();
  if (session?.user) {
    redirect(searchParams.from || '/');
  }

  const errorMessage =
    searchParams.error === 'AccessDenied'
      ? '허용되지 않은 계정입니다.'
      : searchParams.error
      ? '로그인에 실패했습니다.'
      : null;

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: 'var(--bg-primary)',
      }}
    >
      <div style={{ width: '100%', maxWidth: '360px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '32px',
            paddingBottom: '12px',
            borderBottom: '1px solid var(--text-primary)',
          }}
        >
          <div style={{ position: 'relative', width: '12px', height: '12px' }}>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                border: '1px solid var(--text-primary)',
                borderRadius: '50%',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: '3px',
                left: '3px',
                width: '4px',
                height: '4px',
                background: 'var(--text-primary)',
                borderRadius: '50%',
              }}
            />
          </div>
          <span
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '9px',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'var(--text-secondary)',
            }}
          >
            Market Pulse
          </span>
        </div>

        <h1
          style={{
            fontFamily: 'Inter Tight, sans-serif',
            fontSize: '28px',
            fontWeight: 300,
            letterSpacing: '-0.02em',
            color: 'var(--text-primary)',
            marginBottom: '8px',
          }}
        >
          로그인
        </h1>
        <p
          style={{
            fontFamily: 'Inter Tight, sans-serif',
            fontSize: '13px',
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            marginBottom: '28px',
          }}
        >
          허용된 Google 계정으로만 접근 가능합니다.
        </p>

        {errorMessage && (
          <div
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '10px',
              color: 'var(--accent-red)',
              border: '1px solid var(--accent-red)',
              padding: '8px 10px',
              marginBottom: '20px',
              letterSpacing: '0.05em',
            }}
          >
            {errorMessage}
          </div>
        )}

        <form
          action={async () => {
            'use server';
            await signIn('google', { redirectTo: searchParams.from || '/' });
          }}
        >
          <button
            type="submit"
            style={{
              width: '100%',
              background: 'transparent',
              border: '1px solid var(--text-primary)',
              padding: '14px 16px',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '11px',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
            }}
          >
            Continue with Google
          </button>
        </form>
      </div>
    </main>
  );
}
