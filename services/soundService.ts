
import { getFirstKeyOfHangul } from './hangulUtils';

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
    audio.currentTime = 0;
    if (randomize) {
      audio.playbackRate = 0.96 + Math.random() * 0.08;
    } else {
      audio.playbackRate = 1.0;
    }
    audio.play().catch(() => {});
    this.currentIndex = (this.currentIndex + 1) % this.voices.length;
  }
}

const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

const keyboard1 = new SoundPool('./sounds/Keyboard1.mp3', 12, 0.6);
const keyboard2 = new SoundPool('./sounds/Keyboard2.mp3', 12, 0.6);
const keyboard3 = new SoundPool('./sounds/Keyboard3.mp3', 12, 0.6);
const keyboard4 = new SoundPool('./sounds/Keyboard4.mp3', 12, 0.6);

const enterSound1 = new SoundPool('./sounds/Enter1.mp3', 6, 0.9);
const enterSound2 = new SoundPool('./sounds/Enter2.mp3', 6, 0.9);

const spaceSound = new SoundPool('./sounds/Space.mp3', 8, 0.8);
const deleteSound = new SoundPool('./sounds/Delete.mp3', 8, 0.8);
const completeSound = new SoundPool('./sounds/Complete.mp3', 1, 1.0);
const errorSound = new SoundPool('./sounds/Error.mp3', 5, 0.4); 

// Keyboard zones for variation
const K1_REGEX = /^[AQZ12WJSXDE34]$/i;
const K2_REGEX = /^[RFV56TGBYHN]$/i;
const K3_REGEX = /^[UJM78IKL90]$/i;
const K4_REGEX = /^[OP\-=\[\]\\;',.\/]$/i;

export const playTypingSound = (char: string) => {
  if (char === '\n' || char === 'Enter') {
    if (Math.random() > 0.5) enterSound1.play(false);
    else enterSound2.play(false);
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

  // Mobile skips individual key clicks for performance and natural feel
  if (isMobile) return;

  // PC Logic: Convert jamo to physical key for varied sound
  let physicalKey = getFirstKeyOfHangul(char);
  
  // Normalize key name
  const cleanKey = physicalKey.replace('Key', '').replace('Digit', '');
  
  if (K1_REGEX.test(cleanKey)) keyboard1.play();
  else if (K2_REGEX.test(cleanKey)) keyboard2.play();
  else if (K3_REGEX.test(cleanKey)) keyboard3.play();
  else if (K4_REGEX.test(cleanKey)) keyboard4.play();
  else keyboard1.play();
};

export const playCompletionSound = () => completeSound.play(false);
export const playErrorSound = () => errorSound.play(false);
