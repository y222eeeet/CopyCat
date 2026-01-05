
// Hangul Unicode Constants
const HANGUL_BASE = 0xAC00;
const HANGUL_END = 0xD7A3;

const INITIALS = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
];
const MEDIALS = [
  'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'
];
const FINALS = [
  '', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
];

const COMPLEX_MEDIALS: Record<string, string[]> = {
  'ㅘ': ['ㅗ', 'ㅏ'], 'ㅙ': ['ㅗ', 'ㅐ'], 'ㅚ': ['ㅗ', 'ㅣ'],
  'ㅝ': ['ㅜ', 'ㅓ'], 'ㅞ': ['ㅜ', 'ㅔ'], 'ㅟ': ['ㅜ', 'ㅣ'],
  'ㅢ': ['ㅡ', 'ㅣ']
};

const COMPLEX_FINALS: Record<string, string[]> = {
  'ㄳ': ['ㄱ', 'ㅅ'], 'ㄵ': ['ㄴ', 'ㅈ'], 'ㄶ': ['ㄴ', 'ㅎ'],
  'ㄺ': ['ㄹ', 'ㄱ'], 'ㄻ': ['ㄹ', 'ㅁ'], 'ㄼ': ['ㄹ', 'ㅂ'], 'ㄽ': ['ㄹ', 'ㅅ'],
  'ㄾ': ['ㄹ', 'ㅌ'], 'ㄿ': ['ㄹ', 'ㅍ'], 'ㅀ': ['ㄹ', 'ㅎ'], 'ㅄ': ['ㅂ', 'ㅅ']
};

/**
 * 한글-쿼티 키 매핑 (두벌식 기준)
 */
const JAMO_TO_KEY: Record<string, string> = {
  'ㄱ': 'r', 'ㄲ': 'R', 'ㄴ': 's', 'ㄷ': 'e', 'ㄸ': 'E', 'ㄹ': 'f', 'ㅁ': 'a', 'ㅂ': 'q', 'ㅃ': 'Q', 'ㅅ': 't', 'ㅆ': 'T', 'ㅇ': 'd', 'ㅈ': 'w', 'ㅉ': 'W', 'ㅊ': 'c', 'ㅋ': 'z', 'ㅌ': 'x', 'ㅍ': 'v', 'ㅎ': 'g',
  'ㅏ': 'k', 'ㅐ': 'o', 'ㅑ': 'i', 'ㅒ': 'O', 'ㅓ': 'j', 'ㅔ': 'p', 'ㅕ': 'u', 'ㅖ': 'P', 'ㅗ': 'h', 'ㅘ': 'hk', 'ㅙ': 'ho', 'ㅚ': 'hl', 'ㅛ': 'y', 'ㅜ': 'n', 'ㅝ': 'nj', 'ㅞ': 'np', 'ㅟ': 'nl', 'ㅠ': 'b', 'ㅡ': 'm', 'ㅢ': 'ml', 'ㅣ': 'l'
};

/**
 * 한글 한 글자를 기본 자모 단위로 완전히 분해합니다.
 */
export const decomposeHangul = (char: string): string[] => {
  if (!char) return [];
  const code = char.charCodeAt(0);
  
  if (code >= HANGUL_BASE && code <= HANGUL_END) {
    const offset = code - HANGUL_BASE;
    const initialIndex = Math.floor(offset / 588);
    const medialIndex = Math.floor((offset % 588) / 28);
    const finalIndex = offset % 28;

    const res: string[] = [];
    res.push(INITIALS[initialIndex]);
    
    const m = MEDIALS[medialIndex];
    if (COMPLEX_MEDIALS[m]) res.push(...COMPLEX_MEDIALS[m]);
    else res.push(m);
    
    if (finalIndex !== 0) {
      const f = FINALS[finalIndex];
      if (COMPLEX_FINALS[f]) res.push(...COMPLEX_FINALS[f]);
      else res.push(f);
    }
    return res;
  }

  if (COMPLEX_MEDIALS[char]) return COMPLEX_MEDIALS[char];
  if (COMPLEX_FINALS[char]) return COMPLEX_FINALS[char];
  
  return [char];
};

/**
 * 한글 글자의 첫 번째 입력 키를 반환합니다. (사운드 그룹 판별용)
 */
export const getFirstKeyOfHangul = (char: string): string => {
  const jamos = decomposeHangul(char);
  if (jamos.length === 0) return char;
  return JAMO_TO_KEY[jamos[0]] || char;
};

/**
 * 입력 중인 글자가 대상 글자의 유효한 접두어인지 확인합니다.
 */
export const isJamoPrefix = (composingChar: string, targetChar: string, nextTargetChar?: string): boolean => {
  if (!composingChar || !targetChar) return true;
  if (composingChar === targetChar) return true;
  
  const composingJamos = decomposeHangul(composingChar);
  const targetJamos = decomposeHangul(targetChar);

  // 현재 글자의 자모가 타겟 글자의 자모 시퀀스와 일치하는지 확인
  const minLen = Math.min(composingJamos.length, targetJamos.length);
  for (let i = 0; i < minLen; i++) {
    if (composingJamos[i] !== targetJamos[i]) return false;
  }

  // 타겟 글자보다 더 많은 자모를 입력한 경우 (연음 법칙 등으로 다음 글자로 넘어가는 경우)
  if (composingJamos.length > targetJamos.length) {
    if (!nextTargetChar) return false;
    const extra = composingJamos.slice(targetJamos.length);
    const nextJamos = decomposeHangul(nextTargetChar);
    for (let i = 0; i < extra.length; i++) {
      if (extra[i] !== nextJamos[i]) return false;
    }
    return true;
  }

  return true;
};

export const detectLanguage = (text: string): 'KOREAN' | 'ENGLISH' => {
  const koreanRegex = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/;
  const sample = text.slice(0, 500);
  return koreanRegex.test(sample) ? 'KOREAN' : 'ENGLISH';
};
