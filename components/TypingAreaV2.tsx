
import React, { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from 'react';
import { TypingSession, PUNCT_SET, Stats, Language } from '../types';
import { isJamoPrefix, decomposeHangul } from '../services/hangulUtils';
import { useAutoScroll } from '../hooks/useAutoScroll';
import { playTypingSound, playErrorSound, playCompletionSound } from '../services/soundService';

const jamoCache = new Map<string, string[]>();
const getCachedDecomposition = (char: string) => {
  if (!char) return [];
  let res = jamoCache.get(char);
  if (res) return res;
  res = decomposeHangul(char);
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
  activated: boolean[];
}

const MemoizedLine = React.memo(({ 
  line, 
  lineOffset, 
  userData, 
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
      <div className="absolute top-0 left-0 w-full pointer-events-none">
        {chars.map((char, cIdx) => {
          const isBeingComposed = cIdx === composingLocalIdx && isComposing;
          const isActivated = userData.activated[cIdx];
          const hasUserInput = !!userData.userChars[cIdx];
          
          let color = isDarkMode ? '#444444' : '#E5E7EB'; 
          if (isBeingComposed || hasUserInput) {
            color = 'transparent';
          } else if (isActivated) {
            color = isDarkMode ? '#bbbbbb' : '#333333';
          }
          
          return <span id={`char-ghost-${lineOffset + cIdx}`} key={cIdx} style={{ color }}>{char}</span>;
        })}
        {/* Anchor for cursor at the end of the line or newline char */}
        <span id={`char-ghost-${lineOffset + chars.length}`} className="inline-block w-0 h-10 invisible align-top" />
      </div>
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

  const { preCalculatedLines, charToLineMap } = useMemo(() => {
    const lines = content.split('\n');
    const result: { line: string; lineOffset: number; length: number }[] = [];
    const charMap: number[] = new Array(content.length);
    let offset = 0;
    
    lines.forEach((line, idx) => {
      result.push({ line, lineOffset: offset, length: line.length });
      for (let i = 0; i <= line.length; i++) {
        if (offset + i < content.length) charMap[offset + i] = idx;
      }
      offset += line.length + 1;
    });
    return { preCalculatedLines: result, charToLineMap: charMap };
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

  const alignment = useMemo(() => {
    let targetIdx = 0;
    let isLastCharComplete = false;
    let composingTargetIdx = -1;
    const mistakes = new Set<number>();
    const activatedIndices = new Set<number>();
    const userCharMapping = new Map<number, UserCharData>();

    const skipPunct = () => {
      while (targetIdx < content.length && PUNCT_SET.includes(content[targetIdx])) {
        activatedIndices.add(targetIdx);
        targetIdx++;
      }
    };

    const activateWordPunct = (start: number) => {
      let s = start;
      while (s < content.length && content[s] !== ' ' && content[s] !== '\n') {
        if (PUNCT_SET.includes(content[s])) activatedIndices.add(s);
        s++;
      }
    };

    skipPunct();
    const isKO = session.language === Language.KOREAN;
    const inputLen = userInput.length;

    for (let i = 0; i < inputLen; i++) {
      const u = userInput[i];
      const isLast = i === inputLen - 1;
      const isActuallyComposing = isLast && isComposing;
      // Triggers for line/paragraph jumps
      const isTrigger = u === ' ' || u === '\n';

      skipPunct();

      // NEW: Improved jumping logic to consume all sequential newlines immediately on trigger
      if (isTrigger && (!isActuallyComposing || isMobile)) {
        let ahead = targetIdx;
        // Check if we are at or near a line break
        while (ahead < content.length && content[ahead] !== '\n' && (PUNCT_SET.includes(content[ahead]) || content[ahead] === ' ')) ahead++;
        
        if (ahead < content.length && content[ahead] === '\n') {
          // If we hit a newline, jump over it and all subsequent newlines
          while (targetIdx < ahead) {
            if (PUNCT_SET.includes(content[targetIdx])) activatedIndices.add(targetIdx);
            targetIdx++;
          }
          while (targetIdx < content.length && content[targetIdx] === '\n') targetIdx++;
          skipPunct();
          if (isLast) isLastCharComplete = true;
          continue;
        } else if (content[targetIdx] === ' ' || content[targetIdx] === '\n') {
          // Normal word space
          targetIdx++;
          while (targetIdx < content.length && content[targetIdx] === '\n') targetIdx++;
          skipPunct();
          if (isLast) isLastCharComplete = true;
          continue;
        } else {
          // Mismatched space - mark mistake and advance
          mistakes.add(targetIdx);
          userCharMapping.set(targetIdx, { char: u, isMistake: true });
          targetIdx++;
          if (isLast) isLastCharComplete = true;
          continue;
        }
      }

      const t = content[targetIdx];
      if (!t) { targetIdx++; continue; }

      let isCorrect = false;
      if (isKO) isCorrect = isJamoPrefix(u, t, content[targetIdx + 1]);
      else isCorrect = (u.toLowerCase() === t.toLowerCase());

      const isM = isKO ? (isActuallyComposing ? (isMobile ? false : !isCorrect) : u !== t) : !isCorrect;
      if (isM) mistakes.add(targetIdx);
      if (isActuallyComposing) composingTargetIdx = targetIdx;

      let display = u;
      if (!isKO && !isM && t === t.toUpperCase() && t !== t.toLowerCase()) display = t;
      userCharMapping.set(targetIdx, { char: display, isMistake: isM });

      if (!isM) {
        activateWordPunct(targetIdx);
        const complete = isKO ? isSufficientlyCompleted(u, t) : true;
        const committed = isBodyChar(t) ? complete : !isActuallyComposing;
        targetIdx++;
        if (committed) {
          skipPunct();
          if (content[targetIdx-1] === '\n') skipPunct();
        }
        if (isLast) isLastCharComplete = committed;
      } else {
        targetIdx++;
        if (isLast) isLastCharComplete = true;
      }
    }
    skipPunct();

    return { mistakes, composingTargetIdx, isLastCharComplete, targetIdxReached: targetIdx, activatedIndices, userCharMapping };
  }, [userInput, isComposing, content, isSufficientlyCompleted, isBodyChar, session.language]);

  const { mistakes, composingTargetIdx, isLastCharComplete, targetIdxReached, activatedIndices, userCharMapping } = alignment;

  const currentLineIndex = useMemo(() => {
    const idx = charToLineMap[targetIdxReached];
    return idx === undefined ? preCalculatedLines.length - 1 : idx;
  }, [targetIdxReached, charToLineMap, preCalculatedLines.length]);

  const renderRange = useMemo(() => {
    const start = Math.max(0, currentLineIndex - (isMobile ? 10 : 100));
    const end = Math.min(preCalculatedLines.length, currentLineIndex + (isMobile ? 20 : 60));
    return { start, end };
  }, [currentLineIndex, preCalculatedLines.length]);

  const windowedLineDataList = useMemo(() => {
    const list: Record<number, LineData> = {};
    for (let l = renderRange.start; l < renderRange.end; l++) {
      const line = preCalculatedLines[l];
      const data: LineData = {
        userChars: new Array(line.length).fill(null),
        activated: new Array(line.length).fill(false)
      };
      for (let i = 0; i < line.length; i++) {
        const absIdx = line.lineOffset + i;
        const uChar = userCharMapping.get(absIdx);
        if (uChar) data.userChars[i] = uChar;
        if (activatedIndices.has(absIdx)) data.activated[i] = true;
      }
      list[l] = data;
    }
    return list;
  }, [renderRange, preCalculatedLines, userCharMapping, activatedIndices]);

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
    
    // Find ghost element - ensure we use the anchor for empty lines/newlines correctly
    const charEl = document.getElementById(`char-ghost-${idx}`);
    if (charEl) {
      const rect = charEl.getBoundingClientRect();
      const parentRect = parentEl.getBoundingClientRect();
      const top = rect.top - parentRect.top;
      const left = rect.left - parentRect.left;
      
      setCursorPos({ top, left, height: rect.height || 40 });
      if (!isReady) requestAnimationFrame(() => setIsReady(true));
    }
  }, [targetIdxReached, isReady]);

  useLayoutEffect(updateCursorPosition, [updateCursorPosition]);
  
  useAutoScroll({ 
    containerRef, 
    targetTop: cursorPos.top, 
    targetHeight: cursorPos.height, 
    currentLineIndex, 
    isPaused: isFinishedRef.current || isPaused 
  });

  const getKoreanStrokeCount = useCallback((text: string) => {
    let count = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === ' ' || char === '\n') {
        count += 1;
      } else {
        count += getCachedDecomposition(char).length;
      }
    }
    return count;
  }, []);

  const calculateStats = useCallback((curMistakes: number, forcedEnd?: number) => {
    let elapsed = accumulatedTimeRef.current;
    if (startTimeRef.current !== null) {
      elapsed += (forcedEnd || Date.now()) - startTimeRef.current;
    }
    const seconds = elapsed / 1000;
    if (seconds <= 0.2) return null;

    let speed = 0;
    if (session.language === Language.KOREAN) {
      const totalStrokes = getKoreanStrokeCount(userInput);
      speed = (totalStrokes / seconds) * 60;
    } else {
      speed = (userInput.length / 5) / (seconds / 60);
    }
    
    const typed = Math.min(targetIdxReached, totalCount);
    const accuracy = targetIdxReached === 0 ? 100 : Math.max(0, 100 - (curMistakes / targetIdxReached) * 100);
    return { speed: Math.min(speed, 2500), accuracy, typedCount: typed, totalCount, elapsedTime: seconds };
  }, [session.language, totalCount, userInput, targetIdxReached, getKoreanStrokeCount]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (isFinishedRef.current || isPaused || isJumpingRef.current) return;
    if (startTimeRef.current === null) startTimeRef.current = Date.now();
    const newVal = e.target.value;
    setUserInput(newVal);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isFinishedRef.current || isPaused) return;
    if (startTimeRef.current === null) startTimeRef.current = Date.now();
    if (isMobile) {
      if (e.key === 'Enter') {
        const ahead = targetIdxReached;
        if (content[ahead] !== '\n' && (ahead > 0 && content[ahead-1] !== '\n')) e.preventDefault();
      }
      return; 
    }
    if (e.key === ' ' || e.key === 'Enter') {
      let ahead = targetIdxReached; 
      while (ahead < content.length && content[ahead] !== '\n' && (PUNCT_SET.includes(content[ahead]) || content[ahead] === ' ')) ahead++;
      if (ahead < content.length && content[ahead] === '\n') {
        playTypingSound('Enter'); e.preventDefault(); isJumpingRef.current = true;
        const nv = userInput + '\n';
        if (hiddenInputRef.current) hiddenInputRef.current.value = nv;
        setUserInput(nv); setKeystrokes(prev => prev + 1);
        setTimeout(() => { isJumpingRef.current = false; }, 10); return;
      }
      if (e.key === 'Enter') { playTypingSound('Enter'); e.preventDefault(); return; }
      if (e.key === ' ') playTypingSound(' ');
    } else {
      if (e.key === 'Backspace' || e.key === 'Delete') playTypingSound('Backspace');
      else if (e.key.length === 1) playTypingSound(e.key);
    }
    if (!e.nativeEvent.isComposing && !['Control', 'Alt', 'Shift', 'Meta', 'CapsLock', 'Tab', ' ', 'Enter'].includes(e.key)) {
      setKeystrokes(prev => prev + 1);
    }
  };

  const handleCompStart = () => setIsComposing(true);
  const handleCompEnd = () => setIsComposing(false);

  useEffect(() => {
    if (isFinishedRef.current) return;
    const finished = targetIdxReached >= content.length && isLastCharComplete && userInput.length > 0;
    if (finished) {
      isFinishedRef.current = true;
      playCompletionSound();
      const st = calculateStats(mistakes.size, Date.now());
      if (st) setTimeout(() => onComplete(st), 200);
      return;
    }
    const now = Date.now();
    const throttleTime = isMobile ? 250 : 200;
    if (now - lastStatsUpdateTime.current > throttleTime) {
      const st = calculateStats(mistakes.size);
      if (st) {
        onStatsUpdate(st);
        lastStatsUpdateTime.current = now;
      }
    }
  }, [targetIdxReached, isLastCharComplete, userInput, mistakes.size, calculateStats, onStatsUpdate, onComplete, content.length]);

  return (
    <div className="h-full min-h-0 flex flex-col relative" onClick={() => !isPaused && hiddenInputRef.current?.focus()}>
      {isPaused && (
        <div className={`absolute inset-0 z-30 ${isDarkMode ? 'bg-black/40' : 'bg-white/40'} backdrop-blur-[1px] flex items-center justify-center transition-all duration-300`}>
          <div className={`${isDarkMode ? 'bg-white/10 text-white' : 'bg-black/5 text-black'} px-6 py-3 rounded-full font-bold text-sm tracking-widest uppercase`}>Click Resume to Continue</div>
        </div>
      )}
      <div ref={containerRef} className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-4">
        <div className="relative min-h-full pb-[80vh]">
          <div ref={layersRef} className="relative w-full text-[25px] leading-[40px] tracking-[-0.02em] whitespace-pre-wrap break-keep text-left select-none outline-none font-light">
            <div 
              className={`absolute w-[2px] ${isDarkMode ? 'bg-white/60' : 'bg-black/60'} z-20 
                ${isReady ? 'transition-[left,top] duration-[220ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] opacity-100' : 'opacity-0'}`} 
              style={{ top: `${cursorPos.top}px`, left: `${cursorPos.left}px`, height: `${cursorPos.height || 40}px`, visibility: (isFinishedRef.current || !isReady || isPaused) ? 'hidden' : 'visible' }} 
            />
            {preCalculatedLines.slice(0, renderRange.start).map((_, i) => <div key={`s-up-${i}`} style={{ height: '40px' }} />)}
            {preCalculatedLines.slice(renderRange.start, renderRange.end).map((l, i) => {
              const ai = renderRange.start + i;
              const cl = (composingTargetIdx >= l.lineOffset && composingTargetIdx < l.lineOffset + l.length) ? composingTargetIdx - l.lineOffset : -1;
              return <MemoizedLine key={ai} line={l.line} lineOffset={l.lineOffset} userData={windowedLineDataList[ai]} composingLocalIdx={cl} isComposing={isComposing} isDarkMode={isDarkMode} />;
            })}
            {preCalculatedLines.slice(renderRange.end).map((_, i) => <div key={`s-down-${i}`} style={{ height: '40px' }} />)}
          </div>
        </div>
      </div>
      <textarea ref={hiddenInputRef} className="fixed opacity-0 pointer-events-none" value={userInput} onChange={handleInput} onKeyDown={handleKeyDown} onCompositionStart={handleCompStart} onCompositionEnd={handleCompEnd} onBlur={() => setIsComposing(false)} disabled={isPaused} autoFocus spellCheck={false} autoComplete="off" />
    </div>
  );
};

export default TypingAreaV2;
