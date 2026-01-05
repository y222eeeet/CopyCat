
import React, { useState, useEffect, useRef, useCallback, useLayoutEffect, useMemo } from 'react';
import { TypingSession, PUNCT_SET, Stats, Language } from '../types';
import { isJamoPrefix, decomposeHangul } from '../services/hangulUtils';

interface Props {
  session: TypingSession;
  onStatsUpdate: (stats: Stats) => void;
  onComplete: (stats: Stats) => void;
}

const TypingArea: React.FC<Props> = ({ session, onStatsUpdate, onComplete }) => {
  const [userInputHistory, setUserInputHistory] = useState<string[]>([]);
  const [isComposing, setIsComposing] = useState(false);
  const [keystrokes, setKeystrokes] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [cursorPos, setCursorPos] = useState({ top: 0, left: 0, height: 0 });
  
  const containerRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<HTMLDivElement>(null);
  const hiddenInputRef = useRef<HTMLTextAreaElement>(null);
  const lastSpeedRef = useRef<number>(0);
  const totalCountRef = useRef(0);
  const endTimeRef = useRef<number | null>(null);
  const isFinishedRef = useRef(false);
  const scrollAnimRef = useRef<number | null>(null);

  useEffect(() => {
    const raw = session.content;
    let count = 0;
    for (const char of raw) {
      if (char !== '\n') count++;
    }
    totalCountRef.current = count;
  }, [session.content]);

  // Cleanup scroll animation on unmount
  useEffect(() => {
    return () => {
      if (scrollAnimRef.current) cancelAnimationFrame(scrollAnimRef.current);
    };
  }, []);

  const isBodyChar = useCallback((char: string) => {
    return /^[a-zA-Z0-9가-힣]$/.test(char);
  }, []);

  const isDblQuote = useCallback((char: string) => {
    return char === '"' || char === '“' || char === '”';
  }, []);

  const isSufficientlyCompleted = useCallback((u: string, t: string) => {
    if (session.language !== Language.KOREAN) return true;
    if (!u || !t) return true;
    const tCode = t.charCodeAt(0);
    const isHangul = tCode >= 0xAC00 && tCode <= 0xD7A3;
    if (!isHangul) return true;
    
    const uJamos = decomposeHangul(u);
    const tJamos = decomposeHangul(t);
    return uJamos.length >= tJamos.length;
  }, [session.language]);

  const checkCorrect = useCallback((input: string, target: string, nextTarget?: string) => {
    if (!target) return false;
    if (session.language === Language.KOREAN) {
      return isJamoPrefix(input, target, nextTarget);
    } else {
      const isTargetUpper = target === target.toUpperCase() && target !== target.toLowerCase();
      if (isTargetUpper) return input.toLowerCase() === target.toLowerCase();
      return input === target;
    }
  }, [session.language]);

  const getCorrectChar = useCallback((input: string, target: string) => {
    if (session.language === Language.ENGLISH) {
      const isTargetUpper = target === target.toUpperCase() && target !== target.toLowerCase();
      if (isTargetUpper && input.toLowerCase() === target.toLowerCase()) return target;
    }
    return input === target ? target : input;
  }, [session.language]);

  const flushPendingCommit = useCallback(() => {
    setIsComposing(false);
  }, []);

  // Custom Smooth Scroll Logic
  const performSmoothScroll = useCallback((targetTop: number) => {
    const container = containerRef.current;
    if (!container) return;

    if (scrollAnimRef.current) cancelAnimationFrame(scrollAnimRef.current);

    const startTop = container.scrollTop;
    const distance = targetTop - startTop;
    
    // Threshold to prevent micro-animations
    if (Math.abs(distance) < 2) return;

    const startTime = performance.now();
    const baseDuration = 220;
    // Duration scaled by distance, clamped 160-420ms
    const duration = Math.min(420, Math.max(160, baseDuration + (Math.abs(distance) / 2.5)));

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease-out cubic
      const ease = 1 - Math.pow(1 - progress, 3);

      container.scrollTop = startTop + distance * ease;

      if (progress < 1) {
        scrollAnimRef.current = requestAnimationFrame(step);
      } else {
        scrollAnimRef.current = null;
      }
    };

    scrollAnimRef.current = requestAnimationFrame(step);
  }, []);

  // Replay Engine - Reconstructs the aligned state from raw history
  const alignedState = useMemo(() => {
    let resultText = "";
    let targetIdx = 0;
    let lastCharCommitted = true;
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

    // Rule 3A (Absolute Start)
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

      // Newline advance logic
      if (!isActuallyComposing && (userChar === ' ' || userChar === '\n')) {
        if (targetIdx < content.length && content[targetIdx] === '\n') {
          if (lastCharCommitted) {
            while (targetIdx < content.length && content[targetIdx] === '\n') {
              resultText += '\n';
              targetIdx++;
            }
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
          }
          continue; 
        }
      }

      // PREFIX Activation
      if (isBodyChar(userChar)) {
        while (targetIdx < content.length) {
          if (tryConsumeEllipsis()) continue;
          if (!PUNCT_SET.includes(content[targetIdx])) break;
          const pChar = content[targetIdx];
          if (isDblQuote(pChar)) {
            resultText += pChar;
            activated.add(targetIdx);
            targetIdx++;
            continue;
          }
          let bodyCharAhead = false;
          for (let k = targetIdx + 1; k < content.length; k++) {
            const nextChar = content[k];
            if (nextChar === ' ' || nextChar === '\n') break;
            if (isBodyChar(nextChar)) {
              bodyCharAhead = true;
              break;
            }
            if (!PUNCT_SET.includes(nextChar)) break;
          }
          if (bodyCharAhead) {
            resultText += content[targetIdx];
            activated.add(targetIdx);
            targetIdx++;
            continue;
          }
          break;
        }
      }

      const targetChar = content[targetIdx];
      if (!targetChar) {
        resultText += userChar;
        targetIdx++;
        continue;
      }

      const isCorrect = checkCorrect(userChar, targetChar, content[targetIdx + 1]);
      if (isCorrect) {
        const finalChar = getCorrectChar(userChar, targetChar);
        resultText += finalChar;
        if (isActuallyComposing) composingTargetIdx = targetIdx;
        if (isBodyChar(targetChar)) {
          lastCharCommitted = isSufficientlyCompleted(userChar, targetChar);
        } else {
          lastCharCommitted = !isActuallyComposing;
        }
        targetIdx++;
        if (lastCharCommitted) {
          while (targetIdx < content.length) {
            if (tryConsumeEllipsis()) continue;
            if (PUNCT_SET.includes(content[targetIdx])) {
               resultText += content[targetIdx];
               activated.add(targetIdx);
               targetIdx++;
               continue;
            }
            break;
          }
        }
      } else {
        resultText += userChar;
        mistakesSet.add(resultText.length - 1);
        lastCharCommitted = false;
        targetIdx++;
      }
    }

    return { 
      typedText: resultText, 
      mistakes: mistakesSet, 
      activatedPunctIndices: activated,
      composingTargetIdx 
    };
  }, [userInputHistory, isComposing, session.content, checkCorrect, getCorrectChar, isSufficientlyCompleted, isBodyChar, isDblQuote]);

  const { typedText, mistakes, activatedPunctIndices, composingTargetIdx } = alignedState;

  const calculateStats = useCallback((currentTyped: string, currentKeystrokes: number, currentMistakes: Set<number>, forcedEndTime?: number) => {
    if (!startTime) return null;
    const now = forcedEndTime || endTimeRef.current || Date.now();
    const elapsedSeconds = (now - startTime) / 1000;
    if (elapsedSeconds <= 0.1) return null;

    let speed = 0;
    if (session.language === Language.KOREAN) {
      speed = (currentKeystrokes / elapsedSeconds) * 60;
    } else {
      speed = (currentTyped.length / 5) / (elapsedSeconds / 60);
    }

    const alpha = 0.2;
    const stableSpeed = lastSpeedRef.current === 0 ? speed : (alpha * speed + (1 - alpha) * lastSpeedRef.current);
    if (!forcedEndTime && !endTimeRef.current) lastSpeedRef.current = stableSpeed;

    const accuracy = currentTyped.length === 0 ? 100 : Math.max(0, 100 - (currentMistakes.size / currentTyped.length) * 100);
    const filteredTypedTextLength = currentTyped.replace(/\n/g, '').length;
    const clampedTypedCount = Math.min(filteredTypedTextLength, totalCountRef.current);

    return {
      speed: (forcedEndTime || endTimeRef.current) ? speed : stableSpeed,
      accuracy,
      typedCount: clampedTypedCount,
      totalCount: totalCountRef.current,
      elapsedTime: elapsedSeconds
    };
  }, [startTime, session.language]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (isFinishedRef.current) return;
    setUserInputHistory(e.target.value.split(''));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isFinishedRef.current) return;
    if (!startTime) setStartTime(Date.now());
    if (PUNCT_SET.includes(e.key) || e.key === '.') {
      e.preventDefault();
      return;
    }
    if (e.key === 'Enter') {
      const currentTargetIdx = typedText.length;
      if (session.content[currentTargetIdx] === '\n') {
        setUserInputHistory(prev => [...prev, '\n']);
        e.preventDefault();
        return;
      }
    }
    if (!['Control', 'Alt', 'Shift', 'Meta', 'CapsLock', 'Tab'].includes(e.key)) {
      setKeystrokes(prev => prev + 1);
    }
  };

  const handleCompositionStart = () => setIsComposing(true);
  const handleCompositionEnd = () => setIsComposing(false);

  useEffect(() => {
    if (isFinishedRef.current) return;
    const currentStats = calculateStats(typedText, keystrokes, mistakes);
    if (currentStats) onStatsUpdate(currentStats);

    const currentProgress = typedText.replace(/\n/g, '').length;
    const targetProgress = session.content.replace(/\n/g, '').length;
    if (currentProgress >= targetProgress && typedText.length > 0 && !isFinishedRef.current) {
      isFinishedRef.current = true;
      const finalTime = Date.now();
      endTimeRef.current = finalTime;
      const finalStats = calculateStats(typedText, keystrokes, mistakes, finalTime);
      if (finalStats) onComplete(finalStats);
    }
  }, [typedText, mistakes, calculateStats, keystrokes, onComplete, onStatsUpdate, session.content]);

  // Logic to calculate caret position and trigger smooth auto-scroll
  useLayoutEffect(() => {
    const updateCursor = () => {
      const parentEl = layersRef.current;
      const container = containerRef.current;
      if (!parentEl || !container) return;

      const targetIdx = typedText.length;
      const isAtEnd = targetIdx >= session.content.length;
      const charIdxToMeasure = isAtEnd ? session.content.length - 1 : targetIdx;
      const charEl = document.getElementById(`char-ghost-${charIdxToMeasure}`);
      
      if (charEl) {
        const rect = charEl.getBoundingClientRect();
        const parentRect = parentEl.getBoundingClientRect();
        const top = rect.top - parentRect.top;
        const left = isAtEnd ? rect.right - parentRect.left : rect.left - parentRect.left;
        const height = rect.height;

        setCursorPos({ top, left, height });

        // Auto-Scroll Logic: Trigger only if not finished
        if (isFinishedRef.current) return;

        const viewportHeight = container.clientHeight;
        const currentScroll = container.scrollTop;
        
        // Safe Zone Definition
        const topPadding = viewportHeight * 0.20;
        const bottomPadding = viewportHeight * 0.30;
        const safeTopBoundary = currentScroll + topPadding;
        const safeBottomBoundary = currentScroll + viewportHeight - bottomPadding;

        let targetScrollTop = currentScroll;

        // If caret is above the safe zone
        if (top < safeTopBoundary) {
          targetScrollTop = top - topPadding;
        } 
        // If caret is below the safe zone
        else if (top + height > safeBottomBoundary) {
          targetScrollTop = top + height - (viewportHeight - bottomPadding);
        }

        // Apply smooth animation if target changes
        if (Math.abs(targetScrollTop - currentScroll) > 1) {
          performSmoothScroll(Math.max(0, targetScrollTop));
        }
      }
    };

    updateCursor();
    // Re-check after a brief delay for any dynamic layout shifts (especially with IME)
    const timer = setTimeout(updateCursor, 32);
    return () => clearTimeout(timer);
  }, [typedText, session.content, performSmoothScroll]);

  const focusInput = () => hiddenInputRef.current?.focus();

  const renderLayers = () => {
    const lines = session.content.split('\n');
    let charOffset = 0;
    return (
      <div 
        ref={layersRef} 
        className="relative w-full text-2xl leading-relaxed tracking-tight whitespace-pre-wrap break-keep text-left select-none outline-none font-medium"
        style={{ wordBreak: 'keep-all', overflowWrap: 'normal', hyphens: 'none' }}
      >
        <div 
          className="absolute w-[2px] bg-black/40 z-20 transition-[left,top] duration-[250ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]"
          style={{ 
            top: `${cursorPos.top}px`, 
            left: `${cursorPos.left}px`, 
            height: `${cursorPos.height || 32}px`,
            opacity: isFinishedRef.current ? 0 : 1
          }}
        />

        <div className="absolute top-0 left-0 w-full pointer-events-none z-0">
          {lines.map((line, lineIdx) => {
            const lineStartIdx = charOffset;
            const res = (
              <div key={`gl-${lineIdx}`} className="min-h-[1.6em]">
                {line.split('').map((char, charIdx) => {
                  const absIdx = lineStartIdx + charIdx;
                  const isCommitted = absIdx < typedText.length;
                  const isActivated = activatedPunctIndices.has(absIdx);
                  const isBeingComposed = absIdx === composingTargetIdx && isComposing;
                  
                  let color = '#D1D5DB'; 
                  if (isBeingComposed) {
                    color = 'transparent';
                  } else if (isActivated) {
                    color = '#000000'; 
                  } else if (isCommitted) {
                    color = PUNCT_SET.includes(char) ? '#000000' : 'transparent';
                  }

                  return (
                    <span 
                      id={`char-ghost-${absIdx}`}
                      key={`g-${absIdx}`} 
                      className="transition-colors duration-150"
                      style={{ color }}
                    >
                      {char}
                    </span>
                  );
                })}
              </div>
            );
            charOffset += line.length + 1;
            return res;
          })}
        </div>

        <div className="relative w-full z-10 pointer-events-none">
          {(() => {
            let offset = 0;
            return lines.map((line, lineIdx) => {
              const lineStartIdx = offset;
              const res = (
                <div key={`tl-${lineIdx}`} className="min-h-[1.6em]">
                  {line.split('').map((targetChar, charIdx) => {
                    const absIdx = lineStartIdx + charIdx;
                    if (absIdx < typedText.length) {
                      const char = typedText[absIdx];
                      const isErr = mistakes.has(absIdx);
                      if (PUNCT_SET.includes(char)) {
                        return <span key={`t-${absIdx}`} className="invisible">{char}</span>;
                      }
                      return (
                        <span key={`t-${absIdx}`} className={isErr ? 'text-red-500' : 'text-black'}>
                          {char}
                        </span>
                      );
                    }
                    return <span key={`s-${absIdx}`} className="invisible">{targetChar}</span>;
                  })}
                </div>
              );
              offset += line.length + 1;
              return res;
            });
          })()}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col" onClick={focusInput}>
      <div ref={containerRef} className="flex-1 overflow-y-auto custom-scrollbar pr-4">
        <div className="relative min-h-full pb-[60vh]">
          {renderLayers()}
        </div>
      </div>
      <textarea
        ref={hiddenInputRef}
        className="fixed opacity-0 pointer-events-none"
        value={userInputHistory.join('')}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        onBlur={flushPendingCommit}
        autoFocus
        spellCheck={false}
        autoComplete="off"
      />
    </div>
  );
};

export default TypingArea;
