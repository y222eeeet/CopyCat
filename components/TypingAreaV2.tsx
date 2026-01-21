import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  useLayoutEffect,
} from 'react';
import { TypingSession, PUNCT_SET, Stats, Language } from '../types';
import {
  isJamoPrefix,
  decomposeHangul,
  getFirstKeyOfHangul,
} from '../services/hangulUtils';
import { useAutoScroll } from '../hooks/useAutoScroll';
import {
  playTypingSound,
  playErrorSound,
} from '../services/soundService';

interface Props {
  session: TypingSession;
  isPaused: boolean;
  initialHistory?: string[];
  initialKeystrokes?: number;
  initialAccumulatedTime?: number;
  onStatsUpdate: (stats: Stats) => void;
  onComplete: (stats: Stats) => void;
  onPersist?: (
    history: string[],
    keystrokes: number,
    accumulatedTime: number
  ) => void;
}

const TypingAreaV2: React.FC<Props> = ({
  session,
  isPaused,
  initialHistory = [],
  initialKeystrokes = 0,
  initialAccumulatedTime = 0,
  onStatsUpdate,
  onComplete,
  onPersist,
}) => {
  const [userInputHistory, setUserInputHistory] =
    useState<string[]>(initialHistory);
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

  const lastMistakeCountRef = useRef(0);
  const suppressNextErrorSoundRef = useRef(false);

  useEffect(() => {
    let count = 0;
    for (const c of session.content) {
      if (c !== '\n') count++;
    }
    totalCountRef.current = count;
  }, [session.content]);

  const preCalculatedLines = useMemo(() => {
    const lines = session.content.split('\n');
    let offset = 0;
    return lines.map(line => {
      const res = { line, lineOffset: offset };
      offset += line.length + 1;
      return res;
    });
  }, [session.content]);

  useEffect(() => {
    if (isPaused) {
      if (startTimeRef.current !== null) {
        accumulatedTimeRef.current += Date.now() - startTimeRef.current;
        startTimeRef.current = null;
      }
    } else {
      if (
        userInputHistory.length > 0 &&
        !isFinishedRef.current &&
        startTimeRef.current === null
      ) {
        startTimeRef.current = Date.now();
      }
    }
  }, [isPaused]);

  useEffect(() => {
    if (!isPaused && isReady) hiddenInputRef.current?.focus();
  }, [isPaused, isReady]);

  const isBodyChar = useCallback(
    (c: string) => /^[a-zA-Z0-9가-힣]$/.test(c),
    []
  );

  const isUpperAlpha = useCallback(
    (c: string) => /^[A-Z]$/.test(c),
    []
  );

  const isSufficientlyCompleted = useCallback(
    (u: string, t: string) => {
      if (session.language !== Language.KOREAN) return true;
      if (!u || !t) return true;
      const code = t.charCodeAt(0);
      if (code < 0xac00 || code > 0xd7a3) return true;
      return decomposeHangul(u).length >= decomposeHangul(t).length;
    },
    [session.language]
  );

  const checkCorrect = useCallback(
    (u: string, t: string, next?: string) => {
      if (!t) return false;
      const code = t.charCodeAt(0);
      if (code >= 0xac00 && code <= 0xd7a3) {
        return isJamoPrefix(u, t, next);
      }
      if (isUpperAlpha(t)) return u.toLowerCase() === t.toLowerCase();
      return u === t;
    },
    [isUpperAlpha]
  );

  const getCorrectChar = useCallback(
    (u: string, t: string) => {
      if (isUpperAlpha(t) && u.toLowerCase() === t.toLowerCase()) return t;
      return u === t ? t : u;
    },
    [isUpperAlpha]
  );

  const alignedState = useMemo(() => {
    let resultText = '';
    let targetIdx = 0;
    let lastCommitted = true;
    let composingTargetIdx = -1;
    const mistakes = new Set<number>();
    const activated = new Set<number>();
    const content = session.content;

    const tryConsumeEllipsis = () => {
      if (content[targetIdx] === '…') {
        activated.add(targetIdx);
        resultText += '…';
        targetIdx++;
        return true;
      }
      if (content.slice(targetIdx, targetIdx + 3) === '...') {
        activated.add(targetIdx);
        activated.add(targetIdx + 1);
        activated.add(targetIdx + 2);
        resultText += '...';
        targetIdx += 3;
        return true;
      }
      return false;
    };

    while (targetIdx < content.length) {
      if (tryConsumeEllipsis()) continue;
      if (PUNCT_SET.includes(content[targetIdx])) {
        activated.add(targetIdx);
        resultText += content[targetIdx];
        targetIdx++;
        continue;
      }
      break;
    }

    for (let i = 0; i < userInputHistory.length; i++) {
      const u = userInputHistory[i];
      const isLast = i === userInputHistory.length - 1;
      const composing = isLast && isComposing;

      if (!composing && (u === ' ' || u === '\n')) {
        if (content[targetIdx] === '\n' && lastCommitted) {
          resultText += '\n';
          targetIdx++;
        }
        continue;
      }

      const t = content[targetIdx];
      if (!t) {
        resultText += u;
        targetIdx++;
        continue;
      }

      const okPrefix = checkCorrect(u, t, content[targetIdx + 1]);
      const complete = isSufficientlyCompleted(u, t);
      const isMistake = !okPrefix || (!composing && !complete);

      if (!isMistake) {
        resultText += getCorrectChar(u, t);
        if (composing) composingTargetIdx = targetIdx;
        lastCommitted = complete;
        targetIdx++;
        if (lastCommitted) {
          while (targetIdx < content.length) {
            if (tryConsumeEllipsis()) continue;
            if (PUNCT_SET.includes(content[targetIdx])) {
              activated.add(targetIdx);
              resultText += content[targetIdx];
              targetIdx++;
              continue;
            }
            break;
          }
        }
      } else {
        resultText += u;
        mistakes.add(resultText.length - 1);
        lastCommitted = true;
        targetIdx++;
      }
    }

    return {
      typedText: resultText,
      mistakes,
      activated,
      composingTargetIdx,
      isLastCharComplete: lastCommitted,
    };
  }, [userInputHistory, isComposing, session.content, checkCorrect, getCorrectChar, isSufficientlyCompleted]);

  const {
    typedText,
    mistakes,
    activated,
    composingTargetIdx,
    isLastCharComplete,
  } = alignedState;

  const updateCursorPosition = useCallback(() => {
    const parent = layersRef.current;
    if (!parent) return;

    const idx = typedText.length;
    const measureIdx =
      idx === 0 ? 0 : Math.min(idx, session.content.length - 1);
    const el = document.getElementById(`char-ghost-${measureIdx}`);
    if (!el) return;

    const r = el.getBoundingClientRect();
    const pr = parent.getBoundingClientRect();
    setCursorPos({
      top: r.top - pr.top,
      left: idx === 0 ? r.left - pr.left : r.right - pr.left,
      height: r.height,
    });
    if (!isReady) setIsReady(true);
  }, [typedText.length, session.content, isReady]);

  useLayoutEffect(() => {
    updateCursorPosition();
    const t = setTimeout(updateCursorPosition, 50);
    return () => clearTimeout(t);
  }, [updateCursorPosition]);

  useAutoScroll({
    containerRef,
    targetTop: cursorPos.top,
    targetHeight: cursorPos.height,
    isPaused: isPaused || isFinishedRef.current,
  });

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (isFinishedRef.current || isPaused) return;
    setUserInputHistory(e.target.value.split(''));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isFinishedRef.current || isPaused) return;

    if (startTimeRef.current === null) startTimeRef.current = Date.now();

    const curIdx = typedText.length;
    const targetChar = session.content[curIdx];
    const nextChar = session.content[curIdx + 1];
    const isLineBreakIntent =
      (e.key === 'Enter' || e.key === ' ') &&
      (targetChar === '\n' || nextChar === '\n');

    if (isLineBreakIntent) {
      if (isLastCharComplete && !isComposing) {
        suppressNextErrorSoundRef.current = true;
        playTypingSound('Enter');
        setUserInputHistory(prev => [...prev, '\n']);
        setKeystrokes(k => k + 1);
      }
      e.preventDefault();
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      return;
    }

    const isIME = (e.nativeEvent as any).isComposing;
    if (!isIME) {
      playTypingSound(e.key);
    }

    if (!['Control', 'Alt', 'Shift', 'Meta', 'CapsLock', 'Tab'].includes(e.key)) {
      setKeystrokes(k => k + 1);
    }
  };

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLTextAreaElement>) => {
    setIsComposing(false);
    if (e.data) {
      playTypingSound(getFirstKeyOfHangul(e.data));
    }
    if (onPersist) {
      let acc = accumulatedTimeRef.current;
      if (startTimeRef.current) acc += Date.now() - startTimeRef.current;
      onPersist(userInputHistory, keystrokes, acc);
    }
  };

  useEffect(() => {
    if (isFinishedRef.current) return;

    if (mistakes.size > lastMistakeCountRef.current) {
      if (!suppressNextErrorSoundRef.current) {
        playErrorSound();
      }
    }
    suppressNextErrorSoundRef.current = false;
    lastMistakeCountRef.current = mistakes.size;

    const elapsed =
      accumulatedTimeRef.current +
      (startTimeRef.current ? Date.now() - startTimeRef.current : 0);
    if (elapsed < 200) return;

    const seconds = elapsed / 1000;
    const speed =
      session.language === Language.KOREAN
        ? (keystrokes / seconds) * 60
        : (typedText.length / 5) / (seconds / 60);

    const accuracy =
      typedText.length === 0
        ? 100
        : Math.max(0, 100 - (mistakes.size / typedText.length) * 100);

    onStatsUpdate({
      speed,
      accuracy,
      typedCount: Math.min(
        typedText.replace(/\n/g, '').length,
        totalCountRef.current
      ),
      totalCount: totalCountRef.current,
      elapsedTime: seconds,
    });

    if (
      typedText.replace(/\n/g, '').length >= totalCountRef.current &&
      isLastCharComplete
    ) {
      isFinishedRef.current = true;
      onComplete({
        speed,
        accuracy,
        typedCount: totalCountRef.current,
        totalCount: totalCountRef.current,
        elapsedTime: seconds,
      });
    }
  }, [typedText, mistakes.size, keystrokes, isLastCharComplete]);

  return (
    <div
      className="h-full min-h-0 flex flex-col relative"
      onClick={() => !isPaused && hiddenInputRef.current?.focus()}
    >
      <div ref={containerRef} className="flex-1 min-h-0 overflow-y-auto pr-4">
        <div className="relative min-h-full pb-[70vh]">
          <div
            ref={layersRef}
            className="relative w-full text-2xl leading-relaxed whitespace-pre-wrap break-keep"
          >
            <div
              className="absolute w-[2px] bg-black/50 z-20 transition-[left,top] duration-150"
              style={{
                top: cursorPos.top,
                left: cursorPos.left,
                height: cursorPos.height || 32,
                opacity: isFinishedRef.current ? 0 : 1,
              }}
            />
            <div className="absolute top-0 left-0 w-full pointer-events-none">
              {preCalculatedLines.map(({ line, lineOffset }, i) => (
                <div key={i}>
                  {line.split('').map((c, j) => {
                    const idx = lineOffset + j;
                    let color = '#E5E7EB';
                    if (activated.has(idx)) color = '#333';
                    if (idx < typedText.length) color = 'transparent';
                    return (
                      <span id={`char-ghost-${idx}`} key={idx} style={{ color }}>
                        {c}
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="relative pointer-events-none">
              {preCalculatedLines.map(({ line, lineOffset }, i) => (
                <div key={i}>
                  {line.split('').map((_, j) => {
                    const idx = lineOffset + j;
                    if (idx < typedText.length) {
                      const ch = typedText[idx];
                      if (PUNCT_SET.includes(ch))
                        return (
                          <span key={idx} className="invisible">
                            {ch}
                          </span>
                        );
                      return (
                        <span
                          key={idx}
                          className={
                            mistakes.has(idx) ? 'text-red-500' : 'text-black'
                          }
                        >
                          {ch}
                        </span>
                      );
                    }
                    return (
                      <span key={idx} className="invisible">
                        _
                      </span>
                    );
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
      />
    </div>
  );
};

export default TypingAreaV2;
