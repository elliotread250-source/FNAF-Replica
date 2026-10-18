import type { Cosmetic, PublicUser } from '@fnaf/shared';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body !== undefined ? { 'content-type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as { error?: { code: string; message: string } } & T;
  if (!res.ok) throw new ApiError(res.status, json.error?.code ?? 'error', json.error?.message ?? 'Lost signal. Try again.');
  return json;
}

export interface MeResponse {
  user: PublicUser;
  cosmetics: string[];
  progress: Record<string, { highestNight: number; presetsBeaten: string[] }>;
  stats: Record<string, number | Record<string, number>> | null;
  achievements: { id: string; at: string }[];
  archive: { kind: string; id: string }[];
}

export interface ServerConfig {
  rosterMode: 'tribute' | 'original';
  smtp: boolean;
  fastNight: boolean;
  testHooks?: boolean;
  ice: RTCIceServer[];
}

export const api = {
  config: () => call<ServerConfig>('GET', '/api/config'),
  me: () => call<MeResponse>('GET', '/api/me'),
  signup: (username: string, password: string, email?: string) => call<{ user: PublicUser }>('POST', '/api/auth/signup', { username, password, email }),
  login: (username: string, password: string) => call<{ user: PublicUser }>('POST', '/api/auth/login', { username, password }),
  guest: () => call<{ user: PublicUser }>('POST', '/api/auth/guest', {}),
  claim: (username: string, password: string, email?: string) => call<{ user: PublicUser }>('POST', '/api/auth/claim', { username, password, email }),
  logout: () => call<{ ok: true }>('POST', '/api/auth/logout', {}),
  forgot: (email: string) => call<{ ok: true }>('POST', '/api/auth/forgot', { email }),
  reset: (token: string, password: string) => call<{ ok: true }>('POST', '/api/auth/reset', { token, password }),
  patchMe: (b: { displayName?: string; settings?: Record<string, unknown> }) => call<{ user: PublicUser }>('PATCH', '/api/me', b),
  password: (current: string, next: string) => call<{ ok: true }>('PUT', '/api/me/password', { current, next }),
  equip: (slot: string, cosmeticId: string) => call<{ equipped: Record<string, string>; achievements: string[] }>('PUT', '/api/me/equipped', { slot, cosmeticId }),
  deleteMe: (password: string) => call<{ ok: true }>('DELETE', '/api/me', { password }),
  archive: (kind: string, id: string) => call<{ achievements: string[] }>('POST', '/api/me/archive', { kind, id }),
  honk: () => call<{ achievements: string[] }>('POST', '/api/me/honk', {}),
  cosmetics: () => call<{ catalogue: Cosmetic[]; rotation: string[]; buyable: string[] }>('GET', '/api/cosmetics'),
  buy: (cosmeticId: string) => call<{ fazTokens: number; cosmetics: string[]; achievements: string[] }>('POST', '/api/shop/buy', { cosmeticId }),
  profile: (username: string) => call<Omit<MeResponse, 'cosmetics' | 'archive'>>('GET', `/api/profile/${encodeURIComponent(username)}`),
  leaderboard: (board: string) => call<{ board: string; rows: { name: string; username: string; stars: number; value: number }[] }>('GET', `/api/leaderboard/${board}`),
};
