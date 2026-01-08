
class SoundPool {
  private voices: HTMLAudioElement[] = [];
  private currentIndex: number = 0;

  constructor(src: string, poolSize: number, volume: number) {
    if (typeof window !== 'undefined' && typeof Audio !== 'undefined') {
      this.voices = Array.from({ length: poolSize }, () => {
        const audio = new Audio(src);
        audio.volume = volume;
        audio.preload = 'auto';
        return audio;
      });
    }
  }

  play() {
    if (this.voices.length === 0) return;
    const audio = this.voices[this.currentIndex];
    audio.playbackRate = 0.95 + Math.random() * 0.1;
    audio.currentTime = 0;
    audio.play().catch(() => {});
    this.currentIndex = (this.currentIndex + 1) % this.voices.length;
  }
}

// Ensure relative paths for Vercel deployment stability
const keyboard1 = new SoundPool('./sounds/Mouse1.mp3', 12, 0.7);
const keyboard2 = new SoundPool('./sounds/Mouse2.mp3', 12, 0.7);
const keyboard3 = new SoundPool('./sounds/Mouse1.mp3', 12, 0.7);
const keyboard4 = new SoundPool('./sounds/Mouse2.mp3', 12, 0.7);
const enterSound = new SoundPool('./sounds/Enter.mp3', 8, 0.7);

const K1_REGEX = /^[A-F]$/i;
const K2_REGEX = /^[G-L]$/i;
const K3_REGEX = /^[M-R]$/i;
const K4_REGEX = /^[S-Z]$/i;

export const playTypingSound = (char: string) => {
  if (char === '\n') {
    enterSound.play();
    return;
  }

  if (K1_REGEX.test(char)) Mouse1.play();
  else if (K2_REGEX.test(char)) Mouse2.play();
  else if (K3_REGEX.test(char)) Mouse1.play();
  else if (K4_REGEX.test(char)) Mouse2.play();
};
