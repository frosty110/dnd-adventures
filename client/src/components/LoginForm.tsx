import { useState } from 'react';
import { setAuthTokens } from '../services/auth';
import { API_BASE } from '../services/apiBase';

interface LoginFormProps {
  onSuccess: () => void;
}

type Mode = 'login' | 'register';

export function LoginForm({ onSuccess }: LoginFormProps) {
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const endpoint = mode === 'login' ? `${API_BASE}/api/auth/login` : `${API_BASE}/api/auth/register`;

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json() as {
        token?: string;
        refreshToken?: string;
        username?: string;
        error?: string;
      };

      if (!res.ok) {
        setError(data.error ?? `${mode === 'login' ? 'Login' : 'Registration'} failed`);
        return;
      }

      if (!data.token || !data.refreshToken || !data.username) {
        setError('Unexpected server response. Please try again.');
        return;
      }

      setAuthTokens(data.token, data.refreshToken, data.username);
      onSuccess();
    } catch {
      setError('Unable to reach the server. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  }

  function toggleMode() {
    setMode(m => m === 'login' ? 'register' : 'login');
    setError('');
    setUsername('');
    setPassword('');
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        {/* Title */}
        <h1
          className="font-cinzel font-bold text-3xl tracking-widest text-center mb-2"
          style={{ color: 'var(--color-dm-gold)', textShadow: '0 0 12px oklch(0.75 0.15 55 / 0.6)' }}
        >
          D&D Adventures
        </h1>
        <p className="font-fell text-parchment/60 text-center mb-8 text-lg">
          {mode === 'login' ? 'Enter your realm' : 'Create your legend'}
        </p>

        {/* Form */}
        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="font-cinzel text-xs tracking-widest text-parchment/70 uppercase">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="3-20 characters"
              autoComplete={mode === 'register' ? 'username' : 'username'}
              required
              disabled={isLoading}
              className="bg-surface border border-blood/50 text-parchment font-fell text-base px-3 py-2 focus:outline-none focus:border-blood placeholder-parchment/30 disabled:opacity-50"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-cinzel text-xs tracking-widest text-parchment/70 uppercase">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="8+ characters"
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              required
              disabled={isLoading}
              className="bg-surface border border-blood/50 text-parchment font-fell text-base px-3 py-2 focus:outline-none focus:border-blood placeholder-parchment/30 disabled:opacity-50"
            />
          </div>

          {error && (
            <p className="font-fell text-sm text-blood-light text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={isLoading || !username || !password}
            className="font-cinzel text-base text-parchment px-6 py-3 border border-blood bg-blood/20 hover:bg-blood/40 tracking-widest mt-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading
              ? (mode === 'login' ? 'Entering...' : 'Creating...')
              : (mode === 'login' ? 'Enter Realm' : 'Create Legend')}
          </button>
        </form>

        {/* Toggle mode */}
        <div className="mt-6 text-center">
          <button
            onClick={toggleMode}
            disabled={isLoading}
            className="font-fell text-parchment/60 hover:text-parchment text-sm disabled:opacity-50 transition-colors"
          >
            {mode === 'login'
              ? "New adventurer? Create an account"
              : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
