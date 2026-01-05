
export enum Language {
  KOREAN = 'KOREAN',
  ENGLISH = 'ENGLISH'
}

export interface Stats {
  speed: number;
  accuracy: number;
  typedCount: number;
  totalCount: number;
  elapsedTime: number;
}

export interface Settings {
  rememberProgress: boolean;
}

export interface TypingSession {
  filename: string;
  content: string;
  language: Language;
}

export interface SavedSession {
  session: TypingSession;
  userInputHistory: string[];
  keystrokes: number;
  accumulatedTime: number;
  lastUpdated: number;
}

export const PUNCT_SET = ['.', '!', '?', "'", '"', ',', ';', ':', '“', '”', '‘', '’', '…'];
export const QUOTE_PUNCT = ["'", '"', '“', '”', '‘', '’'];
export const PUNCTUATION_CHARS = PUNCT_SET;
