
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

  play(randomize: boolean = true) {
    if (this.voices.length === 0) return;
    const audio = this.voices[this.currentIndex];
    // Snappy response: Set time to 0 and play immediately
    audio.currentTime = 0;
    if (randomize) {
      audio.playbackRate = 0.97 + Math.random() * 0.06;
    } else {
      audio.playbackRate = 1.0;
    }
    audio.play().catch(() => {});
    this.currentIndex = (this.currentIndex + 1) % this.voices.length;
  }
}

const keyboard1 = new SoundPool('./sounds/Keyboard1.mp3', 12, 0.7);
const keyboard2 = new SoundPool('./sounds/Keyboard2.mp3', 12, 0.7);
const keyboard3 = new SoundPool('./sounds/Keyboard3.mp3', 12, 0.7);
const keyboard4 = new SoundPool('./sounds/Keyboard4.mp3', 12, 0.7);

const enterSound = new SoundPool('./sounds/Enter.mp3', 8, 1.0);
const spaceSound = new SoundPool('./sounds/Space.mp3', 8, 1.0);
const deleteSound = new SoundPool('./sounds/Delete.mp3', 8, 1.0);
const completeSound = new SoundPool('./sounds/Complete.mp3', 1, 1.0);
const errorSound = new SoundPool('./sounds/Error.mp3', 5, 1.0);

const K1_REGEX = /^[A-F0-9]$/i;
const K2_REGEX = /^[G-L]$/i;
const K3_REGEX = /^[M-R]$/i;
const K4_REGEX = /^[S-Z]$/i;

export const playTypingSound = (char: string) => {
  if (char === '\n' || char === 'Enter') {
    enterSound.play(false);
    return;
  }
  
  if (char === ' ' || char === 'Space') {
    spaceSound.play(false);
    return;
  }

  if (char === 'Backspace' || char === 'Delete') {
    deleteSound.play(false);
    return;
  }

  const cleanChar = char.replace('Key', '').replace('Digit', '');
  
  if (K1_REGEX.test(cleanChar)) keyboard1.play();
  else if (K2_REGEX.test(cleanChar)) keyboard2.play();
  else if (K3_REGEX.test(cleanChar)) keyboard3.play();
  else if (K4_REGEX.test(cleanChar)) keyboard4.play();
  else keyboard1.play();
};

export const playCompletionSound = () => {
  completeSound.play(false);
};

export const playErrorSound = () => {
  errorSound.play(false);
};
