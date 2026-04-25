/// <reference types="@cloudflare/workers-types" />
export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  HOLDSPORT_USER: string;
  HOLDSPORT_PASS: string;
  CORS_ORIGIN: string;
}

export interface JWTPayload {
  sub: string;       // user id
  org: string;       // org id
  role: 'admin' | 'coach';
  iat: number;
  exp: number;
}

export interface AuthedRequest extends Request {
  user: JWTPayload;
}
