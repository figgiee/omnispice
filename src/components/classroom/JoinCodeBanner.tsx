import { useState } from 'react';

interface Props {
  code: string;
}

/**
 * Instructor-only banner that shows the course join code and a shareable URL
 * with one-click copy buttons. Per D-11, D-22.
 */
export function JoinCodeBanner({ code }: Props) {
  const [copied, setCopied] = useState<'code' | 'url' | null>(null);
  const url = `${window.location.origin}/join/${code}`;

  async function copy(value: string, which: 'code' | 'url') {
    await navigator.clipboard.writeText(value);
    setCopied(which);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-default)',
        borderRadius: 8,
        padding: '16px 20px',
        marginBottom: 24,
        display: 'flex',
        gap: 16,
        alignItems: 'center',
        flexWrap: 'wrap',
      }}
    >
      <div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Join code</div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 24,
            letterSpacing: 2,
            color: 'var(--text-primary)',
          }}
        >
          {code}
        </div>
      </div>
      <button
        type="button"
        onClick={() => copy(code, 'code')}
        style={{
          background: 'var(--surface-primary)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-default)',
          borderRadius: 4,
          padding: '6px 12px',
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 500,
          transition: 'all 120ms ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--accent-primary)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--border-default)';
        }}
      >
        {copied === 'code' ? 'Copied!' : 'Copy code'}
      </button>
      <button
        type="button"
        onClick={() => copy(url, 'url')}
        style={{
          background: 'var(--surface-primary)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-default)',
          borderRadius: 4,
          padding: '6px 12px',
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 500,
          transition: 'all 120ms ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--accent-primary)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--border-default)';
        }}
      >
        {copied === 'url' ? 'Copied!' : 'Copy invite URL'}
      </button>
    </div>
  );
}
