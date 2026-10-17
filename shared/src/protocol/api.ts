import { z } from 'zod';

const reserved = ['admin', 'administrator', 'moderator', 'mod', 'system', 'freddy', 'bonnie', 'chica', 'foxy', 'fazbear', 'root', 'server', 'guest', 'staff', 'support'];

export const USERNAME_RE = /^[A-Za-z0-9_]{3,16}$/;

export const UsernameZ = z
  .string()
  .regex(USERNAME_RE, 'Usernames are 3 to 16 letters, numbers or underscores.')
  .refine((u) => !reserved.includes(u.toLowerCase()), 'That name is reserved.');

export const PasswordZ = z.string().min(8, 'Passwords need at least 8 characters.').max(128);
export const EmailZ = z.string().email().max(200);

export const SignupZ = z.object({ username: UsernameZ, password: PasswordZ, email: EmailZ.optional().or(z.literal('').transform(() => undefined)) });
export const LoginZ = z.object({ username: z.string().min(1).max(32), password: z.string().min(1).max(128) });
export const ForgotZ = z.object({ email: z.string().max(200) });
export const ResetZ = z.object({ token: z.string().min(10).max(200), password: PasswordZ });
export const PatchMeZ = z.object({
  displayName: z.string().trim().min(3).max(20).optional(),
  settings: z.record(z.string().max(64), z.unknown()).optional(),
});
export const PasswordChangeZ = z.object({ current: z.string().min(1).max(128), next: PasswordZ });
export const EquipZ = z.object({ slot: z.string().min(1).max(40), cosmeticId: z.string().min(1).max(64) });
export const DeleteMeZ = z.object({ password: z.string().max(128).optional() });
export const BuyZ = z.object({ cosmeticId: z.string().min(1).max(64) });
export const ArchiveZ = z.object({ kind: z.enum(['newspaper', 'minigame', 'character', 'call', 'sound']), id: z.string().max(40) });

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  isGuest: boolean;
  fazTokens: number;
  stars: number;
  equipped: Record<string, string>;
  settings: Record<string, unknown>;
  createdAt: string;
  email: string | null;
}

export interface ApiError {
  error: { code: string; message: string };
}

// A small built-in word list for display filtering and usernames. Deliberately short.
export const BAD_WORDS = ['fuck', 'shit', 'cunt', 'bitch', 'nigger', 'nigga', 'faggot', 'fag', 'retard', 'whore', 'slut', 'dick', 'cock', 'pussy', 'asshole', 'bastard', 'twat', 'wank'];

export function isProfane(text: string): boolean {
  const t = text.toLowerCase().replace(/[^a-z]/g, '');
  return BAD_WORDS.some((w) => t.includes(w));
}

export function filterProfanity(text: string): string {
  let out = text;
  for (const w of BAD_WORDS) out = out.replace(new RegExp(w, 'gi'), (m) => m[0] + '*'.repeat(m.length - 1));
  return out;
}
