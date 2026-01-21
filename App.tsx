
import React, { useState, useCallback, useRef, useEffect } from 'react';
import TypingAreaV2 from './components/TypingAreaV2';
import StatsBar from './components/StatsBar';
import CompletionPopup from './components/CompletionPopup';
import { TypingSession, Stats, Language, Settings, SavedSession } from './types';
import { detectLanguage } from './services/hangulUtils';

declare const mammoth: any;

const STORAGE_KEY = 'typing_works_session_v3';
const SETTINGS_KEY = 'typing_works_settings';
const THEME_KEY = 'typing_works_theme';
const SHUFFLE_KEY_EN = 'typing_works_shuffle_pool_en_v3';
const SHUFFLE_KEY_KO = 'typing_works_shuffle_pool_ko_v3';

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
  },
  {
    filename: 'To Kill a Mockingbird - Harper Lee',
    content: "You never really understand a person until you consider things from his point of view... until you climb into his skin and walk around in it.",
    language: Language.ENGLISH
  },
  {
    filename: 'The Alchemist - Paulo Coelho',
    content: "It's the possibility of having a dream come true that makes life interesting.",
    language: Language.ENGLISH
  },
  {
    filename: 'Walden - Henry David Thoreau',
    content: "I went to the woods because I wished to live deliberately, to front only the essential facts of life, and see if I could not learn what it had to teach, and not, when I came to die, discover that I had not lived.",
    language: Language.ENGLISH
  },
  {
    filename: 'Invictus - William Ernest Henley',
    content: "Out of the night that covers me,\nBlack as the pit from pole to pole,\nI thank whatever gods may be\nFor my unconquerable soul.",
    language: Language.ENGLISH
  },
  {
    filename: 'Commencement Address - Steve Jobs',
    content: "You can't connect the dots looking forward; you can only connect them looking backward. So you have to trust that the dots will somehow connect in your future.",
    language: Language.ENGLISH
  },
  {
    filename: 'Letters to a Young Poet - Rilke',
    content: "Be patient toward all that is unsolved in your heart and try to love the questions themselves, like locked rooms and like books that are now written in a very foreign tongue.",
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
    filename: '손톱깎이 - 왕구슬',
    content: "누군가 내게\n“당신은 그를 얼마나 사랑하나요”\n하고 묻는다면\n나는 외면하며\n“손톱만큼요”라고 할 것이다\n\n하지만 돌아서서는\n잘라내도 잘라내도\n평생 자라나고야 마는\n내 손톱을 보고\n마음이 저려\n펑펑 울지도 모른다",
    language: Language.KOREAN
  },
  {
    filename: '반쪼라기 자작 - 이탈로 칼비노',
    content: "반면에 나는 완전히 열정의 한가운데 있으면서도 항상 부족함과 슬픔을 느꼈다. 때때로 한 인간은 자기 자신을 불완전하다고 생각하는데 그것은 그가 젊기 때문이다",
    language: Language.KOREAN
  },
  {
    filename: '사막 - 오르텅스 블루',
    content: "그 사막에서 그는\n너무도 외로워\n때로는 뒷걸음질로 걸었다\n자기 앞에 찍힌 발자국을 보려고",
    language: Language.KOREAN
  },
  {
    filename: '이런 시 - 이상',
    content: "역사를 하노라고 땅을 파다가\n커다란 돌을 하나 끄집어 내어놓고 보니\n도무지 어디서 인가 본 듯한 생각이 들게 모양이 생겼는데\n목도들이 그것을 메고 나가더니\n어디다 갖다 버리고 온 모양이길래 쫓아나가 보니\n위험하기 짝이 없는 큰길가더라.\n\n그날 밤에 한 소나기 하였으니\n필시 그 돌이 깨끗이 씻겼을 터인데\n그 이튿날 가보니까 변괴로다 간데온데 없더라.\n어떤 돌이 와서 그 돌을 업어갔을까\n나는 참 이런 처량한 생각에서 아래와 같은 작문을 지었도다\n\n“내가 그다지 사랑하던 그대여\n내 한평생에 차마 그대를 잊을 수 없소이다\n내 차례에 못 올 사랑인 줄은 알면서도\n나 혼자는 꾸준히 생각하리라\n자, 그러면 내내 어여쁘소서.”\n\n어떤 돌이 내 얼굴을 물끄러미 치어다보는 것만 같아서\n이런 시는 그만 찢어 버리고 싶더라",
    language: Language.KOREAN
  },
  {
    filename: '이상, 금홍에게',
    content: "나는 상처를 통해 인간이 성장한다고 믿지 않는다.\n어떤 사람들은 상처를 통해 성장하기도 하지만,\n사실 그들은 상처가 없이도 잘 자랐으리라 믿는다.\n나는 당신을 상처 없이 지켜주고 싶다.\n심지어 그대, 전혀 성장하지 못한대도 상관없다.",
    language: Language.KOREAN
  },
  {
    filename: '여동생 옥희 보아라 - 이상',
    content: "이해 없는 세상에서\n나만은 언제라도 네 편인 것을 잊지 마라.",
    language: Language.KOREAN
  },
  {
    filename: '별 헤는 밤 - 윤동주',
    content: "계절이 지나가는 하늘에는\n가을로 가득 차 있습니다.\n나를 아무 걱정도 없이\n가을 속의 별들을 다 헤일 듯합니다.\n\n가슴속에 하나 둘 새겨지는 별을\n이제 다 못 헤는 것은\n쉬이 아침이 오는 까닭이요,\n내일 밤이 남은 까닭이요,\n아직 나의 청춘이 다하지 않은 까닭입니다.",
    language: Language.KOREAN
  },
  {
    filename: '진달래꽃 - 김소월',
    content: "나 보기가 역겨워\n가실 때에는\n말없이 고이 보내 드리오리다.\n\n영변에 약산\n진달래꽃\n아름 따다 가실 길에 뿌리오리다.",
    language: Language.KOREAN
  },
  {
    filename: '칼의 노래 - 김훈',
    content: "버려진 섬마다 꽃이 피었다.\n꽃 피는 해안선은 끝없이 어지러웠다.\n볕은 차갑고 맑았다.\n바다에서 불어오는 겨울 바람이 옷깃으로 스며들었다.",
    language: Language.KOREAN
  },
  {
    filename: '박지원 소설전 - 박지원',
    content: "덕이 있는 이에게는 사람이 모여들지.\n덕이 없을까 걱정해야지 사람이 없을까 걱정하겠는가?",
    language: Language.KOREAN
  },
  {
    filename: '섬 - 장 그르니에',
    content: "저마다의 일생에는,\n특히 그 일생이 동터 오르는 여명기에는\n모든 것을 결정짓는 한순간이 있다",
    language: Language.KOREAN
  },
  {
    filename: '안과 겉·결혼·여름 - 알베르 카뮈',
    content: "그때 나는 나 자신을 내맡김으로써\n사랑할 수 있었으니,\n마침내 나는 나 자신이 된 것이다.\n왜냐하면 우리를 우리 자신으로\n돌아오게 해주는 것은 사랑뿐이기 때문이다.",
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

  if (!Array.isArray(pool) || pool.length === 0) {
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
  const [isTyping, setIsTyping] = useState(false);
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
    if (!settings.rememberProgress || isComplete) return;
    const data: SavedSession = {
      session,
      userInputHistory: history,
      keystrokes: ks,
      accumulatedTime: accTime,
      lastUpdated: Date.now()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [session, settings.rememberProgress, isComplete]);

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
    localStorage.removeItem(STORAGE_KEY);
    setInitialData({ history: [], keystrokes: 0, time: 0 });
    setStats({
      speed: 0,
      accuracy: 100,
      typedCount: 0,
      totalCount: newSession.content.replace(/\n/g, '').length,
      elapsedTime: 0
    });
    setSession(newSession);
    setIsComplete(false);
    setIsPaused(false);
    setIsTyping(false);
    setResetKey(prev => prev + 1);
  };

  const handleReset = useCallback(() => {
    handleResetForNewSession(session);
  }, [session]);

  const handleNextSentence = useCallback(() => {
    if (!isComplete) return;
    const nextSession = getNextSessionFromPool(session.language, session.content);
    handleResetForNewSession(nextSession);
  }, [session.language, session.content, isComplete]);

  const handleClosePopup = useCallback(() => {
    setIsComplete(false);
  }, []);

  const handleStatsUpdate = (newStats: Stats) => {
    if (!isComplete && !isPaused) {
      setStats(newStats);
      if (newStats.typedCount > 0 && !isTyping) setIsTyping(true);
    }
  };

  const handleComplete = (finalStats: Stats) => {
    setStats(finalStats);
    setIsComplete(true);
    setIsTyping(false);
    localStorage.removeItem(STORAGE_KEY);
  };

  const togglePause = () => {
    setIsPaused(prev => !prev);
    if (!isPaused) setIsTyping(false);
  };

  const zenOpacity = (isTyping && !isPaused) ? 'opacity-20' : 'opacity-100';

  return (
    <div className={`flex flex-col h-screen transition-colors duration-300 overflow-hidden ${isDarkMode ? 'bg-[#121212] text-[#e0e0e0]' : 'bg-white text-[#333]'}`}>
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".txt,.docx" />

      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm px-4">
          <div className={`${isDarkMode ? 'bg-[#1e1e1e] border-gray-800' : 'bg-white border-gray-100'} rounded-2xl w-full max-w-sm p-6 shadow-xl border`}>
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
          <div className={`flex justify-end items-center gap-4 transition-opacity duration-700 ${zenOpacity}`}>
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
            <h1 className={`text-[30px] font-normal tracking-tight truncate mr-4 transition-colors ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
              {session.filename}
            </h1>
            <button onClick={togglePause} className={`flex items-center gap-2 px-3 py-1 rounded-full transition-all text-[11px] font-bold uppercase tracking-widest ${isPaused ? (isDarkMode ? 'bg-gray-200 text-black' : 'bg-black text-white') : (isDarkMode ? 'bg-gray-800 text-gray-500 hover:text-gray-300' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-black')}`}>
              {isPaused ? "Resume" : "Pause"}
            </button>
          </div>
        </div>
        <StatsBar stats={stats} language={session.language} isPaused={isPaused} isTyping={isTyping} />
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
