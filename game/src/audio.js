// Tiny WebAudio synth for Sky Courier: engine hum, ring chime, crash, clicks.
// Everything is synthesised; no audio files. Safe to call before any gesture.
export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      // Engine: two detuned saws through a lowpass, gain follows throttle.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      const osc2 = this.ctx.createOscillator();
      osc2.type = 'sawtooth';
      osc2.frequency.value = 55 * 1.007;
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 320;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(this.engineFilter);
      osc2.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);
      this.engineOsc.start();
      osc2.start();
      this.engineOsc2 = osc2;
    } catch {
      this.ctx = null;
    }
  }

  setEngine(throttle, speedNorm, on) {
    if (!this.ctx || !this.engineOsc) return;
    const t = this.ctx.currentTime;
    const target = this.muted || !on ? 0 : 0.028 + throttle * 0.05;
    this.engineGain.gain.setTargetAtTime(target, t, 0.15);
    this.engineOsc.frequency.setTargetAtTime(48 + throttle * 70 + speedNorm * 25, t, 0.2);
    this.engineOsc2.frequency.setTargetAtTime((48 + throttle * 70 + speedNorm * 25) * 1.007, t, 0.2);
    this.engineFilter.frequency.setTargetAtTime(280 + throttle * 900, t, 0.2);
  }

  blip(freq, dur, type = 'sine', vol = 0.12, when = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  ring() {
    this.blip(880, 0.35, 'sine', 0.14);
    this.blip(1318, 0.5, 'sine', 0.1, 0.07);
  }

  click() {
    this.blip(660, 0.07, 'square', 0.05);
  }

  buy() {
    this.blip(523, 0.12, 'triangle', 0.12);
    this.blip(784, 0.2, 'triangle', 0.12, 0.08);
  }

  crash() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const dur = 0.5;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(g);
    g.connect(this.ctx.destination);
    src.start(t);
    this.blip(90, 0.4, 'sine', 0.2);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (!this.muted) this.ensure();
    return this.muted;
  }
}
