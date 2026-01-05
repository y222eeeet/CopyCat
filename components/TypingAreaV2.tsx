
import React, { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from 'react';
import { TypingSession, PUNCT_SET, Stats, Language } from '../types';
import { isJamoPrefix, decomposeHangul, getFirstKeyOfHangul } from '../services/hangulUtils';
import { useAutoScroll } from '../hooks/useAutoScroll';
import { playTypingSound } from '../services/soundService';

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
  session, 
  isPaused, 
  initialHistory = [], 
  initialKeystrokes = 0,
  initialAccumulatedTime = 0,
  onStatsUpdate, 
  onComplete,
  onPersist
}) => {
  const [userInputHistory, setUserInputHistory] = useState<string[]>(initialHistory);
  const [isComposing, setIsComposing] = useState(false);
  const [keystrokes, setKeystrokes] = useState(initialKeystrokes);
  const [cursorPos, setCursorPos] = useState({ top: 0, left: 0, height: 0 });
  const [isReady, setIsReady] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<HTMLDivElement>(null);
  const hiddenInputRef = useRef<HTMLTextAreaElement>(null);
  const startTimeRef = useRef<number | null>(null);
  const accumulatedTimeRef = useRef<number>(initialAccumulatedTime);
  const totalCountRef = useRef(0);
  const isFinishedRef = useRef(false);

  useEffect(() => {
    const raw = session.content;
    let count = 0;
    for (const char of raw) {
      if (char !== '\n') count++;
    }
    totalCountRef.current = count;
  }, [session.content]);

  const preCalculatedLines = useMemo(() => {
    const lines = session.content.split('\n');
    let offset = 0;
    return lines.map(line => {
      const lineData = { line, lineOffset: offset };
      offset += line.length + 1;
      return lineData;
    });
  }, [session.content]);

  // Handle Pause/Resume timing
  useEffect(() => {
    if (isPaused) {
      if (startTimeRef.current !== null) {
        accumulatedTimeRef.current += (Date.now() - startTimeRef.current);
        startTimeRef.current = null;
      }
    } else {
      if (userInputHistory.length > 0 && !isFinishedRef.current && startTimeRef.current === null) {
        startTimeRef.current = Date.now();
      }
    }
  }, [isPaused]);

  useEffect(() => {
    if (!isPaused && isReady) {
      hiddenInputRef.current?.focus();
    }
  }, [isPaused, isReady]);

  const isBodyChar = useCallback((char: string) => /^[a-zA-Z0-9가-힣]$/.test(char), []);
  const isDblQuote = useCallback((char: string) => char === '"' || char === '“' || char === '”', []);
  const isUpperAlpha = useCallback((char: string) => /^[A-Z]$/.test(char), []);
  
  const isSufficientlyCompleted = useCallback((u: string, t: string) => {
    if (session.language !== Language.KOREAN) return true;
    if (!u || !t) return true;
    const tCode = t.charCodeAt(0);
    const isHangulTarget = tCode >= 0xAC00 && tCode <= 0xD7A3;
    if (!isHangulTarget) return true;
    
    const uJamos = decomposeHangul(u);
    const tJamos = decomposeHangul(t);
    return uJamos.length >= tJamos.length;
  }, [session.language]);

  const checkCorrect = useCallback((input: string, target: string, nextTarget?: string) => {
    if (!target) return false;
    const isTargetHangul = target.charCodeAt(0) >= 0xAC00 && target.charCodeAt(0) <= 0xD7A3;
    if (isTargetHangul || (session.language === Language.KOREAN && /^[ㄱ-ㅎㅏ-ㅣ]$/.test(target))) {
      return isJamoPrefix(input, target, nextTarget);
    }
    if (isUpperAlpha(target)) {
      return input.toLowerCase() === target.toLowerCase();
    }
    return input === target;
  }, [session.language, isUpperAlpha]);

  const getCorrectChar = useCallback((input: string, target: string) => {
    if (isUpperAlpha(target) && input.toLowerCase() === target.toLowerCase()) {
      return target;
    }
    return input === target ? target : input;
  }, [isUpperAlpha]);

  const alignedState = useMemo(() => {
    let resultText = "";
    let targetIdx = 0;
    let lastCharCommitted = true;
    let isLastCharComplete = false;
    let composingTargetIdx = -1;
    const mistakesSet = new Set<number>();
    const activated = new Set<number>();
    const content = session.content;

    const getEllipsisLenAt = (idx: number) => {
      if (content[idx] === '…') return 1;
      if (content.substring(idx, idx + 3) === '...') return 3;
      return 0;
    };

    const tryConsumeEllipsis = () => {
      const eLen = getEllipsisLenAt(targetIdx);
      if (eLen > 0) {
        for (let j = 0; j < eLen; j++) activated.add(targetIdx + j);
        resultText += content.substring(targetIdx, targetIdx + eLen);
        targetIdx += eLen;
        return true;
      }
      return false;
    };

    while (targetIdx < content.length) {
      if (tryConsumeEllipsis()) continue;
      if (isDblQuote(content[targetIdx])) {
        activated.add(targetIdx);
        resultText += content[targetIdx];
        targetIdx++;
        continue;
      }
      break;
    }

    for (let i = 0; i < userInputHistory.length; i++) {
      const userChar = userInputHistory[i];
      const isLast = i === userInputHistory.length - 1;
      const isActuallyComposing = isLast && isComposing;

      if (!isActuallyComposing && (userChar === ' ' || userChar === '\n')) {
        if (targetIdx < content.length && content[targetIdx] === '\n') {
          if (lastCharCommitted) {
            playTypingSound('\n'); // Trigger Enter sound on paragraph advance
            while (targetIdx < content.length && content[targetIdx] === '\n') { resultText += '\n'; targetIdx++; }
            while (targetIdx < content.length) {
              if (tryConsumeEllipsis()) continue;
              if (isDblQuote(content[targetIdx])) { activated.add(targetIdx); resultText += content[targetIdx]; targetIdx++; continue; }
              break;
            }
          }
          continue; 
        }
      }

      if (isBodyChar(userChar)) {
        while (targetIdx < content.length) {
          if (tryConsumeEllipsis()) continue;
          if (!PUNCT_SET.includes(content[targetIdx])) break;
          const pChar = content[targetIdx];
          if (isDblQuote(pChar)) { resultText += pChar; activated.add(targetIdx); targetIdx++; continue; }
          let bodyCharAhead = false;
          for (let k = targetIdx + 1; k < content.length; k++) {
            const nextChar = content[k];
            if (nextChar === ' ' || nextChar === '\n') break;
            if (isBodyChar(nextChar)) { bodyCharAhead = true; break; }
            if (!PUNCT_SET.includes(nextChar)) break;
          }
          if (bodyCharAhead) { resultText += content[targetIdx]; activated.add(targetIdx); targetIdx++; continue; }
          break;
        }
      }

      const targetChar = content[targetIdx];
      if (!targetChar) { resultText += userChar; targetIdx++; continue; }

      const isCorrectPrefix = checkCorrect(userChar, targetChar, content[targetIdx + 1]);
      const isComplete = isSufficientlyCompleted(userChar, targetChar);
      const isMistake = !isCorrectPrefix || (!isActuallyComposing && !isComplete);

      if (!isMistake) {
        const finalChar = getCorrectChar(userChar, targetChar);
        resultText += finalChar;
        if (isActuallyComposing) composingTargetIdx = targetIdx;
        
        if (isBodyChar(targetChar)) {
          lastCharCommitted = isComplete;
        } else {
          lastCharCommitted = !isActuallyComposing;
        }
        targetIdx++;
        if (lastCharCommitted) {
          while (targetIdx < content.length) {
            if (tryConsumeEllipsis()) continue;
            if (PUNCT_SET.includes(content[targetIdx])) { resultText += content[targetIdx]; activated.add(targetIdx); targetIdx++; continue; }
            break;
          }
        }
      } else { 
        resultText += userChar; 
        mistakesSet.add(resultText.length - 1); 
        lastCharCommitted = true; 
        targetIdx++; 
      }
      
      if (isLast) {
        isLastCharComplete = lastCharCommitted;
      }
    }
    
    return { typedText: resultText, mistakes: mistakesSet, activatedPunctIndices: activated, composingTargetIdx, isLastCharComplete };
  }, [userInputHistory, isComposing, session.content, checkCorrect, getCorrectChar, isSufficientlyCompleted, isBodyChar, isDblQuote]);

  const { typedText, mistakes, activatedPunctIndices, composingTargetIdx, isLastCharComplete } = alignedState;

  const updateCursorPosition = useCallback(() => {
    const parentEl = layersRef.current;
    if (!parentEl) return;

    const targetIdx = typedText.length;
    const contentLen = session.content.length;
    
    const isAtStart = targetIdx === 0;
    const isAtEnd = targetIdx >= contentLen;
    const charIdxToMeasure = isAtEnd ? contentLen - 1 : (isAtStart ? 0 : targetIdx);
    
    const charEl = document.getElementById(`char-ghost-${charIdxToMeasure}`);
    if (charEl) {
      const rect = charEl.getBoundingClientRect();
      const parentRect = parentEl.getBoundingClientRect();
      
      let top = rect.top - parentRect.top;
      let left = isAtStart ? rect.left - parentRect.left : (isAtEnd ? rect.right - parentRect.left : rect.left - parentRect.left);
      const height = rect.height;

      if (!isAtEnd && !isAtStart && session.content[targetIdx] === '\n') {
        const nextEl = document.getElementById(`char-ghost-${targetIdx + 1}`);
        if (nextEl) {
          const nextRect = nextEl.getBoundingClientRect();
          top = nextRect.top - parentRect.top;
          left = nextRect.left - parentRect.left;
        }
      }

      setCursorPos({ top, left, height });
      if (!isReady) setIsReady(true);
    }
  }, [typedText.length, session.content, isReady]);

  useLayoutEffect(() => {
    updateCursorPosition();
    const timer = setTimeout(updateCursorPosition, 50);
    return () => clearTimeout(timer);
  }, [updateCursorPosition]);

  useAutoScroll({
    containerRef,
    targetTop: cursorPos.top,
    targetHeight: cursorPos.height,
    isPaused: isFinishedRef.current || isPaused
  });

  const calculateStats = useCallback((currentTyped: string, currentKeystrokes: number, currentMistakes: Set<number>, forcedEndTime?: number) => {
    let elapsedMs = accumulatedTimeRef.current;
    if (startTimeRef.current !== null) {
      elapsedMs += (forcedEndTime || Date.now()) - startTimeRef.current;
    }
    
    const elapsedSeconds = elapsedMs / 1000;
    if (elapsedSeconds <= 0.2) return null;

    let speed = 0;
    if (session.language === Language.KOREAN) {
      speed = (currentKeystrokes / elapsedSeconds) * 60;
    } else {
      speed = (currentTyped.length / 5) / (elapsedSeconds / 60);
    }

    const accuracy = currentTyped.length === 0 ? 100 : Math.max(0, 100 - (currentMistakes.size / currentTyped.length) * 100);
    const clampedTypedCount = Math.min(currentTyped.replace(/\n/g, '').length, totalCountRef.current);
    
    return { 
      speed: Math.min(speed, 2500), 
      accuracy, 
      typedCount: clampedTypedCount, 
      totalCount: totalCountRef.current, 
      elapsedTime: elapsedSeconds 
    };
  }, [session.language]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (isFinishedRef.current || isPaused) return;
    setUserInputHistory(e.target.value.split(''));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isFinishedRef.current || isPaused) return;
    
    if (startTimeRef.current === null && !isPaused) {
      startTimeRef.current = Date.now();
    }
    
    // Typing Sound Logic (Non-composition keys)
    const isIMEActive = (e.nativeEvent as any).isComposing;
    if (!isIMEActive) {
      if (e.key === 'Enter') {
        playTypingSound('\n');
      } else if (e.key.length === 1 && /^[a-zA-Z]$/.test(e.key)) {
        playTypingSound(e.key);
      }
    }

    if (PUNCT_SET.includes(e.key) || e.key === '.') { e.preventDefault(); return; }
    if (e.key === 'Enter') {
      const currentTargetIdx = typedText.length;
      if (session.content[currentTargetIdx] === '\n') { setUserInputHistory(prev => [...prev, '\n']); e.preventDefault(); return; }
    }
    if (!['Control', 'Alt', 'Shift', 'Meta', 'CapsLock', 'Tab'].includes(e.key)) setKeystrokes(prev => prev + 1);
  };

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLTextAreaElement>) => {
    setIsComposing(false);
    
    // Trigger Exactly one typing sound for Korean syllable commit
    const committedChar = e.data;
    if (committedChar) {
      const mappedKey = getFirstKeyOfHangul(committedChar);
      playTypingSound(mappedKey);
    }

    if (onPersist) {
      let currentAcc = accumulatedTimeRef.current;
      if (startTimeRef.current) currentAcc += (Date.now() - startTimeRef.current);
      onPersist(userInputHistory, keystrokes, currentAcc);
    }
  };

  useEffect(() => {
    if (isFinishedRef.current) return;
    
    const currentStats = calculateStats(typedText, keystrokes, mistakes);
    if (currentStats) onStatsUpdate(currentStats);
    
    const currentProgress = typedText.replace(/\n/g, '').length;
    if (currentProgress >= totalCountRef.current && isLastCharComplete && typedText.length > 0) {
      isFinishedRef.current = true;
      const finalTime = Date.now();
      const finalStats = calculateStats(typedText, keystrokes, mistakes, finalTime);
      if (finalStats) onComplete(finalStats);
    }
  }, [typedText.length, mistakes.size, keystrokes, isLastCharComplete, calculateStats, onStatsUpdate, onComplete]);

  return (
    <div className="h-full min-h-0 flex flex-col relative" onClick={() => !isPaused && hiddenInputRef.current?.focus()}>
      {isPaused && (
        <div className="absolute inset-0 z-30 bg-white/40 backdrop-blur-[1px] flex items-center justify-center transition-all duration-300">
          <div className="bg-black/5 text-black px-6 py-3 rounded-full font-bold text-sm tracking-widest uppercase">
            Click Resume to Continue
          </div>
        </div>
      )}
      
      <div ref={containerRef} className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-4">
        <div className="relative min-h-full pb-[70vh]">
          <div ref={layersRef} className="relative w-full text-2xl leading-relaxed tracking-tight whitespace-pre-wrap break-keep text-left select-none outline-none font-medium">
            <div 
              className={`absolute w-[2px] bg-black/50 z-20 ${isReady ? 'transition-[left,top] duration-[180ms] ease-out' : ''}`}
              style={{ 
                top: `${cursorPos.top}px`, 
                left: `${cursorPos.left}px`, 
                height: `${cursorPos.height || 32}px`, 
                opacity: (isFinishedRef.current || !isReady || isPaused) ? 0 : 1 
              }}
            />
            <div className="absolute top-0 left-0 w-full pointer-events-none z-0">
              {preCalculatedLines.map(({ line, lineOffset }, lIdx) => (
                <div key={lIdx} className="min-h-[1.6em]">
                  {line.split('').map((char, cIdx) => {
                    const absIdx = lineOffset + cIdx;
                    const isCommitted = absIdx < typedText.length;
                    const isActivated = activatedPunctIndices.has(absIdx);
                    const isBeingComposed = absIdx === composingTargetIdx && isComposing;
                    let color = '#E5E7EB';
                    if (isBeingComposed) color = 'transparent';
                    else if (isActivated) color = '#333333';
                    else if (isCommitted) color = PUNCT_SET.includes(char) ? '#333333' : 'transparent';
                    return <span id={`char-ghost-${absIdx}`} key={absIdx} style={{ color }}>{char}</span>;
                  })}
                </div>
              ))}
            </div>
            <div className="relative w-full z-10 pointer-events-none">
              {preCalculatedLines.map(({ line, lineOffset }, lIdx) => (
                <div key={lIdx} className="min-h-[1.6em]">
                  {line.split('').map((targetChar, cIdx) => {
                    const absIdx = lineOffset + cIdx;
                    if (absIdx < typedText.length) {
                      const char = typedText[absIdx];
                      const isErr = mistakes.has(absIdx);
                      if (PUNCT_SET.includes(char)) return <span key={absIdx} className="invisible">{char}</span>;
                      return <span key={absIdx} className={isErr ? 'text-red-500' : 'text-black'}>{char}</span>;
                    }
                    return <span key={absIdx} className="invisible">{targetChar}</span>;
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <textarea 
        ref={hiddenInputRef} 
        className="fixed opacity-0 pointer-events-none" 
        value={userInputHistory.join('')} 
        onChange={handleInput} 
        onKeyDown={handleKeyDown} 
        onCompositionStart={() => setIsComposing(true)} 
        onCompositionEnd={handleCompositionEnd} 
        onBlur={() => setIsComposing(false)} 
        disabled={isPaused}
        autoFocus 
        spellCheck={false} 
        autoComplete="off" 
      />
    </div>
  );
};

export default TypingAreaV2;
