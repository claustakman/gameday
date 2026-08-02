import { useEffect, useState } from 'react';
import {
  isBiometricLoginAvailable,
  hasEnrolledOnThisDevice,
  isBiometricPromptDismissed,
  dismissBiometricPromptForever,
  consumeBiometricPromptCheck,
  registerBiometricDevice,
} from '../lib/webauthn';

export default function BiometricSetupPrompt() {
  const [show,    setShow]    = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  useEffect(() => {
    if (!consumeBiometricPromptCheck()) return;
    if (hasEnrolledOnThisDevice() || isBiometricPromptDismissed()) return;
    isBiometricLoginAvailable().then(available => { if (available) setShow(true); });
  }, []);

  if (!show) return null;

  async function enable() {
    setError(''); setSaving(true);
    try {
      await registerBiometricDevice();
      setShow(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke aktivere');
    } finally {
      setSaving(false);
    }
  }

  function dontAskAgain() {
    dismissBiometricPromptForever();
    setShow(false);
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setShow(false)} />

      <div
        className="fixed left-0 right-0 z-50 bg-bg rounded-t-2xl shadow-xl px-4 pt-3"
        style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom))', paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
      >
        <div className="flex justify-center pb-2">
          <div className="w-10 h-1 bg-border rounded-full" />
        </div>

        <p className="text-3xl text-center mb-2">🔐</p>
        <h2 className="text-lg font-bold text-text1 text-center mb-1">Aktivér Face ID / Touch ID?</h2>
        <p className="text-sm text-text3 text-center mb-4">Log ind hurtigere på denne enhed fremover — uden kodeord.</p>

        {error && <p className="text-red text-sm text-center mb-3">{error}</p>}

        <div className="flex flex-col gap-2 pb-2">
          <button
            onClick={enable}
            disabled={saving}
            className="w-full bg-green text-white rounded-xl py-3 font-semibold text-sm disabled:opacity-50"
          >
            {saving ? 'Aktiverer…' : 'Aktivér'}
          </button>
          <button onClick={() => setShow(false)} className="w-full text-text2 rounded-xl py-2.5 text-sm font-medium">
            Ikke nu
          </button>
          <button onClick={dontAskAgain} className="w-full text-text3 rounded-xl py-1.5 text-xs">
            Spørg ikke igen
          </button>
        </div>
      </div>
    </>
  );
}
