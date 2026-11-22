import { Check, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PublicHeader } from '../components/layout/PublicHeader';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import type { User } from '../types';

export function AdminLoginPage() {
  const { user, setAuthenticatedUser } = useAuth();
  const navigate = useNavigate();

  const [checkingBootstrap, setCheckingBootstrap] = useState(true);
  const [needsBootstrap, setNeedsBootstrap] = useState(false);
  const [requiresSetupPasscode, setRequiresSetupPasscode] = useState(false);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [setupPasscode, setSetupPasscode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role === 'admin') {
      navigate('/admin', { replace: true });
      return;
    }

    let active = true;
    async function checkStatus() {
      try {
        const res = await apiRequest<{
          needsBootstrap: boolean;
          requiresSetupPasscode: boolean;
        }>('/api/auth/admin/bootstrap-status');
        if (active) {
          setNeedsBootstrap(res.needsBootstrap);
          setRequiresSetupPasscode(res.requiresSetupPasscode);
        }
      } catch {
        // Fallback to standard login if status check fails
      } finally {
        if (active) setCheckingBootstrap(false);
      }
    }
    void checkStatus();
    return () => {
      active = false;
    };
  }, [user, navigate]);

  const passwordChecks = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'Uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'Lowercase letter', met: /[a-z]/.test(password) },
    { label: 'Number', met: /[0-9]/.test(password) },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (needsBootstrap && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      if (needsBootstrap) {
        const res = await apiRequest<{ user: User; csrfToken: string }>(
          '/api/auth/admin/bootstrap',
          {
            method: 'POST',
            body: {
              fullName,
              email,
              password,
              confirmPassword,
              ...(requiresSetupPasscode ? { setupPasscode } : {}),
            },
          }
        );
        setAuthenticatedUser(res.user, res.csrfToken);
        navigate('/admin', { replace: true });
      } else {
        const res = await apiRequest<{ user: User; csrfToken: string }>('/api/auth/admin/login', {
          method: 'POST',
          body: { email, password },
        });
        setAuthenticatedUser(res.user, res.csrfToken);
        navigate('/admin', { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Administrator authentication failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <PublicHeader />

      <main className="mx-auto flex max-w-md flex-col justify-center px-4 py-14 sm:px-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2.5 text-blue-700 dark:text-blue-400">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            <span className="text-xs font-semibold tracking-wide">Administrator Portal</span>
          </div>

          <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
            {checkingBootstrap
              ? 'Checking portal status...'
              : needsBootstrap
                ? 'Initial Administrator Setup'
                : 'Administrator Sign In'}
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
            {needsBootstrap
              ? 'No administrator account exists yet. Create the initial administrator credentials to lock and secure the console.'
              : 'Sign in with an administrator account to review submissions and manage statuses.'}
          </p>

          {!checkingBootstrap && (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {needsBootstrap && (
                <div>
                  <label
                    htmlFor="admin-fullname"
                    className="block text-sm font-medium text-slate-700 dark:text-slate-200"
                  >
                    Administrator Name
                  </label>
                  <input
                    id="admin-fullname"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="System Administrator"
                    className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
              )}

              <div>
                <label
                  htmlFor="admin-email"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-200"
                >
                  Administrator Email
                </label>
                  <input
                    id="admin-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@organization.org"
                    className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="admin-password"
                    className="block text-sm font-medium text-slate-700 dark:text-slate-200"
                  >
                    Password
                  </label>
                  <div className="relative mt-1.5">
                    <input
                      id="admin-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete={needsBootstrap ? 'new-password' : 'current-password'}
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

                {needsBootstrap && (
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
                        htmlFor="admin-confirm-password"
                        className="block text-sm font-medium text-slate-700 dark:text-slate-200"
                      >
                        Confirm Password
                      </label>
                      <input
                        id="admin-confirm-password"
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

                  {requiresSetupPasscode && (
                    <div>
                      <label
                        htmlFor="admin-passcode"
                        className="block text-sm font-medium text-slate-700 dark:text-slate-200"
                      >
                        Environment Setup Passcode
                      </label>
                      <input
                        id="admin-passcode"
                        type="password"
                        required
                        value={setupPasscode}
                        onChange={(e) => setSetupPasscode(e.target.value)}
                        className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      />
                    </div>
                  )}
                </>
              )}

              {error && (
                <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-800 disabled:opacity-60 dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                {busy
                  ? 'Authenticating...'
                  : needsBootstrap
                    ? 'Initialize Administrator Account'
                    : 'Sign In to Admin Console'}
              </button>
            </form>
          )}

          <div className="mt-6 border-t border-slate-200 pt-5 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <Link to="/login" className="font-medium text-blue-700 hover:underline dark:text-blue-400">
              Applicant Sign In
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
