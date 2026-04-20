import React from 'react';

// ─── Button ───────────────────────────────────────────────────────────────────
type BtnVariant = 'primary' | 'brand' | 'ghost' | 'soft' | 'link';
type BtnSize    = 'sm' | 'md' | 'lg';

interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  size?: BtnSize;
  as?: 'button' | 'a';
  href?: string;
}

const sizeMap: Record<BtnSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-5 py-3 text-sm',
};
const variantMap: Record<BtnVariant, string> = {
  primary: 'bg-[var(--ink)] text-[var(--paper)] hover:opacity-90',
  brand:   'bg-[var(--brand)] text-white hover:bg-[var(--brand-deep)]',
  ghost:   'bg-transparent text-[var(--ink)] hover:bg-[var(--paper-2)] edge',
  soft:    'bg-[var(--paper-2)] text-[var(--ink)] hover:bg-[var(--line)]',
  link:    'bg-transparent underline underline-offset-4 decoration-[var(--line-2)] hover:decoration-[var(--ink)]',
};

export const Btn: React.FC<BtnProps> = ({
  children, variant = 'primary', size = 'md', className = '', as: Tag = 'button', href, ...rest
}) => {
  const cls = `inline-flex items-center gap-2 rounded-full font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${sizeMap[size]} ${variantMap[variant]} ${className}`;
  if (Tag === 'a') return <a href={href} className={cls}>{children}</a>;
  return <button className={cls} {...rest}>{children}</button>;
};

// ─── Eyebrow ──────────────────────────────────────────────────────────────────
export const Eyebrow: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <span className={`eyebrow text-[var(--ink-3)] ${className}`}>{children}</span>
);

// ─── Chip ─────────────────────────────────────────────────────────────────────
type ChipTone = 'neutral' | 'brand' | 'ok' | 'warn' | 'err' | 'ink';
const chipToneMap: Record<ChipTone, string> = {
  neutral: 'bg-[var(--paper-2)] text-[var(--ink-2)] edge',
  brand:   'bg-[var(--brand-soft)] text-[var(--brand-deep)]',
  ok:      'bg-[var(--brand-soft)] text-[var(--ok)]',
  warn:    'bg-[var(--accent-soft,#FEF3E6)] text-[var(--warn)]',
  err:     'bg-[var(--accent-soft,#FEF3E6)] text-[var(--err)]',
  ink:     'bg-[var(--ink)] text-[var(--paper)]',
};

export const Chip: React.FC<{ children: React.ReactNode; tone?: ChipTone; className?: string }> = ({
  children, tone = 'neutral', className = '',
}) => (
  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${chipToneMap[tone]} ${className}`}>
    {children}
  </span>
);

// ─── Dot ──────────────────────────────────────────────────────────────────────
export const Dot: React.FC<{ color?: string }> = ({ color = 'var(--brand)' }) => (
  <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: color }} />
);

// ─── Icon (inline SVG) ────────────────────────────────────────────────────────
interface IconProps { name: string; size?: number; className?: string }

export const Icon: React.FC<IconProps> = ({ name, size = 16, className = '' }) => {
  const p: React.SVGProps<SVGSVGElement> = {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round',
    className,
  };
  switch (name) {
    case 'arrow':    return <svg {...p}><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
    case 'arrow-ul': return <svg {...p}><path d="M7 17L17 7M17 17V7H7"/></svg>;
    case 'check':    return <svg {...p}><path d="M5 13l4 4L19 7"/></svg>;
    case 'x':        return <svg {...p}><path d="M6 6l12 12M6 18L18 6"/></svg>;
    case 'plus':     return <svg {...p}><path d="M12 5v14M5 12h14"/></svg>;
    case 'cal':      return <svg {...p}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>;
    case 'grid':     return <svg {...p}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
    case 'users':    return <svg {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
    case 'door':     return <svg {...p}><path d="M4 21h16M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16M15 12h.01"/></svg>;
    case 'book':     return <svg {...p}><path d="M4 4v16a2 2 0 0 0 2 2h14V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2z"/><path d="M4 4h14"/></svg>;
    case 'clock':    return <svg {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
    case 'lock':     return <svg {...p}><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>;
    case 'sparkle':  return <svg {...p}><path d="M12 3l1.5 5L19 9.5 13.5 11 12 16l-1.5-5L5 9.5 10.5 8 12 3z"/></svg>;
    case 'bolt':     return <svg {...p}><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/></svg>;
    case 'play':     return <svg {...p}><path d="M6 4l14 8-14 8V4z" fill="currentColor" stroke="none"/></svg>;
    case 'dl':       return <svg {...p}><path d="M12 3v13M6 11l6 6 6-6M4 21h16"/></svg>;
    case 'file':     return <svg {...p}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6z"/><path d="M14 3v6h6"/></svg>;
    case 'search':   return <svg {...p}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>;
    case 'menu':     return <svg {...p}><path d="M3 6h18M3 12h18M3 18h18"/></svg>;
    case 'dots':     return <svg {...p}><circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/></svg>;
    case 'filter':   return <svg {...p}><path d="M4 5h16M7 12h10M10 19h4"/></svg>;
    case 'history':  return <svg {...p}><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></svg>;
    case 'import':   return <svg {...p}><path d="M12 3v13M6 11l6 6 6-6M4 21h16"/></svg>;
    case 'stack':    return <svg {...p}><path d="M12 2l10 6-10 6L2 8l10-6zM2 14l10 6 10-6M2 18l10 6 10-6"/></svg>;
    case 'settings': return <svg {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>;
    case 'home':     return <svg {...p}><path d="M3 10l9-7 9 7v10a2 2 0 0 1-2 2h-4v-6H9v6H5a2 2 0 0 1-2-2V10z"/></svg>;
    case 'up':       return <svg {...p}><path d="M12 19V5M5 12l7-7 7 7"/></svg>;
    case 'board':    return <svg {...p}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/></svg>;
    case 'spark':    return <svg {...p}><path d="M3 17l4-4 4 3 10-10"/></svg>;
    case 'brain':    return <svg {...p}><path d="M9.5 4a3 3 0 0 0-3 3v1a3 3 0 0 0-2 5 3 3 0 0 0 2 5v1a3 3 0 0 0 6 0V4a3 3 0 0 0-3 0zM14.5 4a3 3 0 0 1 3 3v1a3 3 0 0 1 2 5 3 3 0 0 1-2 5v1a3 3 0 0 1-6 0"/></svg>;
    default: return null;
  }
};

// ─── TopBar ───────────────────────────────────────────────────────────────────
export const TopBar: React.FC<{ title: string; crumbs?: string[]; actions?: React.ReactNode }> = ({
  title, crumbs = [], actions,
}) => (
  <div className="sticky top-0 z-20 backdrop-blur border-b border-[var(--line)]" style={{ background: 'rgba(250,249,246,0.9)' }}>
    <div className="px-8 h-14 flex items-center justify-between gap-4">
      <div className="flex items-center gap-2 min-w-0 text-sm">
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            <span className="text-[var(--ink-3)] truncate">{c}</span>
            <span className="text-[var(--ink-3)]">/</span>
          </React.Fragment>
        ))}
        <span className="font-semibold truncate">{title}</span>
      </div>
      <div className="flex items-center gap-2">{actions}</div>
    </div>
  </div>
);
