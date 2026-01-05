
import React, { useState, useCallback, useRef, useEffect } from 'react';
import TypingAreaV2 from './components/TypingAreaV2';
import StatsBar from './components/StatsBar';
import CompletionPopup from './components/CompletionPopup';
import { TypingSession, Stats, Language, Settings, SavedSession } from './types';
import { detectLanguage } from './services/hangulUtils';

// Mammoth is loaded globally in index.html
declare const mammoth: any;

const STORAGE_KEY = 'typing_works_session_v2';
const SETTINGS_KEY = 'typing_works_settings';
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
    filename: 'Creed II (2018)',
    content: "If you wanna change things in a big way,\nthen you’re gunna have to make\nsome big changes.",
    language: Language.ENGLISH
  },
  {
    filename: 'Ratatouille (2007)',
    content: "If you focus on what you left behind,\nthen how can you see\nwhat lies ahead?",
    language: Language.ENGLISH
  },
  {
    filename: 'The Lord of the Rings(2001)',
    content: "You can’t control your fate.\nAll you can do is decide\nwhat you’re going to do\nwith the time that’s given to you.",
    language: Language.ENGLISH
  },
  {
    filename: 'Collateral Beauty (2016)',
    content: "A day is long as hell.\nI am abundant.\nI am a gift.\nEven while you are standing here talking shit,\nI’m gifting you,\nand you are wasting it.",
    language: Language.ENGLISH
  },
  {
    filename: 'Collateral Beauty (2016)',
    content: "I am the fabric of life.",
    language: Language.ENGLISH
  },
  {
    filename: 'Extraction',
    content: "You drown not by falling in the river,\nbut by staying submerged in it.",
    language: Language.ENGLISH
  },
  {
    filename: 'Sonnet 18 — William Shakespeare',
    content: "But thy eternal summer shall not fade,\nNor lose possession of that fair thou ow’st;\nNor shall Death brag thou wander’st in his shade,\nWhen in eternal lines to time thou grow’st.",
    language: Language.ENGLISH
  },
  {
    filename: 'Cosmos — Carl Sagan',
    content: "For small creatures such as we,\nthe vastness is bearable only through love.\nTo be here now, alive in this universe,\nat the same time and on the same planet as you,\nis a joy beyond measure.",
    language: Language.ENGLISH
  },
  {
    filename: 'Jane Eyre — Charlotte Brontë',
    content: "The past was a pageant of sweet and bitter memories.\nTo read but one line of its record\nwas enough to dissolve my courage\nand exhaust my energy.\nThe future was blank;\nthe flood was gone,\nand the world lay before me.",
    language: Language.ENGLISH
  },
  {
    filename: 'The Great Gatsby — F. Scott Fitzgerald',
    content: "Gatsby turned out all right at the end; it is what preyed on Gatsby, what foul dust floated in the wake of his dreams that temporarily closed out my interest in the abortive sorrows and short-winded elations of men.",
    language: Language.ENGLISH
  },
  {
    filename: 'The Great Gatsby — F. Scott Fitzgerald ',
    content: "If personality is an unbroken series of successful gestures, then there was something gorgeous about him, some heightened sensitivity to the promises of life, as if he were related to one of those intricate machines that register earthquakes ten thousand miles away.",
    language: Language.ENGLISH
  },
  {
    filename: 'A Man Called Ove — Fredrik Backman',
    content: "People said Ove saw the world in black and white.\nBut she was color.\nAll the color he had.",
    language: Language.ENGLISH
  },
  {
    filename: 'Hamlet — William Shakespeare',
    content: "To be, or not to be: that is the question:\nWhether ’tis nobler in the mind to suffer\nThe slings and arrows of outrageous fortune,\nOr to take arms against a sea of troubles\nAnd by opposing end them.",
    language: Language.ENGLISH
  },
  {
    filename: 'The Rose and the Nightingale — Oscar Wilde',
    content: "She said that she would dance with me if I brought her red roses, but in all my garden there is no red rose.",
    language: Language.ENGLISH
  },
  {
    filename: 'Romeo and Juliet — William Shakespeare',
    content: "The grey-eyed morn smiles on the frowning night,\nCheckering the eastern clouds with streaks of light;\nAnd darkness fleckled like a drunkard reels\nFrom forth day’s path and Titan’s fiery wheels.",
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
    filename: '한계령을 위한 연가 - 문정희',
    content: "눈부신 고립\n사방이 온통 흰 것뿐인 동화의 나라에\n발이 아니라 운명이 묶였으면",
    language: Language.KOREAN
  },
  {
    filename: '환상통 - 이희주',
    content: "아름다움 앞에서 나는 얼마나 나약했던가\n절망과 무력감에 몸을 떨며 나는 내 고통의 근원을 입밖으로 꺼내길 원했으나,\n어떤 표현도 늪에 빠진 시체처럼 차게 인광을 발하는 말에 불과했다",
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
    filename: '이상, 옥희에게',
    content: "이해 없는 세상에서\n나만은 언제라도 네 편인 것을 잊지 마라.",
    language: Language.KOREAN
  }
];

const getNextSessionFromPool = (lang: Language): TypingSession => {
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

  const nextIndex = pool.pop()!;
  localStorage.setItem(poolKey, JSON.stringify(pool));
  return sessions[nextIndex];
};

const App: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Settings
  const [settings, setSettings] = useState<Settings>(() => {
    const saved = localStorage.getItem(SETTINGS_KEY);
    return saved ? JSON.parse(saved) : { rememberProgress: true };
  });
  const [showSettings, setShowSettings] = useState(false);

  // State
  const [session, setSession] = useState<TypingSession>(() => {
    const saved = settings.rememberProgress ? localStorage.getItem(STORAGE_KEY) : null;
    if (saved) {
      const parsed: SavedSession = JSON.parse(saved);
      return parsed.session;
    }
    return getNextSessionFromPool(Language.ENGLISH);
  });

  const [initialData, setInitialData] = useState<{history: string[], keystrokes: number, time: number}>(() => {
    const saved = settings.rememberProgress ? localStorage.getItem(STORAGE_KEY) : null;
    if (saved) {
      const parsed: SavedSession = JSON.parse(saved);
      return { history: parsed.userInputHistory, keystrokes: parsed.keystrokes, time: parsed.accumulatedTime };
    }
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

  // Persist settings
  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

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
    setSession(nextSession);
    handleResetForNewSession(nextSession);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const filename = file.name;
    let content = '';
    try {
      if (file.name.endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        content = result.value;
      } else {
        content = await file.text();
      }
      
      const normalizedContent = content
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .split('\n')
        .map(line => line.trim())
        .join('\n')
        .replace(/\n{3,}/g, '\n\n');

      if (!normalizedContent) return;
      
      const newSession = {
        filename: filename.split('.').slice(0, -1).join('.'),
        content: normalizedContent,
        language: detectLanguage(normalizedContent) as Language,
      };

      setSession(newSession);
      handleResetForNewSession(newSession);
      
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      console.error(err);
      alert("파일을 읽는 중 오류가 발생했습니다.");
    }
  };

  const handleResetForNewSession = (newSession: TypingSession) => {
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
    setStats({
      speed: 0,
      accuracy: 100,
      typedCount: 0,
      totalCount: session.content.replace(/\n/g, '').length,
      elapsedTime: 0
    });
    setInitialData({ history: [], keystrokes: 0, time: 0 });
    setIsComplete(false);
    setIsPaused(false);
    setResetKey(prev => prev + 1);
    localStorage.removeItem(STORAGE_KEY);
  }, [session.content]);

  const handleNextSentence = useCallback(() => {
    const nextSession = getNextSessionFromPool(session.language);
    setSession(nextSession);
    handleResetForNewSession(nextSession);
  }, [session.language]);

  const handleClosePopup = useCallback(() => {
    setIsComplete(false);
  }, []);

  const handleStatsUpdate = (newStats: Stats) => {
    if (!isComplete && !isPaused) {
      setStats(newStats);
    }
  };

  const handleComplete = (finalStats: Stats) => {
    setStats(finalStats);
    setIsComplete(true);
    localStorage.removeItem(STORAGE_KEY);
  };

  const togglePause = () => {
    setIsPaused(prev => !prev);
  };

  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden text-[#333]">
      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
        accept=".txt,.docx"
      />

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl border border-gray-100">
            <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-6">Settings</h3>
            <div className="flex items-center justify-between mb-8">
              <span className="text-sm font-medium text-gray-700">Remember progress</span>
              <button 
                onClick={() => setSettings(s => ({ ...s, rememberProgress: !s.rememberProgress }))}
                className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none ${settings.rememberProgress ? 'bg-black' : 'bg-gray-200'}`}
              >
                <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${settings.rememberProgress ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            <button 
              onClick={() => setShowSettings(false)}
              className="w-full py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 min-h-0 flex flex-col max-w-6xl mx-auto w-full px-6 pt-6">
        {/* Header 영역 */}
        <div className="flex flex-col gap-6 mb-4">
          {/* Line 1: Actions */}
          <div className="flex justify-end items-center gap-4">
            <button 
              onClick={handleUploadClick}
              className="text-[11px] font-bold text-gray-400 uppercase tracking-widest hover:text-black transition-colors"
            >
              Upload
            </button>
            <button 
              onClick={handleReset}
              className="text-[11px] font-bold text-gray-400 uppercase tracking-widest hover:text-black transition-colors"
            >
              Reset
            </button>
            <div className="h-3 w-[1px] bg-gray-200"></div>
            <button 
              onClick={() => setShowSettings(true)}
              className="text-gray-300 hover:text-gray-500 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
            <button 
              onClick={handleToggleLanguage}
              title="Toggle Language"
              className="text-gray-400 hover:text-black transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
            </button>
          </div>

          {/* Line 2: Title & Pause Button */}
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-bold text-gray-800 tracking-tight truncate mr-4">{session.filename}</h1>
            <button 
              onClick={togglePause}
              className={`flex items-center gap-2 px-3 py-1 rounded-full transition-all text-[11px] font-bold uppercase tracking-widest ${
                isPaused 
                  ? 'bg-black text-white' 
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-black'
              }`}
            >
              {isPaused ? (
                <>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                  Resume
                </>
              ) : (
                <>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                  Pause
                </>
              )}
            </button>
          </div>
        </div>

        {/* Stats 영역 */}
        <StatsBar 
          stats={stats} 
          language={session.language} 
          isPaused={isPaused}
        />
        
        {/* Typing Area */}
        <div className="mt-8 flex-1 min-h-0 overflow-hidden">
          <TypingAreaV2 
            key={`${resetKey}-${session.filename}`}
            session={session} 
            isPaused={isPaused}
            initialHistory={initialData.history}
            initialKeystrokes={initialData.keystrokes}
            initialAccumulatedTime={initialData.time}
            onStatsUpdate={handleStatsUpdate}
            onComplete={handleComplete}
            onPersist={saveSessionState}
          />
        </div>
      </main>

      {isComplete && (
        <CompletionPopup 
          stats={stats} 
          language={session.language} 
          onNext={handleNextSentence}
          onClose={handleClosePopup}
        />
      )}
    </div>
  );
};

export default App;
