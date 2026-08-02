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

export async function isBiometricLoginAvailable(): Promise<boolean> {
  if (!browserSupportsWebAuthn()) return false;
  return platformAuthenticatorIsAvailable();
}

export async function registerBiometricDevice(deviceName?: string): Promise<void> {
  const optionsJSON = await api.post<PublicKeyCredentialCreationOptionsJSON>('/webauthn/register-options', {});
  const response = await startRegistration({ optionsJSON });
  await api.post('/webauthn/register-verify', { response, deviceName });
}

export async function loginWithBiometrics(email: string): Promise<{ token: string; user: User }> {
  const optionsJSON = await api.post<PublicKeyCredentialRequestOptionsJSON>('/auth/webauthn/login-options', { email });
  const response = await startAuthentication({ optionsJSON });
  return api.post<{ token: string; user: User }>('/auth/webauthn/login-verify', { email, response });
}
