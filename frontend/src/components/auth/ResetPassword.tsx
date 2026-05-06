import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [ready, setReady]       = useState(false);
  const [done, setDone]         = useState(false);

  useEffect(() => {
    // Supabase v2 puts token_hash + type in the URL query params
    const params = new URLSearchParams(window.location.search);
    const token_hash = params.get('token_hash');
    const type = params.get('type');

    if (token_hash && type) {
      supabase.auth
        .verifyOtp({ token_hash, type: type as any })
        .then(({ error }) => {
          if (error) {
            toast.error('Invalid or expired reset link. Please request a new one.');
            navigate('/forgot-password');
          } else {
            setReady(true);
          }
        })
        .finally(() => setVerifying(false));
    } else {
      // Fall back to listening for PASSWORD_RECOVERY auth event (hash-based flow)
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') {
          setReady(true);
          setVerifying(false);
        }
      });

      // Also handle case where session was already exchanged
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setReady(true);
          setVerifying(false);
        } else {
          setVerifying(false);
        }
      });

      return () => subscription.unsubscribe();
    }
  }, [navigate]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast.error(error.message);
      } else {
        setDone(true);
        await supabase.auth.signOut();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  const BrandPanel = () => (
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
        <p className="eyebrow mb-4" style={{ color: 'rgba(255,255,255,0.45)' }}>Account security</p>
        <h2 className="serif leading-[1] tracking-tight mb-6" style={{ fontSize: 48, color: 'var(--paper)' }}>
          Choose a new<br />
          <span className="italic" style={{ color: 'rgba(255,255,255,0.55)' }}>password.</span>
        </h2>
        <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
          Your new password must be at least 6 characters. After changing it, you'll be signed out of all sessions.
        </p>
      </div>
      <p className="text-[11px] mono" style={{ color: 'rgba(255,255,255,0.25)' }}>Powered by Supabase Auth</p>
    </div>
  );

  const MobileLogo = () => (
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
  );

  return (
    <div
      className="min-h-screen flex paper-grain"
      style={{ background: 'var(--paper)', color: 'var(--ink)' }}
    >
      <BrandPanel />

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-[400px]">
          <MobileLogo />

          {verifying ? (
            <div className="text-center py-12">
              <div
                className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin mx-auto mb-4"
                style={{ borderColor: 'var(--ink)', borderTopColor: 'transparent' }}
              />
              <p className="text-sm" style={{ color: 'var(--ink-3)' }}>Verifying your reset link…</p>
            </div>

          ) : done ? (
            <div className="text-center">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-6"
                style={{ background: 'var(--brand-soft)' }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--brand)' }}>
                  <path d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="serif text-4xl tracking-tight mb-3">Password updated!</h2>
              <p className="text-sm mb-6" style={{ color: 'var(--ink-3)' }}>
                Your password has been changed. Sign in with your new credentials.
              </p>
              <button
                onClick={() => navigate('/login')}
                className="w-full py-2.5 rounded-full text-sm font-medium transition-opacity hover:opacity-90"
                style={{ background: 'var(--ink)', color: 'var(--paper)' }}
              >
                Sign in
              </button>
            </div>

          ) : !ready ? (
            <div className="text-center">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-4" style={{ color: 'var(--err)' }}>
                <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              </svg>
              <h2 className="serif text-3xl tracking-tight mb-3">Link expired</h2>
              <p className="text-sm mb-6" style={{ color: 'var(--ink-3)' }}>
                This password reset link is invalid or has expired. Request a new one.
              </p>
              <Link
                to="/forgot-password"
                className="block w-full py-2.5 rounded-full text-sm font-medium text-center transition-opacity hover:opacity-90"
                style={{ background: 'var(--ink)', color: 'var(--paper)' }}
              >
                Request new link
              </Link>
            </div>

          ) : (
            <>
              <div className="mb-8">
                <h1 className="serif tracking-tight mb-2" style={{ fontSize: 40 }}>New password.</h1>
                <p className="text-sm" style={{ color: 'var(--ink-3)' }}>Choose something strong and memorable</p>
              </div>

              <form onSubmit={handleReset} className="space-y-4">
                <div>
                  <label className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--ink-2)' }}>
                    New password{' '}
                    <span className="font-normal" style={{ color: 'var(--ink-3)' }}>(min. 6 characters)</span>
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

                <div>
                  <label className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--ink-2)' }}>
                    Confirm new password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
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
                  {loading ? 'Updating password…' : 'Update password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
