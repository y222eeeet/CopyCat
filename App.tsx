
import React, { useState, useCallback, useRef, useEffect } from 'react';
import TypingAreaV2 from './components/TypingAreaV2';
import StatsBar from './components/StatsBar';
import CompletionPopup from './components/CompletionPopup';
import { TypingSession, Stats, Language, Settings, SavedSession } from './types';
import { detectLanguage } from './services/hangulUtils';

declare const mammoth: any;

const STORAGE_KEY = 'typing_works_session_v2';
const SETTINGS_KEY = 'typing_works_settings';
const THEME_KEY = 'typing_works_theme';
const SHUFFLE_KEY_EN = 'typing_works_shuffle_pool_en_v2';
const SHUFFLE_KEY_KO = 'typing_works_shuffle_pool_ko_v2';

const DEFAULT_SESSIONS_EN: TypingSession[] = [
  {
    filename: 'Stay Hungry, Stay Foolish',
    content: "The only way to do great work is to love what you do. If you haven't found it yet, keep looking. Don't settle. As with all matters of the heart, you'll know when you find it.",
    language: Language.ENGLISH
  },
  {
    filename: 'The Sandlot (1993)',
    content: "Run around, scrape your knees, get dirty.\nClimb trees, hop fences.\nGet into trouble, for crying out loud.\nNot too much, but some.",
    language: Language.ENGLISH
  },
  {
    filename: 'Rocky Balboa (2006)',
    content: "It’s not about how hard you hit.\nIt’s about how hard you can get hit\nand keep moving forward.",
    language: Language.ENGLISH
  },
  {
    filename: 'The Great Gatsby',
    content: "In my younger and more vulnerable years my father gave me some advice that I've been turning over in my mind ever since. \"Whenever you feel like criticizing anyone,\" he told me, \"just remember that all the people in this world haven't had the advantages that you've had.\"",
    language: Language.ENGLISH
  }
];

const DEFAULT_SESSIONS_KO: TypingSession[] = [
  {
    filename: '지지 않는 꽃 - 나태주',
    content: "하루나 이틀 꽃은\n피었다 지지만\n\n마음속 숨긴 꽃은\n좀 더 오래간다\n\n글이 된 꽃은\n더 오래 지지 않는다",
    language: Language.KOREAN
  },
  {
    filename: '서시 - 윤동주',
    content: "죽는 날까지 하늘을 우러러\n한 점 부끄럼이 없기를,\n잎새에 이는 바람에도\n나는 괴로워했다.\n별을 노래하는 마음으로\n모든 죽어가는 것을 사랑해야지\n그리고 나한테 주어진 길을\n걸어가야겠다.",
    language: Language.KOREAN
  },
  {
    filename: '어린 왕자 중에서',
    content: "세상에서 가장 어려운 일은 사람의 마음을 얻는 일이란다.\n각각의 얼굴만큼 각양각색의 마음이 있고,\n바람처럼 순식간에 변해버리는 것이 사람의 마음이기 때문이지.",
    language: Language.KOREAN
  },
  {
    filename: '삶이 그대를 속일지라도 - 푸시킨',
    content: "삶이 그대를 속일지라도\n슬퍼하거나 노여워하지 말라\n우울한 날들을 견디면\n믿으라, 기쁨의 날이 오리니.",
    language: Language.KOREAN
  }
];

const getNextSessionFromPool = (lang: Language, currentContent?: string): TypingSession => {
  const isKO = lang === Language.KOREAN;
  const poolKey = isKO ? SHUFFLE_KEY_KO : SHUFFLE_KEY_EN;
  const sessions = isKO ? DEFAULT_SESSIONS_KO : DEFAULT_SESSIONS_EN;
  
  let pool: number[] = [];
  const savedPool = localStorage.getItem(poolKey);
  
  if (savedPool) {
    try {
      pool = JSON.parse(savedPool);
    } catch (e) {
      pool = [];
    }
  }

  if (pool.length === 0) {
    pool = Array.from({ length: sessions.length }, (_, i) => i);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
  }

  let nextIndex = pool.pop() ?? 0;
  
  if (sessions[nextIndex]?.content === currentContent && pool.length > 0) {
    const backupIndex = nextIndex;
    nextIndex = pool.pop() ?? 0;
    pool.push(backupIndex); 
  }

  localStorage.setItem(poolKey, JSON.stringify(pool));
  return sessions[nextIndex] || sessions[0];
};

const App: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      return saved ? JSON.parse(saved) : { rememberProgress: true };
    } catch {
      return { rememberProgress: true };
    }
  });

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      return saved === 'dark';
    } catch {
      return false;
    }
  });

  const [showSettings, setShowSettings] = useState(false);

  const [session, setSession] = useState<TypingSession>(() => {
    try {
      const saved = settings.rememberProgress ? localStorage.getItem(STORAGE_KEY) : null;
      if (saved) {
        const parsed: SavedSession = JSON.parse(saved);
        return parsed.session;
      }
    } catch (e) {}
    return getNextSessionFromPool(Language.KOREAN);
  });

  const [initialData, setInitialData] = useState<{history: string[], keystrokes: number, time: number}>(() => {
    try {
      const saved = settings.rememberProgress ? localStorage.getItem(STORAGE_KEY) : null;
      if (saved) {
        const parsed: SavedSession = JSON.parse(saved);
        return { history: parsed.userInputHistory, keystrokes: parsed.keystrokes, time: parsed.accumulatedTime };
      }
    } catch {}
    return { history: [], keystrokes: 0, time: 0 };
  });
  
  const [stats, setStats] = useState<Stats>({
    speed: 0,
    accuracy: 100,
    typedCount: 0,
    totalCount: session.content.replace(/\n/g, '').length,
    elapsedTime: 0
  });
  
  const [isComplete, setIsComplete] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(THEME_KEY, isDarkMode ? 'dark' : 'light');
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const saveSessionState = useCallback((history: string[], ks: number, accTime: number) => {
    if (!settings.rememberProgress) return;
    const data: SavedSession = {
      session,
      userInputHistory: history,
      keystrokes: ks,
      accumulatedTime: accTime,
      lastUpdated: Date.now()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [session, settings.rememberProgress]);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleToggleLanguage = () => {
    const nextLang = session.language === Language.ENGLISH ? Language.KOREAN : Language.ENGLISH;
    const nextSession = getNextSessionFromPool(nextLang);
    handleResetForNewSession(nextSession);
  };

  const toggleDarkMode = () => setIsDarkMode(prev => !prev);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const originalFilename = file.name;
    let content = '';
    
    try {
      const mammothLib = (window as any).mammoth;
      if (originalFilename.toLowerCase().endsWith('.docx')) {
        if (!mammothLib) {
          alert("문서 변환 라이브러리를 로드 중입니다.");
          return;
        }
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammothLib.extractRawText({ arrayBuffer });
        content = result.value || '';
      } else {
        content = await file.text();
      }
      
      if (!content.trim()) {
        alert("파일 내용이 비어있습니다.");
        return;
      }

      const normalizedContent = content
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .split('\n')
        .map(line => line.trim())
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      const displayFilename = originalFilename.includes('.') 
        ? originalFilename.split('.').slice(0, -1).join('.') 
        : originalFilename;

      const newSession: TypingSession = {
        filename: displayFilename || "Untitled",
        content: normalizedContent,
        language: detectLanguage(normalizedContent) as Language,
      };

      handleResetForNewSession(newSession);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      alert("파일 로드 중 오류 발생.");
    }
  };

  const handleResetForNewSession = (newSession: TypingSession) => {
    setSession(newSession);
    setInitialData({ history: [], keystrokes: 0, time: 0 });
    setStats({
      speed: 0,
      accuracy: 100,
      typedCount: 0,
      totalCount: newSession.content.replace(/\n/g, '').length,
      elapsedTime: 0
    });
    setIsComplete(false);
    setIsPaused(false);
    setResetKey(prev => prev + 1);
    localStorage.removeItem(STORAGE_KEY);
  };

  const handleReset = useCallback(() => {
    handleResetForNewSession(session);
  }, [session]);

  const handleNextSentence = useCallback(() => {
    const nextSession = getNextSessionFromPool(session.language, session.content);
    handleResetForNewSession(nextSession);
  }, [session.language, session.content]);

  const handleClosePopup = useCallback(() => {
    setIsComplete(false);
  }, []);

  const handleStatsUpdate = (newStats: Stats) => {
    if (!isComplete && !isPaused) setStats(newStats);
  };

  const handleComplete = (finalStats: Stats) => {
    setStats(finalStats);
    setIsComplete(true);
    localStorage.removeItem(STORAGE_KEY);
  };

  const togglePause = () => setIsPaused(prev => !prev);

  return (
    <div className={`flex flex-col h-screen transition-colors duration-300 overflow-hidden ${isDarkMode ? 'bg-[#121212] text-[#e0e0e0]' : 'bg-white text-[#333]'}`}>
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".txt,.docx" />

      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm px-4">
          <div className={`${isDarkMode ? 'bg-[#1e1e1e] border-gray-800' : 'bg-white border-gray-100'} rounded-2xl w-full max-sm p-6 shadow-xl border`}>
            <h3 className={`text-xs font-bold uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-gray-400'} mb-6`}>Settings</h3>
            <div className="flex items-center justify-between mb-8">
              <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Remember progress</span>
              <button onClick={() => setSettings(s => ({ ...s, rememberProgress: !s.rememberProgress }))} className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${settings.rememberProgress ? (isDarkMode ? 'bg-gray-600' : 'bg-black') : 'bg-gray-200'}`}>
                <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${settings.rememberProgress ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            <button onClick={() => setShowSettings(false)} className={`w-full py-3 rounded-xl font-bold transition-colors ${isDarkMode ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Close</button>
          </div>
        </div>
      )}

      <main className="flex-1 min-h-0 flex flex-col max-w-6xl mx-auto w-full px-6 pt-6">
        <div className="flex flex-col gap-6 mb-4">
          <div className="flex justify-end items-center gap-4">
            <button onClick={handleUploadClick} className={`text-[11px] font-bold uppercase tracking-widest transition-colors ${isDarkMode ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-black'}`}>Upload</button>
            <button onClick={handleReset} className={`text-[11px] font-bold uppercase tracking-widest transition-colors ${isDarkMode ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-black'}`}>Reset</button>
            <div className={`h-3 w-[1px] ${isDarkMode ? 'bg-gray-800' : 'bg-gray-200'}`}></div>
            <button onClick={() => setShowSettings(true)} className={`transition-colors ${isDarkMode ? 'text-gray-600 hover:text-gray-400' : 'text-gray-300 hover:text-gray-500'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            <button onClick={handleToggleLanguage} className={`transition-colors ${isDarkMode ? 'text-gray-600 hover:text-gray-400' : 'text-gray-400 hover:text-black'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
            </button>
            <button onClick={toggleDarkMode} className={`transition-colors ${isDarkMode ? 'text-gray-600 hover:text-yellow-400' : 'text-gray-400 hover:text-black'}`}>
              {isDarkMode ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              )}
            </button>
          </div>
          <div className="flex justify-between items-center">
            <h1 className={`text-[30px] font-normal tracking-tight truncate mr-4 transition-colors ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>{session.filename}</h1>
            <button onClick={togglePause} className={`flex items-center gap-2 px-3 py-1 rounded-full transition-all text-[11px] font-bold uppercase tracking-widest ${isPaused ? (isDarkMode ? 'bg-gray-200 text-black' : 'bg-black text-white') : (isDarkMode ? 'bg-gray-800 text-gray-500 hover:text-gray-300' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-black')}`}>
              {isPaused ? "Resume" : "Pause"}
            </button>
          </div>
        </div>
        <StatsBar stats={stats} language={session.language} isPaused={isPaused} />
        <div className="mt-8 flex-1 min-h-0 overflow-hidden">
          <TypingAreaV2 
            key={`${resetKey}-${session.filename}`}
            session={session} 
            isPaused={isPaused}
            isDarkMode={isDarkMode}
            initialHistory={initialData.history}
            initialKeystrokes={initialData.keystrokes}
            initialAccumulatedTime={initialData.time}
            onStatsUpdate={handleStatsUpdate}
            onComplete={handleComplete}
            onPersist={saveSessionState}
          />
        </div>
      </main>
      {isComplete && <CompletionPopup stats={stats} language={session.language} onNext={handleNextSentence} onClose={handleClosePopup} />}
    </div>
  );
};

export default App;
