
import React, { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from 'react';
import { TypingSession, PUNCT_SET, Stats, Language } from '../types';
import { isJamoPrefix, decomposeHangul } from '../services/hangulUtils';
import { useAutoScroll } from '../hooks/useAutoScroll';
import { playTypingSound, playErrorSound, playCompletionSound } from '../services/soundService';

const jamoCache = new Map<string, string[]>();
const getCachedDecomposition = (char: string) => {
  if (!char) return [];
  if (jamoCache.has(char)) return jamoCache.get(char)!;
  const res = decomposeHangul(char);
  jamoCache.set(char, res);
  return res;
};

const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

interface UserCharData {
  char: string;
  isMistake: boolean;
}

interface LineData {
  userChars: (UserCharData | null)[];
  activated: boolean[]; // lineOffset 기준 로컬 인덱스
}

const MemoizedLine = React.memo(({ 
  line, 
  lineOffset, 
  userData, // LineData
  composingLocalIdx,
  isComposing,
  isDarkMode
}: {
  line: string;
  lineOffset: number;
  userData: LineData;
  composingLocalIdx: number;
  isComposing: boolean;
  isDarkMode: boolean;
}) => {
  const chars = line.split('');
  
  return (
    <div className="min-h-[40px] relative">
      {/* Ghost Layer */}
      <div className="absolute top-0 left-0 w-full pointer-events-none">
        {chars.map((char, cIdx) => {
          const isBeingComposed = cIdx === composingLocalIdx && isComposing;
          const isActivated = userData.activated[cIdx];
          const hasUserInput = !!userData.userChars[cIdx];
          
          let color = isDarkMode ? '#555555' : '#E5E7EB'; 
          if (isBeingComposed || hasUserInput) {
            color = 'transparent';
          } else if (isActivated) {
            color = isDarkMode ? '#bbbbbb' : '#333333';
          }
          
          return <span id={`char-ghost-${lineOffset + cIdx}`} key={cIdx} style={{ color }}>{char}</span>;
        })}
      </div>
      {/* User Input Layer */}
      <div className="relative w-full z-10 pointer-events-none">
        {chars.map((_, cIdx) => {
          const uData = userData.userChars[cIdx];
          if (!uData) return <span key={cIdx} className="invisible">{chars[cIdx]}</span>;
          if (PUNCT_SET.includes(uData.char)) return <span key={cIdx} className="invisible">{uData.char}</span>;
          
          return (
            <span 
              key={cIdx} 
              className={`${uData.isMistake ? 'text-red-500 font-normal' : (isDarkMode ? 'text-[#e0e0e0]' : 'text-black')}`}
            >
              {uData.char}
            </span>
          );
        })}
      </div>
    </div>
  );
});

interface Props {
  session: TypingSession;
  isPaused: boolean;
  isDarkMode?: boolean;
  initialHistory?: string[];
  initialKeystrokes?: number;
  initialAccumulatedTime?: number;
  onStatsUpdate: (stats: Stats) => void;
  onComplete: (stats: Stats) => void;
  onPersist?: (history: string[], keystrokes: number, accumulatedTime: number) => void;
}

const TypingAreaV2: React.FC<Props> = ({ 
  session, isPaused, isDarkMode = false, initialHistory = [], initialKeystrokes = 0, initialAccumulatedTime = 0,
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
  const prevMistakeCount = useRef<number>(0);
  const lastStatsUpdateTime = useRef<number>(0);
  
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
      const data = { line, lineOffset: offset, length: line.length };
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
    
    // 성능을 위해 Map 대신 flat array 사용 고려 가능하나, 
    // 여기서는 렌더링 최적화를 위해 라인별로 데이터를 쪼개서 저장함
    const lineDataList: LineData[] = preCalculatedLines.map(l => ({
      userChars: new Array(l.length).fill(null),
      activated: new Array(l.length).fill(false)
    }));
    
    const mistakes = new Set<number>();

    const skipCurrentPunct = () => {
        while (targetIdx < content.length && PUNCT_SET.includes(content[targetIdx])) {
            const lineIdx = getLineIndex(targetIdx);
            if (lineIdx !== -1) {
              const localIdx = targetIdx - preCalculatedLines[lineIdx].lineOffset;
              lineDataList[lineIdx].activated[localIdx] = true;
            }
            targetIdx++;
        }
    };

    const getLineIndex = (idx: number) => {
      // 이진 탐색으로 최적화 가능하지만 라인 수가 아주 많지 않으면 findIndex도 충분
      return preCalculatedLines.findIndex(l => idx >= l.lineOffset && idx < l.lineOffset + l.length + 1);
    };

    const activateTrailingPunctInWord = (startFrom: number) => {
        let search = startFrom;
        while (search < content.length && content[search] !== ' ' && content[search] !== '\n') {
            if (PUNCT_SET.includes(content[search])) {
              const lIdx = getLineIndex(search);
              if (lIdx !== -1) {
                lineDataList[lIdx].activated[search - preCalculatedLines[lIdx].lineOffset] = true;
              }
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
      const isCurrentlyInputting = isLastIndex && (isMobile || isComposing);

      while (targetIdx < content.length && PUNCT_SET.includes(content[targetIdx])) {
          const lIdx = getLineIndex(targetIdx);
          if (lIdx !== -1) lineDataList[lIdx].activated[targetIdx - preCalculatedLines[lIdx].lineOffset] = true;
          targetIdx++;
      }

      if (!isCurrentlyInputting && (userChar === ' ' || userChar === '\n')) {
        let ahead = targetIdx;
        while (ahead < content.length && content[ahead] !== '\n' && (PUNCT_SET.includes(content[ahead]) || content[ahead] === ' ')) ahead++;
        
        if (ahead < content.length && content[ahead] === '\n') {
          while (targetIdx < ahead) {
            if (PUNCT_SET.includes(content[targetIdx])) {
              const lIdx = getLineIndex(targetIdx);
              if (lIdx !== -1) lineDataList[lIdx].activated[targetIdx - preCalculatedLines[lIdx].lineOffset] = true;
            }
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
                const lIdx = getLineIndex(targetIdx);
                if (lIdx !== -1) lineDataList[lIdx].userChars[targetIdx - preCalculatedLines[lIdx].lineOffset] = { char: userChar, isMistake: true };
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
        if (isCurrentlyInputting) {
          isMistake = isMobile ? false : !isCorrect;
        } else {
          isMistake = userChar !== targetChar;
        }
      } else {
        isMistake = !isCorrect;
      }

      const lIdx = getLineIndex(targetIdx);
      if (lIdx !== -1) {
        let displayChar = userChar;
        if (isEnglish) {
          const isTargetUpper = targetChar === targetChar.toUpperCase() && targetChar !== targetChar.toLowerCase();
          if (isTargetUpper && !isMistake) displayChar = targetChar;
        }
        
        lineDataList[lIdx].userChars[targetIdx - preCalculatedLines[lIdx].lineOffset] = { char: displayChar, isMistake };
        if (isMistake) mistakes.add(targetIdx);
        if (isCurrentlyInputting) composingTargetIdx = targetIdx;
      }

      if (!isMistake) {
        activateTrailingPunctInWord(targetIdx);
        const isComplete = isKorean ? isSufficientlyCompleted(userChar, targetChar) : true;
        const lastCommitted = isBodyChar(targetChar) ? isComplete : !isCurrentlyInputting;
        targetIdx++;
        if (lastCommitted) {
            skipCurrentPunct();
            if (content[targetIdx-1] === '\n') skipCurrentPunct();
        }
        if (isLastIndex) isLastCharComplete = lastCommitted;
      } else { 
        targetIdx++; 
        if (isLastIndex) isLastCharComplete = true;
      }
    }

    skipCurrentPunct();

    return { lineDataList, mistakes, composingTargetIdx, isLastCharComplete, targetIdxReached: targetIdx };
  }, [userInput, isComposing, content, isSufficientlyCompleted, isBodyChar, session.language, preCalculatedLines]);

  const { lineDataList, mistakes, composingTargetIdx, isLastCharComplete, targetIdxReached } = alignedState;

  // 현재 커서가 있는 라인 인덱스 찾기
  const currentLineIndex = useMemo(() => {
    const idx = preCalculatedLines.findIndex(l => targetIdxReached >= l.lineOffset && targetIdxReached < l.lineOffset + l.length + 1);
    return idx === -1 ? preCalculatedLines.length - 1 : idx;
  }, [targetIdxReached, preCalculatedLines]);

  // 오타 효과음
  useEffect(() => {
    if (isFinishedRef.current || isPaused) return;
    if (mistakes.size > prevMistakeCount.current) {
      if (!(isMobile && isComposing)) playErrorSound();
    }
    prevMistakeCount.current = mistakes.size;
  }, [mistakes.size, isComposing, isPaused]);

  const updateCursorPosition = useCallback(() => {
    const parentEl = layersRef.current;
    if (!parentEl) return;

    const idx = targetIdxReached;
    const isAtEnd = idx >= content.length;
    let measureIdx = idx;
    let useRight = false;

    if (!isAtEnd && content[idx] === '\n') {
      measureIdx = Math.max(0, idx - 1);
      useRight = true;
    } else if (isAtEnd) {
      measureIdx = content.length - 1;
      useRight = true;
    }

    let charEl = document.getElementById(`char-ghost-${measureIdx}`);
    if (!charEl && !isAtEnd) {
      let fallbackIdx = idx;
      while (fallbackIdx < content.length && !document.getElementById(`char-ghost-${fallbackIdx}`)) fallbackIdx++;
      charEl = document.getElementById(`char-ghost-${fallbackIdx}`);
      useRight = false;
    }

    if (charEl) {
      const rect = charEl.getBoundingClientRect();
      const parentRect = parentEl.getBoundingClientRect();
      const top = rect.top - parentRect.top;
      const left = useRight ? (rect.right - parentRect.left) : (rect.left - parentRect.left);
      
      setCursorPos({ top, left, height: rect.height });
      if (!isReady) requestAnimationFrame(() => setIsReady(true));
    }
  }, [targetIdxReached, content, isReady]);

  useLayoutEffect(updateCursorPosition, [updateCursorPosition]);
  useAutoScroll({ containerRef, targetTop: cursorPos.top, targetHeight: cursorPos.height, isPaused: isFinishedRef.current || isPaused });

  const calculateStats = useCallback((currentMistakesCount: number, forcedEndTime?: number) => {
    let elapsedMs = accumulatedTimeRef.current;
    if (startTimeRef.current !== null) elapsedMs += (forcedEndTime || Date.now()) - startTimeRef.current;
    const elapsedSeconds = elapsedMs / 1000;
    if (elapsedSeconds <= 0.2) return null;

    let speed = 0;
    if (session.language === Language.KOREAN) {
      let jamoCount = 0;
      // 전체 라인 데이터를 순회하여 정확한 자모수 계산 (무거운 연산이므로 스로틀링 필요)
      for (let i = 0; i < lineDataList.length; i++) {
        const uChars = lineDataList[i].userChars;
        for (let j = 0; j < uChars.length; j++) {
          const ud = uChars[j];
          if (ud && !ud.isMistake) {
            jamoCount += (ud.char === ' ' ? 1 : getCachedDecomposition(ud.char).length);
          }
        }
      }
      speed = (jamoCount / elapsedSeconds) * 60;
    } else {
      let correctLength = 0;
      for (let i = 0; i < lineDataList.length; i++) {
        const uChars = lineDataList[i].userChars;
        for (let j = 0; j < uChars.length; j++) {
          const ud = uChars[j];
          if (ud && !ud.isMistake) correctLength++;
        }
      }
      speed = (correctLength / 5) / (elapsedSeconds / 60);
    }
    
    let addressedChars = 0;
    for (let i = 0; i < targetIdxReached; i++) if (content[i] !== '\n') addressedChars++;
    const finalTypedCount = Math.min(addressedChars, totalCount);
    // 정확도 계산 시userInput의 실제 길이를 사용하지 않고 targetIdxReached 기준 오차율 계산
    const accuracy = targetIdxReached === 0 ? 100 : Math.max(0, 100 - (currentMistakesCount / targetIdxReached) * 100);
    
    return { speed: Math.min(speed, 2500), accuracy, typedCount: finalTypedCount, totalCount, elapsedTime: elapsedSeconds };
  }, [session.language, totalCount, lineDataList, content, targetIdxReached]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (isFinishedRef.current || isPaused || isJumpingRef.current) return;
    const value = e.target.value;
    setUserInput(value);

    if (isMobile && !isComposing) {
      const lastChar = value[value.length - 1];
      if (lastChar === ' ') playTypingSound(' ');
      else if (lastChar === '\n') playTypingSound('Enter');
      else if (value.length < userInput.length) playTypingSound('Backspace');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isFinishedRef.current || isPaused) return;
    if (startTimeRef.current === null) startTimeRef.current = Date.now();
    
    if (isMobile) {
      if (e.key === 'Enter') {
        const ahead = targetIdxReached;
        if (content[ahead] !== '\n' && content[ahead-1] !== '\n') e.preventDefault();
      }
      return;
    }

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

  const handleCompositionStart = () => setIsComposing(true);
  const handleCompositionEnd = () => {
    setIsComposing(false);
    if (isMobile) {
      playTypingSound('KeyA');
      setKeystrokes(prev => prev + 1);
    }
  };

  useEffect(() => {
    if (isFinishedRef.current) return;
    const isActuallyFinished = targetIdxReached >= content.length && isLastCharComplete && userInput.length > 0;

    if (isActuallyFinished) {
      isFinishedRef.current = true;
      playCompletionSound();
      const finalStats = calculateStats(mistakes.size, Date.now());
      if (finalStats) setTimeout(() => onComplete(finalStats), 200);
      return;
    }

    // 모바일 성능 최적화: 통계 업데이트 주기 제한 (스로틀링)
    const now = Date.now();
    if (!isMobile || !isComposing || (now - lastStatsUpdateTime.current > 250)) {
        const currentStats = calculateStats(mistakes.size);
        if (currentStats) {
          onStatsUpdate(currentStats);
          lastStatsUpdateTime.current = now;
        }
    }
  }, [targetIdxReached, isLastCharComplete, isComposing, calculateStats, onStatsUpdate, onComplete, content.length, userInput, mistakes.size]);

  // Windowing: 현재 줄 기준 위로 15줄, 아래로 25줄만 렌더링
  const renderRange = useMemo(() => {
    const start = Math.max(0, currentLineIndex - 15);
    const end = Math.min(preCalculatedLines.length, currentLineIndex + 25);
    return { start, end };
  }, [currentLineIndex, preCalculatedLines.length]);

  return (
    <div className="h-full min-h-0 flex flex-col relative" onClick={() => !isPaused && hiddenInputRef.current?.focus()}>
      {isPaused && (
        <div className={`absolute inset-0 z-30 ${isDarkMode ? 'bg-black/40' : 'bg-white/40'} backdrop-blur-[1px] flex items-center justify-center transition-all duration-300`}>
          <div className={`${isDarkMode ? 'bg-white/10 text-white' : 'bg-black/5 text-black'} px-6 py-3 rounded-full font-bold text-sm tracking-widest uppercase`}>Click Resume to Continue</div>
        </div>
      )}
      <div ref={containerRef} className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-4">
        <div className="relative min-h-full pb-[70vh]">
          <div ref={layersRef} className="relative w-full text-[25px] leading-[40px] tracking-[-0.02em] whitespace-pre-wrap break-keep text-left select-none outline-none font-light">
            {/* Cursor */}
            <div 
              className={`absolute w-[2px] ${isDarkMode ? 'bg-white/60' : 'bg-black/60'} z-20 
                ${isReady ? 'transition-[left,top] duration-[250ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] opacity-100' : 'opacity-0'}`} 
              style={{ 
                top: `${cursorPos.top}px`, 
                left: `${cursorPos.left}px`, 
                height: `${cursorPos.height || 40}px`, 
                visibility: (isFinishedRef.current || !isReady || isPaused) ? 'hidden' : 'visible' 
              }} 
            />
            
            {/* Spacers & Lines (Windowing) */}
            {preCalculatedLines.slice(0, renderRange.start).map((_, i) => <div key={`spacer-up-${i}`} style={{ height: '40px' }} />)}
            
            {preCalculatedLines.slice(renderRange.start, renderRange.end).map((lineData, i) => {
              const actualIdx = renderRange.start + i;
              const composingLocalIdx = (composingTargetIdx >= lineData.lineOffset && composingTargetIdx < lineData.lineOffset + lineData.length)
                ? composingTargetIdx - lineData.lineOffset 
                : -1;

              return (
                <MemoizedLine 
                  key={actualIdx}
                  line={lineData.line}
                  lineOffset={lineData.lineOffset}
                  userData={lineDataList[actualIdx]}
                  composingLocalIdx={composingLocalIdx}
                  isComposing={isComposing}
                  isDarkMode={isDarkMode}
                />
              );
            })}

            {preCalculatedLines.slice(renderRange.end).map((_, i) => <div key={`spacer-down-${i}`} style={{ height: '40px' }} />)}
          </div>
        </div>
      </div>
      <textarea 
        ref={hiddenInputRef} 
        className="fixed opacity-0 pointer-events-none" 
        value={userInput} 
        onChange={handleInput} 
        onKeyDown={handleKeyDown} 
        onCompositionStart={handleCompositionStart} 
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
