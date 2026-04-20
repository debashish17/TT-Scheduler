import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';

const Login = () => {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Signed in');
        navigate('/dashboard');
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
        {/* Logo */}
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

        {/* Mid copy */}
        <div>
          <p className="eyebrow mb-4" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Timetabling, solved
          </p>
          <h2 className="serif leading-[1] tracking-tight mb-6" style={{ fontSize: 52, color: 'var(--paper)' }}>
            Zero clashes.<br />
            <span className="italic" style={{ color: 'rgba(255,255,255,0.55)' }}>Guaranteed.</span>
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
            A CP-SAT constraint solver that builds complete, conflict-free timetables for schools and colleges in seconds.
          </p>
        </div>

        {/* Bottom stat strip */}
        <div className="grid grid-cols-3 gap-0" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 24 }}>
          {[
            { v: '3.4s', l: 'avg solve' },
            { v: '0',    l: 'clashes' },
            { v: '8',    l: 'constraints' },
          ].map((s, i) => (
            <div key={s.l} className="pr-4" style={{ borderRight: i < 2 ? '1px solid rgba(255,255,255,0.1)' : undefined, paddingLeft: i > 0 ? 16 : 0 }}>
              <div className="serif text-3xl" style={{ color: 'var(--paper)' }}>{s.v}</div>
              <div className="text-[11px] mono mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{s.l}</div>
            </div>
          ))}
        </div>
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

          <div className="mb-8">
            <h1 className="serif tracking-tight mb-2" style={{ fontSize: 40 }}>Welcome back.</h1>
            <p className="text-sm" style={{ color: 'var(--ink-3)' }}>Sign in to your workspace</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
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
                Password
              </label>
              <input
                type="password"
                required
                autoComplete="current-password"
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
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-sm text-center" style={{ color: 'var(--ink-3)' }}>
            No account?{' '}
            <Link to="/signup" className="font-medium underline underline-offset-4" style={{ color: 'var(--ink)' }}>
              Create one
            </Link>
          </p>

          <div className="mt-8 pt-8 text-center" style={{ borderTop: '1px solid var(--line)' }}>
            <Link to="/" className="text-[12px] mono transition-opacity hover:opacity-60" style={{ color: 'var(--ink-3)' }}>
              ← back to site
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
