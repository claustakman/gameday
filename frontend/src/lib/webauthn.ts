import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
} from '@simplewebauthn/browser';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import { api } from './api';
import { User } from './auth';

const ENROLLED_KEY    = 'gd_bio_enrolled';
const DISMISSED_KEY   = 'gd_bio_prompt_dismissed';
const PROMPT_CHECK_KEY = 'gd_bio_prompt_check';

export async function isBiometricLoginAvailable(): Promise<boolean> {
  if (!browserSupportsWebAuthn()) return false;
  return platformAuthenticatorIsAvailable();
}

export async function registerBiometricDevice(deviceName?: string): Promise<void> {
  const optionsJSON = await api.post<PublicKeyCredentialCreationOptionsJSON>('/webauthn/register-options', {});
  const response = await startRegistration({ optionsJSON });
  await api.post('/webauthn/register-verify', { response, deviceName });
  localStorage.setItem(ENROLLED_KEY, '1');
}

export async function loginWithBiometrics(email: string): Promise<{ token: string; user: User }> {
  const optionsJSON = await api.post<PublicKeyCredentialRequestOptionsJSON>('/auth/webauthn/login-options', { email });
  const response = await startAuthentication({ optionsJSON });
  const res = await api.post<{ token: string; user: User }>('/auth/webauthn/login-verify', { email, response });
  localStorage.setItem(ENROLLED_KEY, '1');
  return res;
}

// ── Local, per-device "offer to set up biometrics?" bookkeeping ────────
// Not authoritative (cleared localStorage forgets it), but matches the
// standard "don't nag the user" pattern for this kind of one-time prompt.

export function hasEnrolledOnThisDevice(): boolean {
  return localStorage.getItem(ENROLLED_KEY) === '1';
}

export function isBiometricPromptDismissed(): boolean {
  return localStorage.getItem(DISMISSED_KEY) === '1';
}

export function dismissBiometricPromptForever(): void {
  localStorage.setItem(DISMISSED_KEY, '1');
}

// One-shot signal: set right after a password login, consumed by
// BiometricSetupPrompt on its next mount so it only offers itself once,
// right after an active login — not on every page load.
export function signalBiometricPromptCheck(): void {
  sessionStorage.setItem(PROMPT_CHECK_KEY, '1');
}

export function consumeBiometricPromptCheck(): boolean {
  const pending = sessionStorage.getItem(PROMPT_CHECK_KEY) === '1';
  sessionStorage.removeItem(PROMPT_CHECK_KEY);
  return pending;
}
