
import React, { useEffect } from 'react';
import { Stats, Language } from '../types';
import { playCompletionSound } from '../services/soundService';

interface Props {
  stats: Stats;
  language: Language;
  onNext: () => void;
  onClose: () => void;
}

const CompletionPopup: React.FC<Props> = ({ stats, language, onNext, onClose }) => {
  useEffect(() => {
    playCompletionSound();
  }, []);

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    onNext();
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#1e1e1e] rounded-3xl w-full max-w-md p-8 shadow-2xl animate-in fade-in zoom-in duration-300">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full mb-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">필사 완료!</h2>
          <p className="text-gray-500 dark:text-gray-400">훌륭한 실력이네요. 고생하셨습니다.</p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl text-center">
            <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-bold tracking-widest block mb-1">Speed</span>
            <span className="text-2xl font-bold text-gray-800 dark:text-gray-200">
              {Math.round(stats.speed)}
              <span className="text-xs font-normal text-gray-500 ml-1">{language === Language.KOREAN ? '타/분' : 'WPM'}</span>
            </span>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl text-center">
            <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-bold tracking-widest block mb-1">Accuracy</span>
            <span className="text-2xl font-bold text-gray-800 dark:text-gray-200">
              {Math.round(stats.accuracy)}
              <span className="text-xs font-normal text-gray-500 ml-1">%</span>
            </span>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl text-center col-span-2">
            <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-bold tracking-widest block mb-1">Progress</span>
            <span className="text-xl font-bold text-gray-800 dark:text-gray-200">
              {stats.typedCount} / {stats.totalCount} chars
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <button 
            onClick={handleNext}
            className="w-full py-4 bg-black dark:bg-gray-100 text-white dark:text-black rounded-2xl font-bold hover:bg-gray-800 dark:hover:bg-white transition-all active:scale-[0.98]"
          >
            다음 문장으로
          </button>
          <button 
            onClick={handleClose}
            className="w-full py-4 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-2xl font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-all active:scale-[0.98]"
          >
            돌아가기
          </button>
        </div>
      </div>
    </div>
  );
};

export default CompletionPopup;
