
import React, { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from 'react';
import { TypingSession, PUNCT_SET, Stats, Language } from '../types';
import { isJamoPrefix, decomposeHangul } from '../services/hangulUtils';
import { useAutoScroll } from '../hooks/useAutoScroll';
import { playTypingSound, playErrorSound } from '../services/soundService';

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
}: any) => {
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
          const userData = targetToUserMap.get(absIdx) as UserCharData | undefined;
          
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
  const isJumpingRef = useRef(false); 
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

  const isBodyChar = useCallback((char: string) => /^[a-zA-Z0-9가-힣]$/.test(char), []);
  
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
        // Optional Caps for English: If target is Upper, accept Lower. If target is Lower, only exact.
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
        
        activateTrailingPunctInWord(targetIdx);

        const isComplete = isKorean ? isSufficientlyCompleted(userChar, targetChar) : true;
        const lastCommitted = isBodyChar(targetChar) ? isComplete : !isActuallyComposing;
        targetIdx++;
        
        if (lastCommitted) {
            skipCurrentPunct();
            if (content[targetIdx-1] === '\n') skipCurrentPunct();
        }
        if (isLastIndex) isLastCharComplete = lastCommitted;
      } else { 
        targetToUserMap.set(targetIdx, { char: userChar, isMistake: true });
        mistakes.add(targetIdx);
        targetIdx++; 
        if (isLastIndex) isLastCharComplete = true;
      }
    }

    skipCurrentPunct();

    return { targetToUserMap, activated, mistakes, composingTargetIdx, isLastCharComplete, targetIdxReached: targetIdx };
  }, [userInput, isComposing, content, isSufficientlyCompleted, isBodyChar, session.language]);

  const { targetToUserMap, activated, mistakes, composingTargetIdx, isLastCharComplete, targetIdxReached } = alignedState;

  const prevMistakeCount = useRef<number>(0);
  useEffect(() => {
    if (mistakes.size > prevMistakeCount.current) {
      playErrorSound();
    }
    prevMistakeCount.current = mistakes.size;
  }, [mistakes.size]);

  const updateCursorPosition = useCallback(() => {
    const parentEl = layersRef.current;
    if (!parentEl) return;

    const charIdx = targetIdxReached >= content.length ? content.length - 1 : targetIdxReached;
    const charEl = document.getElementById(`char-ghost-${charIdx}`);
    
    if (charEl) {
      const rect = charEl.getBoundingClientRect();
      const parentRect = parentEl.getBoundingClientRect();
      const isAtEnd = targetIdxReached >= content.length;
      
      let top = rect.top - parentRect.top;
      let left = isAtEnd ? rect.right - parentRect.left : rect.left - parentRect.left;
      
      if (targetIdxReached === 0) {
        left = rect.left - parentRect.left;
      }
      
      if (!isAtEnd && content[targetIdxReached] === '\n') {
          const nextEl = document.getElementById(`char-ghost-${targetIdxReached + 1}`);
          if (nextEl) {
              const nextRect = nextEl.getBoundingClientRect();
              top = nextRect.top - parentRect.top;
              left = nextRect.left - parentRect.left;
          }
      }

      setCursorPos({ top, left, height: rect.height });
      
      if (!isReady) {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => setIsReady(true));
          });
      }
    }
  }, [targetIdxReached, content, isReady]);

  useLayoutEffect(updateCursorPosition, [updateCursorPosition]);
  useAutoScroll({ containerRef, targetTop: cursorPos.top, targetHeight: cursorPos.height, isPaused: isFinishedRef.current || isPaused });

  const calculateStats = useCallback((currentMistakesCount: number, currentTypedCount: number, forcedEndTime?: number) => {
    let elapsedMs = accumulatedTimeRef.current;
    if (startTimeRef.current !== null) elapsedMs += (forcedEndTime || Date.now()) - startTimeRef.current;
    const elapsedSeconds = elapsedMs / 1000;
    if (elapsedSeconds <= 0.2) return null;

    let speed = 0;
    if (session.language === Language.KOREAN) {
      let jamoCount = 0;
      targetToUserMap.forEach((data, tIdx) => {
          if (!data.isMistake && content[tIdx] !== '\n') {
              jamoCount += (data.char === ' ' ? 1 : getCachedDecomposition(data.char).length);
          }
      });
      speed = (jamoCount / elapsedSeconds) * 60;
    } else {
      let correctLength = 0;
      targetToUserMap.forEach((data, tIdx) => { if (!data.isMistake && content[tIdx] !== '\n') correctLength++; });
      speed = (correctLength / 5) / (elapsedSeconds / 60);
    }
    
    let addressedChars = 0;
    for (let i = 0; i < targetIdxReached; i++) {
        if (content[i] !== '\n') addressedChars++;
    }
    const finalTypedCount = Math.min(addressedChars, totalCount);

    const accuracy = currentTypedCount === 0 ? 100 : Math.max(0, 100 - (currentMistakesCount / currentTypedCount) * 100);
    return { speed: Math.min(speed, 2500), accuracy, typedCount: finalTypedCount, totalCount, elapsedTime: elapsedSeconds };
  }, [session.language, totalCount, targetToUserMap, content, targetIdxReached]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (isFinishedRef.current || isPaused || isJumpingRef.current) return;
    setUserInput(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isFinishedRef.current || isPaused) return;
    if (startTimeRef.current === null) startTimeRef.current = Date.now();
    
    if (e.key === ' ' || e.key === 'Enter') {
      let ahead = targetIdxReached; 
      while (ahead < content.length && content[ahead] !== '\n' && (PUNCT_SET.includes(content[ahead]) || content[ahead] === ' ')) ahead++;
      
      if (ahead < content.length && content[ahead] === '\n') {
        playTypingSound('Enter');
        e.preventDefault();
        isJumpingRef.current = true;
        const newVal = userInput + '\n';
        if (hiddenInputRef.current) hiddenInputRef.current.value = newVal;
        setUserInput(newVal);
        setKeystrokes(prev => prev + 1);
        setTimeout(() => { isJumpingRef.current = false; }, 10); 
        return;
      }
      if (e.key === 'Enter') { playTypingSound('Enter'); e.preventDefault(); return; }
      if (e.key === ' ') playTypingSound(' ');
    } else {
      if (e.key === 'Backspace' || e.key === 'Delete') playTypingSound('Backspace');
      else if (e.code.startsWith('Key') || e.code.startsWith('Digit')) playTypingSound(e.code);
      else if (e.key.length === 1) playTypingSound(e.key);
    }
    if (!e.nativeEvent.isComposing && !['Control', 'Alt', 'Shift', 'Meta', 'CapsLock', 'Tab', ' ', 'Enter'].includes(e.key)) {
      setKeystrokes(prev => prev + 1);
    }
  };

  useEffect(() => {
    if (isFinishedRef.current) return;
    const currentStats = calculateStats(mistakes.size, userInput.replace(/\n/g, '').length);
    if (currentStats) onStatsUpdate(currentStats);
    
    if (targetIdxReached >= content.length && isLastCharComplete && userInput.length > 0 && !isComposing) {
      isFinishedRef.current = true;
      const finalStats = calculateStats(mistakes.size, userInput.replace(/\n/g, '').length, Date.now());
      if (finalStats) onComplete(finalStats);
    }
  }, [targetIdxReached, isLastCharComplete, isComposing, calculateStats, onStatsUpdate, onComplete, content.length, userInput, mistakes.size]);

  return (
    <div className="h-full min-h-0 flex flex-col relative" onClick={() => !isPaused && hiddenInputRef.current?.focus()}>
      {isPaused && (
        <div className="absolute inset-0 z-30 bg-white/40 backdrop-blur-[1px] flex items-center justify-center transition-all duration-300">
          <div className="bg-black/5 text-black px-6 py-3 rounded-full font-bold text-sm tracking-widest uppercase">Click Resume to Continue</div>
        </div>
      )}
      <div ref={containerRef} className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-4">
        <div className="relative min-h-full pb-[70vh]">
          <div ref={layersRef} className="relative w-full text-2xl leading-relaxed tracking-tight whitespace-pre-wrap break-keep text-left select-none outline-none font-medium">
            <div className={`absolute w-[2px] bg-black/50 z-20 ${isReady ? 'transition-[left,top] duration-[180ms] ease-out opacity-100' : 'opacity-0'}`} style={{ top: `${cursorPos.top}px`, left: `${cursorPos.left}px`, height: `${cursorPos.height || 32}px`, visibility: (isFinishedRef.current || !isReady || isPaused) ? 'hidden' : 'visible' }} />
            {preCalculatedLines.map(({ line, lineOffset }, lIdx) => (
              <MemoizedLine 
                key={lIdx} 
                line={line} 
                lineOffset={lineOffset} 
                targetToUserMap={targetToUserMap} 
                activatedPunct={activated} 
                composingIdx={composingTargetIdx} 
                isComposing={isComposing} 
              />
            ))}
          </div>
        </div>
      </div>
      <textarea ref={hiddenInputRef} className="fixed opacity-0 pointer-events-none" value={userInput} onChange={handleInput} onKeyDown={handleKeyDown} onCompositionStart={() => setIsComposing(true)} onCompositionEnd={() => setIsComposing(false)} onBlur={() => setIsComposing(false)} disabled={isPaused} autoFocus spellCheck={false} autoComplete="off" />
    </div>
  );
};

export default TypingAreaV2;
