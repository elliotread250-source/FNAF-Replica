import { PRESETS } from '../content/presets';
import type { CustomSettings } from './types';

/** Which Custom Night preset (if any) these settings correspond to, comparing puppet and extended toggles too. */
export function matchPresetFull(c: CustomSettings): string | null {
  for (const p of [...PRESETS].reverse()) {
    if (p.ai.freddy !== c.ai.freddy || p.ai.bonnie !== c.ai.bonnie || p.ai.chica !== c.ai.chica || p.ai.foxy !== c.ai.foxy) continue;
    if ((p.puppet ?? 0) > 0 && c.puppet < (p.puppet ?? 0)) continue;
    const ext = p.extended ?? {};
    if (Object.entries(ext).some(([id, lvl]) => (c.extended[id] ?? 0) < lvl)) continue;
    if (!p.extended && (p.puppet ?? 0) === 0 && (c.puppet > 0 || Object.values(c.extended).some((v) => v > 0)) && p.id !== 'golden')
      continue;
    return p.id;
  }
  return null;
}
