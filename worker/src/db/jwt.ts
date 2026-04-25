import { SignJWT, jwtVerify as joseVerify } from 'jose';
import { JWTPayload } from '../types';

function secretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signJWT(payload: Omit<JWTPayload, 'iat' | 'exp'>, secret: string): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secretKey(secret));
}

export async function jwtVerify(token: string, secret: string): Promise<JWTPayload> {
  const { payload } = await joseVerify(token, secretKey(secret));
  return payload as unknown as JWTPayload;
}

// Re-export so middleware can import from one place
export { joseVerify as importHmac };
