import { Check, Eye, EyeOff, Info } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { PublicHeader } from '../components/layout/PublicHeader';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import type { User } from '../types';

type AuthMode = 'login' | 'register' | 'forgot' | 'reset';

export function AuthPage({ mode }: { mode: AuthMode }) {
  const { setAuthenticatedUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTarget = searchParams.get('redirect') || '/dashboard';
  const urlToken = searchParams.get('token') || '';

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState(urlToken);
  const [showPassword, setShowPassword] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgotResult, setForgotResult] = useState<{
    message: string;
    devResetPath?: string;
    devResetToken?: string;
  } | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);

  useEffect(() => {
    setError(null);
    setForgotResult(null);
    setResetSuccess(false);
    setPassword('');
    setConfirmPassword('');
    if (mode === 'reset') {
      setResetToken(urlToken);
    }
  }, [mode, urlToken]);

  const passwordChecks = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'Uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'Lowercase letter', met: /[a-z]/.test(password) },
    { label: 'Number', met: /[0-9]/.test(password) },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if ((mode === 'register' || mode === 'reset') && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setBusy(true);

    try {
      if (mode === 'login') {
        const res = await apiRequest<{ user: User; csrfToken: string }>('/api/auth/login', {
          method: 'POST',
          body: { email, password },
        });
        setAuthenticatedUser(res.user, res.csrfToken);
        navigate(redirectTarget, { replace: true });
      } else if (mode === 'register') {
        const res = await apiRequest<{ user: User; csrfToken: string }>('/api/auth/register', {
          method: 'POST',
          body: { fullName, email, password, confirmPassword },
        });
        setAuthenticatedUser(res.user, res.csrfToken);
        navigate(redirectTarget, { replace: true });
      } else if (mode === 'forgot') {
        const res = await apiRequest<{
          message: string;
          devResetPath?: string;
          devResetToken?: string;
        }>('/api/auth/forgot-password', {
          method: 'POST',
          body: { email },
        });
        setForgotResult(res);
      } else if (mode === 'reset') {
        await apiRequest('/api/auth/reset-password', {
          method: 'POST',
          body: { token: resetToken, password, confirmPassword },
        });
        setResetSuccess(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <PublicHeader />

      <main className="mx-auto flex max-w-md flex-col justify-center px-4 py-14 sm:px-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900">
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
            {mode === 'login' && 'Sign in to your account'}
            {mode === 'register' && 'Create an applicant account'}
            {mode === 'forgot' && 'Recover your password'}
            {mode === 'reset' && 'Set a new password'}
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
            {mode === 'login' && 'Access your saved drafts, documents, and submitted applications.'}
            {mode === 'register' && 'Your form drafts will automatically sync to your account.'}
            {mode === 'forgot' && 'Enter your registered email address to request a password reset.'}
            {mode === 'reset' && 'Choose a strong new password for your account.'}
          </p>

          {resetSuccess ? (
            <div className="mt-6 space-y-4">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
                Your password has been updated and all prior sessions were revoked.
              </div>
              <Link
                to="/login"
                className="block w-full rounded-lg bg-blue-700 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-blue-800 dark:bg-blue-600"
              >
                Continue to Sign In
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {mode === 'register' && (
                <div>
                  <label
                    htmlFor="auth-fullname"
                    className="block text-sm font-medium text-slate-700 dark:text-slate-200"
                  >
                    Full Name
                  </label>
                  <input
                    id="auth-fullname"
                    type="text"
                    required
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jordan Alex Mercer"
                    className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
              )}

              {mode !== 'reset' && (
                <div>
                  <label
                    htmlFor="auth-email"
                    className="block text-sm font-medium text-slate-700 dark:text-slate-200"
                  >
                    Email Address
                  </label>
                  <input
                    id="auth-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@organization.org"
                    className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
              )}

              {mode === 'reset' && (
                <div>
                  <label
                    htmlFor="auth-reset-token"
                    className="block text-sm font-medium text-slate-700 dark:text-slate-200"
                  >
                    Reset Token
                  </label>
                  <input
                    id="auth-reset-token"
                    type="text"
                    required
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-xs text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
              )}

              {mode !== 'forgot' && (
                <div>
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="auth-password"
                      className="block text-sm font-medium text-slate-700 dark:text-slate-200"
                    >
                      Password
                    </label>
                    {mode === 'login' && (
                      <Link
                        to="/forgot-password"
                        className="text-xs font-medium text-blue-700 hover:underline dark:text-blue-400"
                      >
                        Forgot password?
                      </Link>
                    )}
                  </div>
                  <div className="relative mt-1.5">
                    <input
                      id="auth-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 pr-10 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((p) => !p)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute inset-y-0 right-0 flex items-center rounded-r-lg px-3 text-slate-400 hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-blue-600 dark:hover:text-slate-200"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {(mode === 'register' || mode === 'reset') && (
                <>
                  <ul className="grid grid-cols-2 gap-1.5 text-xs" aria-label="Password requirements">
                    {passwordChecks.map((check) => (
                      <li
                        key={check.label}
                        className={`flex items-center gap-1.5 ${
                          check.met
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>{check.label}</span>
                      </li>
                    ))}
                  </ul>

                  <div>
                    <label
                      htmlFor="auth-confirm-password"
                      className="block text-sm font-medium text-slate-700 dark:text-slate-200"
                    >
                      Confirm Password
                    </label>
                    <input
                      id="auth-confirm-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                    {confirmPassword.length > 0 && password !== confirmPassword && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                        Passwords do not match.
                      </p>
                    )}
                  </div>
                </>
              )}

              {error && (
                <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
                  {error}
                </p>
              )}

              {forgotResult && (
                <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50/70 p-3.5 text-xs text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200">
                  <div className="flex items-start gap-2">
                    <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{forgotResult.message}</span>
                  </div>
                  {forgotResult.devResetPath && (
                    <div className="border-t border-blue-200 pt-2 dark:border-blue-800">
                      <p className="font-medium">Development-only reset workflow:</p>
                      <Link
                        to={forgotResult.devResetPath}
                        className="mt-1 inline-block font-mono text-blue-700 underline dark:text-blue-300"
                      >
                        Open Password Reset Form
                      </Link>
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-800 disabled:opacity-60 dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                {busy
                  ? 'Please wait...'
                  : mode === 'login'
                    ? 'Sign In'
                    : mode === 'register'
                      ? 'Create Account'
                      : mode === 'forgot'
                        ? 'Generate Reset Link'
                        : 'Update Password'}
              </button>
            </form>
          )}

          <div className="mt-6 border-t border-slate-200 pt-5 text-center text-xs text-slate-600 dark:border-slate-800 dark:text-slate-400">
            {mode === 'login' ? (
              <span>
                Need an account?{' '}
                <Link to="/register" className="font-medium text-blue-700 hover:underline dark:text-blue-400">
                  Create one
                </Link>
              </span>
            ) : (
              <span>
                Already have an account?{' '}
                <Link to="/login" className="font-medium text-blue-700 hover:underline dark:text-blue-400">
                  Sign in
                </Link>
              </span>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
