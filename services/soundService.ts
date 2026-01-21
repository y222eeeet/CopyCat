
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

// 환경 감지 로직 추가
const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

const keyboard1 = new SoundPool('./sounds/Keyboard1.mp3', 12, 0.7);
const keyboard2 = new SoundPool('./sounds/Keyboard2.mp3', 12, 0.7);
const keyboard3 = new SoundPool('./sounds/Keyboard3.mp3', 12, 0.7);
const keyboard4 = new SoundPool('./sounds/Keyboard4.mp3', 12, 0.7);

// 엔터 사운드 이원화
const enterSound1 = new SoundPool('./sounds/Enter1.mp3', 6, 1.0);
const enterSound2 = new SoundPool('./sounds/Enter2.mp3', 6, 1.0);

const spaceSound = new SoundPool('./sounds/Space.mp3', 8, 1.0);
const deleteSound = new SoundPool('./sounds/Delete.mp3', 8, 1.0);
const completeSound = new SoundPool('./sounds/Complete.mp3', 1, 1.0);
const errorSound = new SoundPool('./sounds/Error.mp3', 5, 0.5); 

const K1_REGEX = /^[A-F0-9]$/i;
const K2_REGEX = /^[G-L]$/i;
const K3_REGEX = /^[M-R]$/i;
const K4_REGEX = /^[S-Z]$/i;

export const playTypingSound = (char: string) => {
  // Enter 입력 시 두 가지 사운드 중 랜덤 재생
  if (char === '\n' || char === 'Enter') {
    if (Math.random() > 0.5) {
      enterSound1.play(false);
    } else {
      enterSound2.play(false);
    }
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

  // 모바일 환경일 경우 일반 키보드 클릭음(K1~K4)은 재생하지 않고 리턴
  if (isMobile) return;

  // PC 환경에서만 실행되는 일반 키 사운드 로직
  const cleanChar = char.replace('Key', '').replace('Digit', '');
  
  if (K1_REGEX.test(cleanChar)) keyboard1.play();
  else if (K2_REGEX.test(cleanChar)) keyboard2.play();
  else if (K3_REGEX.test(cleanChar)) keyboard3.play();
  else if (K4_REGEX.test(cleanChar)) keyboard4.play();
  else keyboard1.play();
};

export const playCompletionSound = () => {
  // 완료 소리는 모든 환경에서 재생
  completeSound.play(false);
};

export const playErrorSound = () => {
  // 오타 소리는 모든 환경에서 재생
  errorSound.play(false);
};
