import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';

const Signup = () => {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [done, setDone]         = useState(false);
  const navigate = useNavigate();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        toast.error(error.message);
      } else {
        setDone(true);
      }
    } catch (err: any) {
      toast.error(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex paper-grain"
      style={{ background: 'var(--paper)', color: 'var(--ink)' }}
    >
      {/* Left panel — brand */}
      <div
        className="hidden lg:flex flex-col justify-between w-[480px] shrink-0 p-12"
        style={{ background: 'var(--ink)', color: 'var(--paper)' }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md border border-white/20 flex items-center justify-center">
            <div className="grid grid-cols-2 gap-[2px]">
              <div className="w-[4px] h-[4px] rounded-[1px] bg-white" />
              <div className="w-[4px] h-[4px] rounded-[1px] bg-white opacity-40" />
              <div className="w-[4px] h-[4px] rounded-[1px] bg-white opacity-40" />
              <div className="w-[4px] h-[4px] rounded-[1px] bg-white" />
            </div>
          </div>
          <span className="font-bold tracking-tight">TT-Scheduler</span>
        </div>

        <div>
          <p className="eyebrow mb-4" style={{ color: 'rgba(255,255,255,0.45)' }}>Get started free</p>
          <h2 className="serif leading-[1] tracking-tight mb-6" style={{ fontSize: 52, color: 'var(--paper)' }}>
            Schedule your<br />
            <span className="italic" style={{ color: 'rgba(255,255,255,0.55)' }}>whole term</span><br />
            in minutes.
          </h2>
          <ul className="space-y-3">
            {[
              'Works for schools and colleges',
              'Import teachers & rooms from Excel',
              'CP-SAT solver — 0 clashes guaranteed',
              'PDF, Excel & Google Calendar export',
            ].map(f => (
              <li key={f} className="flex items-center gap-3 text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
                <span className="w-4 h-4 rounded-full border border-white/30 flex items-center justify-center shrink-0">
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                {f}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-[11px] mono" style={{ color: 'rgba(255,255,255,0.25)' }}>
          Free plan · No credit card required
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-[400px]">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-10 lg:hidden">
            <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: 'var(--ink)' }}>
              <div className="grid grid-cols-2 gap-[1.5px]">
                <div className="w-[3px] h-[3px] bg-white" />
                <div className="w-[3px] h-[3px] bg-white opacity-40" />
                <div className="w-[3px] h-[3px] bg-white opacity-40" />
                <div className="w-[3px] h-[3px] bg-white" />
              </div>
            </div>
            <span className="font-bold tracking-tight">TT-Scheduler</span>
          </div>

          {done ? (
            /* Confirmation state */
            <div className="text-center">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: 'var(--brand-soft)' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--brand)' }}>
                  <path d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="serif text-4xl tracking-tight mb-3">Check your email</h2>
              <p className="text-sm mb-6" style={{ color: 'var(--ink-3)' }}>
                We sent a confirmation link to <strong style={{ color: 'var(--ink)' }}>{email}</strong>. Click it to activate your account.
              </p>
              <button
                onClick={() => navigate('/login')}
                className="w-full py-2.5 rounded-full text-sm font-medium"
                style={{ background: 'var(--ink)', color: 'var(--paper)' }}
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <h1 className="serif tracking-tight mb-2" style={{ fontSize: 40 }}>Create account.</h1>
                <p className="text-sm" style={{ color: 'var(--ink-3)' }}>Free forever for small institutions</p>
              </div>

              <form onSubmit={handleSignup} className="space-y-4">
                <div>
                  <label className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--ink-2)' }}>
                    Email address
                  </label>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@institution.edu"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-md text-sm outline-none transition-colors"
                    style={{ background: 'var(--paper)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                    onFocus={e => (e.target.style.borderColor = 'var(--ink)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--line)')}
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--ink-2)' }}>
                    Password <span className="font-normal" style={{ color: 'var(--ink-3)' }}>(min. 6 characters)</span>
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-md text-sm outline-none transition-colors"
                    style={{ background: 'var(--paper)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                    onFocus={e => (e.target.style.borderColor = 'var(--ink)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--line)')}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-full text-sm font-medium transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: 'var(--ink)', color: 'var(--paper)' }}
                >
                  {loading ? 'Creating account…' : 'Create account'}
                </button>
              </form>

              <p className="mt-6 text-sm text-center" style={{ color: 'var(--ink-3)' }}>
                Already have an account?{' '}
                <Link to="/login" className="font-medium underline underline-offset-4" style={{ color: 'var(--ink)' }}>
                  Sign in
                </Link>
              </p>

              <div className="mt-8 pt-8 text-center" style={{ borderTop: '1px solid var(--line)' }}>
                <Link to="/" className="text-[12px] mono transition-opacity hover:opacity-60" style={{ color: 'var(--ink-3)' }}>
                  ← back to site
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Signup;
