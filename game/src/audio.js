// Sound is synthesized in the browser with WebAudio: no files, no network, no assets.
// Everything is wrapped so a browser that blocks audio still plays the game.
export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;

  function ensure() {
    if (context) return context;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      context = new AC();
      master = context.createGain();
      master.gain.value = 0.28;
      master.connect(context.destination);
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 70;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
    } catch {
      context = null;
    }
    return context;
  }

  function noise(seconds) {
    if (!context) return null;
    const len = Math.max(1, Math.floor(context.sampleRate * seconds));
    const buffer = context.createBuffer(1, len, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = context.createBufferSource();
    src.buffer = buffer;
    return src;
  }

  function tone(freq, seconds, type = 'sine', volume = 0.5) {
    if (!context || muted) return;
    try {
      const osc = context.createOscillator();
      const g = context.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      g.gain.setValueAtTime(volume, context.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, context.currentTime + seconds);
      osc.connect(g); g.connect(master);
      osc.start(); osc.stop(context.currentTime + seconds);
    } catch { /* a blocked context is silent */ }
  }

  return {
    resume() {
      const c = ensure();
      if (c && c.state === 'suspended') c.resume().catch(() => {});
    },
    toggle() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.28;
      return muted;
    },
    engine(speed, inCar) {
      if (!context || !engineOsc || !engineGain) return;
      const target = inCar && !muted ? Math.min(0.12, Math.abs(speed) / 4200) : 0;
      engineGain.gain.value += (target - engineGain.gain.value) * 0.1;
      engineOsc.frequency.value = 60 + Math.abs(speed) * 0.55;
    },
    play(kind) {
      if (!ensure() || muted) return;
      try {
        if (kind === 'shot') {
          const src = noise(0.12);
          if (!src) return;
          const g = context.createGain();
          g.gain.value = 0.9;
          const f = context.createBiquadFilter();
          f.type = 'lowpass'; f.frequency.value = 2400;
          src.connect(f); f.connect(g); g.connect(master); src.start();
        } else if (kind === 'siren') {
          tone(760, 0.28, 'square', 0.09);
          setTimeout(() => tone(560, 0.28, 'square', 0.09), 280);
        } else if (kind === 'cash') {
          tone(660, 0.12, 'triangle', 0.35);
          setTimeout(() => tone(990, 0.22, 'triangle', 0.3), 110);
        } else if (kind === 'hit') {
          const src = noise(0.25);
          if (!src) return;
          const g = context.createGain(); g.gain.value = 0.7;
          src.connect(g); g.connect(master); src.start();
        } else if (kind === 'busted') {
          tone(220, 0.5, 'sawtooth', 0.3);
          setTimeout(() => tone(150, 0.7, 'sawtooth', 0.3), 220);
        }
      } catch { /* sound is optional */ }
    },
  };
}
