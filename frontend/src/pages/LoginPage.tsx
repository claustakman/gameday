import { useState, FormEvent, useEffect } from 'react';
import { useAuth, getLastEmail } from '../lib/auth';
import { api } from '../lib/api';
import { isBiometricLoginAvailable, loginWithBiometrics, signalBiometricPromptCheck } from '../lib/webauthn';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail]       = useState(getLastEmail);
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioLoading, setBioLoading]     = useState(false);

  useEffect(() => {
    isBiometricLoginAvailable().then(setBioAvailable).catch(() => setBioAvailable(false));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post<{ token: string; user: { id: string; email: string; name: string; role: 'admin' | 'coach' } }>(
        '/auth/login', { email, password }
      );
      signalBiometricPromptCheck();
      login(res.token, res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fejl ved login');
    } finally {
      setLoading(false);
    }
  }

  async function handleBiometricLogin() {
    if (!email) { setError('Indtast din email for at logge ind med Face ID/Touch ID'); return; }
    setError('');
    setBioLoading(true);
    try {
      const res = await loginWithBiometrics(email);
      login(res.token, res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke logge ind med Face ID/Touch ID');
    } finally {
      setBioLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-green mb-1">Gameday</h1>
        <p className="text-text2 text-sm mb-8">Ajax U11 holdstyringsapp</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-text1 mb-1">E-mail</label>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2.5 text-text1 bg-bg focus:outline-none focus:ring-2 focus:ring-green"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text1 mb-1">Adgangskode</label>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2.5 text-text1 bg-bg focus:outline-none focus:ring-2 focus:ring-green"
            />
          </div>
          {error && <p className="text-red text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="bg-green text-white rounded-lg py-3 font-semibold disabled:opacity-50"
          >
            {loading ? 'Logger ind…' : 'Log ind'}
          </button>

          {bioAvailable && (
            <button
              type="button"
              onClick={handleBiometricLogin}
              disabled={bioLoading}
              className="border border-border text-text1 rounded-lg py-3 font-semibold disabled:opacity-50"
            >
              {bioLoading ? 'Logger ind…' : '🔐 Log ind med Face ID / Touch ID'}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
