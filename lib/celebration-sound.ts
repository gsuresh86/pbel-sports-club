const CROWD_CLAP_SRC = '/sounds/crowd-clap.mp3';

let crowdClapAudio: HTMLAudioElement | null = null;

function playCrowdClapFile(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (!crowdClapAudio) {
    crowdClapAudio = new Audio(CROWD_CLAP_SRC);
    crowdClapAudio.volume = 0.58;
    crowdClapAudio.preload = 'auto';
  }
  crowdClapAudio.volume = 0.58;
  crowdClapAudio.currentTime = 0;
  const played = crowdClapAudio.play().then(() => true).catch(() => false);

  window.setTimeout(() => {
    if (!crowdClapAudio) return;
    const fadeSteps = 12;
    let step = 0;
    const interval = window.setInterval(() => {
      step += 1;
      if (!crowdClapAudio) {
        clearInterval(interval);
        return;
      }
      crowdClapAudio.volume = Math.max(0, 0.58 * (1 - step / fadeSteps));
      if (step >= fadeSteps) {
        crowdClapAudio.pause();
        crowdClapAudio.currentTime = 0;
        crowdClapAudio.volume = 0.58;
        clearInterval(interval);
      }
    }, 120);
  }, 5500);

  return played;
}

/** Layered short noise bursts when the MP3 cannot play (autoplay block, missing file). */
function scheduleSyntheticCrowdClap(ctx: AudioContext, startAt: number): void {
  const master = ctx.createGain();
  master.gain.value = 0.22;
  master.connect(ctx.destination);

  const clapCount = 56;
  for (let i = 0; i < clapCount; i++) {
    const when = startAt + 0.2 + Math.pow(i / clapCount, 0.65) * 2.6 + Math.random() * 0.06;
    const sampleLength = Math.floor(ctx.sampleRate * (0.035 + Math.random() * 0.07));
    const buffer = ctx.createBuffer(1, sampleLength, ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let s = 0; s < sampleLength; s++) {
      const env = 1 - s / sampleLength;
      samples[s] = (Math.random() * 2 - 1) * env * env;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 900 + Math.random() * 2600;
    filter.Q.value = 0.7;
    const gain = ctx.createGain();
    gain.gain.value = 0.35 + Math.random() * 0.45;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(when);
    source.stop(when + sampleLength / ctx.sampleRate + 0.02);
  }
}

/** Victory fanfare with crack/pop and crowd applause. */
export function playMatchWinSound(): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const startAt = ctx.currentTime;

    // Crack / pop burst (noise) — slightly longer for more punch
    const bufferSize = ctx.sampleRate * 0.12;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 1200;
    const noiseGain = ctx.createGain();
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noiseGain.gain.setValueAtTime(0.38, startAt);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.12);
    noise.start(startAt);
    noise.stop(startAt + 0.13);

    // Secondary softer pop
    const pop2 = ctx.createBufferSource();
    pop2.buffer = noiseBuffer;
    const pop2Filter = ctx.createBiquadFilter();
    pop2Filter.type = 'bandpass';
    pop2Filter.frequency.value = 800;
    const pop2Gain = ctx.createGain();
    pop2.connect(pop2Filter);
    pop2Filter.connect(pop2Gain);
    pop2Gain.connect(ctx.destination);
    pop2Gain.gain.setValueAtTime(0.18, startAt + 0.38);
    pop2Gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.52);
    pop2.start(startAt + 0.38);
    pop2.stop(startAt + 0.53);

    // Triumphant notes
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((frequency, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = frequency;
      osc.connect(gain);
      gain.connect(ctx.destination);

      const noteStart = startAt + 0.08 + index * 0.12;
      gain.gain.setValueAtTime(0.0001, noteStart);
      gain.gain.exponentialRampToValueAtTime(0.24, noteStart + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.55);

      osc.start(noteStart);
      osc.stop(noteStart + 0.58);
    });

    void playCrowdClapFile().then((played) => {
      if (!played) scheduleSyntheticCrowdClap(ctx, startAt);
    });

    window.setTimeout(() => {
      void ctx.close();
    }, 3200);
  } catch {
    // Autoplay may be blocked until user interaction — fail silently.
  }
}
