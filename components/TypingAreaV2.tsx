
import React, { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from 'react';
import { TypingSession, PUNCT_SET, Stats, Language } from '../types';
import { isJamoPrefix, decomposeHangul } from '../services/hangulUtils';
import { useAutoScroll } from '../hooks/useAutoScroll';
import { playTypingSound } from '../services/soundService';

const jamoCache = new Map<string, string[]>();
const getCachedDecomposition = (char: string) => {
  if (!char) return [];
  if (jamoCache.has(char)) return jamoCache.get(char)!;
  const res = decomposeHangul(char);
  jamoCache.set(char, res);
  return res;
};

interface UserCharData {
  char: string;
  isMistake: boolean;
}

const MemoizedLine = React.memo(({ 
  line, 
  lineOffset, 
  targetToUserMap,
  activatedPunct, 
  composingIdx, 
  isComposing 
}: {
  line: string;
  lineOffset: number;
  targetToUserMap: Map<number, UserCharData>;
  activatedPunct: Set<number>;
  composingIdx: number;
  isComposing: boolean;
}) => {
  return (
    <div className="min-h-[1.6em] relative">
      <div className="absolute top-0 left-0 w-full pointer-events-none">
        {line.split('').map((char: string, cIdx: number) => {
          const absIdx = lineOffset + cIdx;
          const isBeingComposed = absIdx === composingIdx && isComposing;
          
          let color = '#E5E7EB'; 
          if (isBeingComposed) {
            color = 'transparent';
          } else if (targetToUserMap.has(absIdx)) {
            color = 'transparent';
          } else if (activatedPunct.has(absIdx)) {
            color = '#333333';
          }
          
          return <span id={`char-ghost-${absIdx}`} key={absIdx} style={{ color }}>{char}</span>;
        })}
      </div>
      <div className="relative w-full z-10 pointer-events-none">
        {line.split('').map((targetChar: string, cIdx: number) => {
          const absIdx = lineOffset + cIdx;
          const userData = targetToUserMap.get(absIdx);
          
          if (userData) {
            if (PUNCT_SET.includes(userData.char)) return <span key={absIdx} className="invisible">{userData.char}</span>;
            return <span key={absIdx} className={userData.isMistake ? 'text-red-500 font-bold' : 'text-black'}>{userData.char}</span>;
          }
          return <span key={absIdx} className="invisible">{targetChar}</span>;
        })}
      </div>
    </div>
  );
});

interface Props {
  session: TypingSession;
  isPaused: boolean;
  initialHistory?: string[];
  initialKeystrokes?: number;
  initialAccumulatedTime?: number;
  onStatsUpdate: (stats: Stats) => void;
  onComplete: (stats: Stats) => void;
  onPersist?: (history: string[], keystrokes: number, accumulatedTime: number) => void;
}

/**
 * TypingAreaV2 handles the core typing logic including Hangul composition,
 * accuracy tracking, stats calculation, and auto-scrolling.
 */
const TypingAreaV2: React.FC<Props> = ({ 
  session, isPaused, initialHistory = [], initialKeystrokes = 0, initialAccumulatedTime = 0,
  onStatsUpdate, onComplete, onPersist
}) => {
  const [userInput, setUserInput] = useState<string>(initialHistory.join(''));
  const [isComposing, setIsComposing] = useState(false);
  const [keystrokes, setKeystrokes] = useState(initialKeystrokes);
  const [cursorPos, setCursorPos] = useState({ top: 0, left: 0, height: 0 });
  const [isReady, setIsReady] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<HTMLDivElement>(null);
  const hiddenInputRef = useRef<HTMLTextAreaElement>(null);
  const startTimeRef = useRef<number | null>(null);
  const accumulatedTimeRef = useRef<number>(initialAccumulatedTime);
  const isFinishedRef = useRef(false);
  
  const content = session.content;
  const totalCount = useMemo(() => {
    let count = 0;
    for (let i = 0; i < content.length; i++) if (content[i] !== '\n') count++;
    return count;
  }, [content]);

  const preCalculatedLines = useMemo(() => {
    const lines = content.split('\n');
    let offset = 0;
    return lines.map(line => {
      const data = { line, lineOffset: offset };
      offset += line.length + 1;
      return data;
    });
  }, [content]);

  useEffect(() => {
    if (isPaused) {
      if (startTimeRef.current !== null) {
        accumulatedTimeRef.current += (Date.now() - startTimeRef.current);
        startTimeRef.current = null;
      }
    } else if (userInput.length > 0 && !isFinishedRef.current && startTimeRef.current === null) {
      startTimeRef.current = Date.now();
    }
  }, [isPaused, userInput.length]);

  useEffect(() => {
    if (!isPaused && isReady) hiddenInputRef.current?.focus();
  }, [isPaused, isReady]);

  const isSufficientlyCompleted = useCallback((u: string, t: string) => {
    if (session.language !== Language.KOREAN || !u || !t) return true;
    const tCode = t.charCodeAt(0);
    if (tCode < 0xAC00 || tCode > 0xD7A3) return true;
    const uJamos = getCachedDecomposition(u);
    const tJamos = getCachedDecomposition(t);
    return uJamos.length >= tJamos.length;
  }, [session.language]);

  const alignedState = useMemo(() => {
    let targetIdx = 0;
    let isLastCharComplete = false;
    let composingTargetIdx = -1;
    const targetToUserMap = new Map<number, UserCharData>();
    const activated = new Set<number>();
    const mistakes = new Set<number>();

    const skipCurrentPunct = () => {
        while (targetIdx < content.length && PUNCT_SET.includes(content[targetIdx])) {
            activated.add(targetIdx);
            targetIdx++;
        }
    };

    const activateTrailingPunctInWord = (startFrom: number) => {
        let search = startFrom;
        while (search < content.length && content[search] !== ' ' && content[search] !== '\n') {
            if (PUNCT_SET.includes(content[search])) {
                activated.add(search);
            }
            search++;
        }
    };

    skipCurrentPunct();

    const isKorean = session.language === Language.KOREAN;
    const isEnglish = session.language === Language.ENGLISH;

    const inputLen = userInput.length;
    for (let i = 0; i < inputLen; i++) {
      const userChar = userInput[i];
      const isLastIndex = i === inputLen - 1;
      const isActuallyComposing = isLastIndex && isComposing;

      while (targetIdx < content.length && PUNCT_SET.includes(content[targetIdx])) {
          activated.add(targetIdx);
          targetIdx++;
      }

      if (!isActuallyComposing && (userChar === ' ' || userChar === '\n')) {
        let ahead = targetIdx;
        while (ahead < content.length && content[ahead] !== '\n' && (PUNCT_SET.includes(content[ahead]) || content[ahead] === ' ')) ahead++;
        
        if (ahead < content.length && content[ahead] === '\n') {
          while (targetIdx < ahead) {
            if (PUNCT_SET.includes(content[targetIdx])) activated.add(targetIdx);
            targetIdx++;
          }
          while (targetIdx < content.length && content[targetIdx] === '\n') targetIdx++;
          skipCurrentPunct(); 
          if (isLastIndex) isLastCharComplete = true;
          continue;
        } else {
            if (content[targetIdx] === ' ' || content[targetIdx] === '\n') {
                targetIdx++;
                while (targetIdx < content.length && content[targetIdx] === '\n') targetIdx++;
                skipCurrentPunct();
                if (isLastIndex) isLastCharComplete = true;
                continue;
            } else {
                targetToUserMap.set(targetIdx, { char: userChar, isMistake: true });
                mistakes.add(targetIdx);
                targetIdx++;
                if (isLastIndex) isLastCharComplete = true;
                continue;
            }
        }
      }

      const targetChar = content[targetIdx];
      if (!targetChar) { targetIdx++; continue; }

      let isCorrect = false;
      if (isKorean) {
        isCorrect = isJamoPrefix(userChar, targetChar, content[targetIdx + 1]);
      } else {
        const isTargetUpper = targetChar === targetChar.toUpperCase() && targetChar !== targetChar.toLowerCase();
        isCorrect = isTargetUpper ? (userChar.toLowerCase() === targetChar.toLowerCase()) : (userChar === targetChar);
      }

      let isMistake = false;
      if (isKorean) {
        if (isActuallyComposing) {
          isMistake = !isCorrect;
        } else {
          isMistake = userChar !== targetChar;
        }
      } else {
        isMistake = !isCorrect;
      }

      if (!isMistake) {
        let displayChar = userChar;
        if (isEnglish) {
          const isTargetUpper = targetChar === targetChar.toUpperCase() && targetChar !== targetChar.toLowerCase();
          if (isTargetUpper) displayChar = targetChar;
        }

        if (isActuallyComposing) composingTargetIdx = targetIdx;
        targetToUserMap.set(targetIdx, { char: displayChar, isMistake: false });
        
        // Fix for undefined 'target' - use targetIdx instead
        activateTrailingPunctInWord(targetIdx);
        
        if (!isActuallyComposing) {
          isLastCharComplete = isSufficientlyCompleted(userChar, targetChar);
        }
        targetIdx++;
      } else {
        targetToUserMap.set(targetIdx, { char: userChar, isMistake: true });
        mistakes.add(targetIdx);
        targetIdx++;
        if (isLastIndex) isLastCharComplete = true;
      }
    }

    if (isLastCharComplete) {
       skipCurrentPunct();
    }

    return { targetToUserMap, activated, mistakes, composingTargetIdx };
  }, [userInput, isComposing, content, session.language, isSufficientlyCompleted]);

  const { targetToUserMap, activated, mistakes, composingTargetIdx } = alignedState;

  const calculateStats = useCallback((currentMistakes: Set<number>, forcedEndTime?: number) => {
    const now = forcedEndTime || Date.now();
    const elapsedSeconds = (accumulatedTimeRef.current + (startTimeRef.current ? (now - startTimeRef.current) : 0)) / 1000;
    if (elapsedSeconds <= 0.1) return null;

    let speed = 0;
    if (session.language === Language.KOREAN) {
      speed = (keystrokes / elapsedSeconds) * 60;
    } else {
      speed = (userInput.length / 5) / (elapsedSeconds / 60);
    }

    const accuracy = userInput.length === 0 ? 100 : Math.max(0, 100 - (currentMistakes.size / userInput.length) * 100);
    const typedCount = Math.min(userInput.length, totalCount);

    return {
      speed,
      accuracy,
      typedCount,
      totalCount,
      elapsedTime: elapsedSeconds
    };
  }, [session.language, keystrokes, userInput.length, totalCount]);

  useEffect(() => {
    if (isFinishedRef.current) return;
    const currentStats = calculateStats(mistakes);
    if (currentStats) onStatsUpdate(currentStats);

    const typedLengthWithoutNL = userInput.replace(/\n/g, '').length;
    if (typedLengthWithoutNL >= totalCount && userInput.length > 0) {
      isFinishedRef.current = true;
      const finalStats = calculateStats(mistakes, Date.now());
      if (finalStats) onComplete(finalStats);
    }
  }, [userInput, mistakes, calculateStats, onStatsUpdate, onComplete, totalCount]);

  useEffect(() => {
    if (onPersist) {
      onPersist(userInput.split(''), keystrokes, accumulatedTimeRef.current);
    }
  }, [userInput, keystrokes, onPersist]);

  useAutoScroll({
    containerRef,
    targetTop: cursorPos.top,
    targetHeight: cursorPos.height,
    isPaused
  });

  useLayoutEffect(() => {
    const updateCursor = () => {
      const parentEl = layersRef.current;
      if (!parentEl) return;

      const targetIdx = userInput.length;
      const charIdxToMeasure = Math.min(targetIdx, content.length - 1);
      const charEl = document.getElementById(`char-ghost-${charIdxToMeasure}`);
      
      if (charEl) {
        const rect = charEl.getBoundingClientRect();
        const parentRect = parentEl.getBoundingClientRect();
        const top = rect.top - parentRect.top;
        const left = targetIdx >= content.length ? rect.right - parentRect.left : rect.left - parentRect.left;
        const height = rect.height;
        setCursorPos({ top, left, height });
      }
    };
    updateCursor();
    const t = setTimeout(updateCursor, 16);
    return () => clearTimeout(t);
  }, [userInput, content.length]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (isPaused || isFinishedRef.current) return;
    const val = e.target.value;
    const lastChar = val[val.length - 1];
    const prevLen = userInput.length;
    setUserInput(val);
    if (val.length > prevLen) {
      playTypingSound(lastChar);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isPaused || isFinishedRef.current) return;
    if (startTimeRef.current === null) startTimeRef.current = Date.now();
    if (PUNCT_SET.includes(e.key)) {
      e.preventDefault();
      return;
    }
    if (!['Control', 'Alt', 'Shift', 'Meta', 'CapsLock', 'Tab'].includes(e.key)) {
      setKeystrokes(prev => prev + 1);
    }
  };

  const focusInput = () => {
    hiddenInputRef.current?.focus();
    setIsReady(true);
  };

  return (
    <div className="h-full flex flex-col" onClick={focusInput}>
      <div ref={containerRef} className="flex-1 overflow-y-auto custom-scrollbar pr-4">
        <div className="relative min-h-full pb-[60vh]" ref={layersRef}>
          <div 
            className="absolute w-[2px] bg-black/40 z-20 transition-[left,top] duration-[150ms] ease-out"
            style={{ 
              top: `${cursorPos.top}px`, 
              left: `${cursorPos.left}px`, 
              height: `${cursorPos.height || 32}px`,
              opacity: isFinishedRef.current ? 0 : 1
            }}
          />
          {preCalculatedLines.map((lineData) => (
            <MemoizedLine 
              key={lineData.lineOffset}
              line={lineData.line}
              lineOffset={lineData.lineOffset}
              targetToUserMap={targetToUserMap}
              activatedPunct={activated}
              composingIdx={composingTargetIdx}
              isComposing={isComposing}
            />
          ))}
        </div>
      </div>
      <textarea
        ref={hiddenInputRef}
        className="fixed opacity-0 pointer-events-none"
        value={userInput}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        onCompositionStart={() => setIsComposing(true)}
        onCompositionEnd={() => setIsComposing(false)}
        autoFocus
        spellCheck={false}
        autoComplete="off"
      />
    </div>
  );
};

export default TypingAreaV2;
