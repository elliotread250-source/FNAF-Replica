import type { CallDef } from '@fnaf/shared';
import { store } from '../store';
import { audio } from '../audio/engine';
import { serverNow } from '../net/socket';
import { mount } from '../ui/dom';
import type { Hud } from './hud';

/** Plays a phone call in sync with the server clock: ring, babble per line, subtitles, scripted cues. */
export class CallPlayer {
  private started = false;
  private stopped = false;
  private idx = 0;
  private t0 = 0;
  private stopBabble: (() => void) | null = null;
  private voice: SpeechSynthesisUtterance | null = null;

  constructor(
    private call: CallDef,
    private hud: Hud,
    private startAt: number,
  ) {}

  begin(): void {
    if (this.started || this.stopped) return;
    this.started = true;
    this.t0 = performance.now() + (this.startAt - serverNow() > 0 ? 0 : 0);
    audio.play('phone', { gain: 0.5 });
    setTimeout(() => !this.stopped && audio.play('phone', { gain: 0.5 }), 2200);
  }

  skip(): void {
    this.stopped = true;
  }

  tick(): void {
    if (!this.started || this.stopped) return;
    const t = (performance.now() - this.t0) / 1000;
    const lines = this.call.lines;
    while (this.idx < lines.length && t >= lines[this.idx].t) {
      const line = lines[this.idx];
      const next = lines[this.idx + 1];
      const dur = Math.max(1.5, (next ? next.t : line.t + 3) - line.t - 0.2);
      const text = store.roster.fill(line.text);
      if (store.settings.subtitles) mount(this.hud.subtitles, text);
      this.stopBabble?.();
      this.stopBabble = null;
      if (line.cue === 'banging') audio.play('knock', { gain: 0.5, distance: 1 });
      else if (line.cue === 'musicbox') audio.melody('freddy', { bpm: 110, gain: 0.12, wobble: 0.6, bus: 'voice' });
      else if (line.cue === 'groan') audio.play('groan', { gain: 0.5, bus: 'voice' });
      else if (line.cue === 'screech') audio.play('scream_generic', { gain: 0.4, bus: 'voice' });
      else if (line.cue === 'static') audio.play('static', { gain: 0.6, bus: 'voice' });
      else if (line.cue === 'garble') audio.play('garble', { gain: 0.7, bus: 'voice' });
      else if (!line.text.startsWith('[') && !line.text.startsWith('▓') && !line.text.startsWith('░') && !line.text.startsWith('▒')) {
        if (store.settings.bindings && 'speechSynthesis' in window && (store.settings as unknown as { callVoice?: boolean }).callVoice) {
          this.voice = new SpeechSynthesisUtterance(text);
          this.voice.pitch = 0.6;
          speechSynthesis.speak(this.voice);
        } else this.stopBabble = audio.babble(dur, 0.45);
      }
      this.idx++;
    }
    if (this.idx >= lines.length && t > this.call.duration) this.stop();
  }

  /** Night 4: click the receiver in the last five seconds of the call. */
  phoneClick(night: number): void {
    if (night !== 4 || !this.started) return;
    const t = (performance.now() - this.t0) / 1000;
    if (t > this.call.duration - 6 && t < this.call.duration + 1) audio.play('giggle', { rate: 0.5, gain: 0.3, bus: 'voice' });
  }

  stop(): void {
    this.stopped = true;
    this.stopBabble?.();
    if (this.voice) speechSynthesis.cancel();
    mount(this.hud.subtitles);
  }
}
