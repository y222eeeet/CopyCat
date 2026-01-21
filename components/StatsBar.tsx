
import React from 'react';
import { Stats, Language } from '../types';

interface Props {
  stats: Stats;
  language: Language;
  isPaused: boolean;
  isTyping: boolean;
}

const StatsBar: React.FC<Props> = ({ stats, language, isPaused, isTyping }) => {
  const progress = stats.totalCount > 0 ? (stats.typedCount / stats.totalCount) * 100 : 0;
  const labelOpacity = (isTyping && !isPaused) ? 'opacity-30' : 'opacity-100';

  return (
    <div className="w-full select-none flex flex-col gap-0.5 transition-opacity duration-500">
      <div className="flex justify-start gap-8 items-end">
        <div className="flex items-baseline gap-1.5">
          <span className={`text-[10px] font-bold uppercase tracking-widest transition-opacity duration-500 ${labelOpacity} ${isPaused ? 'text-gray-500' : 'text-[#D1D5DB] dark:text-gray-500'}`}>Speed</span>
          <span className={`text-xl font-bold transition-colors ${isPaused ? 'text-gray-400 dark:text-gray-600' : 'text-black dark:text-white'}`}>
            {Math.round(stats.speed)}
          </span>
          <span className={`text-[10px] font-bold uppercase tracking-widest transition-opacity duration-500 ${labelOpacity} ${isPaused ? 'text-gray-500' : 'text-[#D1D5DB] dark:text-gray-500'}`}>
            {language === Language.KOREAN ? '타/분' : 'WPM'}
          </span>
        </div>
        
        <div className="flex items-baseline gap-1.5">
          <span className={`text-[10px] font-bold uppercase tracking-widest transition-opacity duration-500 ${labelOpacity} ${isPaused ? 'text-gray-500' : 'text-[#D1D5DB] dark:text-gray-500'}`}>Accuracy</span>
          <span className={`text-xl font-bold transition-colors ${isPaused ? 'text-gray-400 dark:text-gray-600' : 'text-black dark:text-white'}`}>
            {Math.round(stats.accuracy)}
          </span>
          <span className={`text-[10px] font-bold uppercase tracking-widest transition-opacity duration-500 ${labelOpacity} ${isPaused ? 'text-gray-500' : 'text-[#D1D5DB] dark:text-gray-500'}`}>%</span>
        </div>
      </div>

      <div className="flex justify-between items-baseline">
        <div className="flex items-center">
          {isPaused && (
            <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest animate-pulse">
              ● Paused
            </span>
          )}
        </div>
        <div className="flex items-baseline">
          <span className={`text-xl font-bold transition-colors ${isPaused ? 'text-gray-400 dark:text-gray-600' : 'text-black dark:text-white'}`}>{stats.typedCount}</span>
          <span className="text-xl font-bold text-[#D1D5DB] dark:text-gray-700 mx-1.5">/</span>
          <span className="text-xl font-bold text-[#D1D5DB] dark:text-gray-700">{stats.totalCount}</span>
        </div>
      </div>

      <div className={`w-full h-[2px] relative overflow-hidden mt-1 transition-colors ${isPaused ? 'bg-gray-100 dark:bg-gray-900' : 'bg-[#f1f1f1] dark:bg-gray-700'}`}>
        <div 
          className={`absolute top-0 left-0 h-full transition-all duration-300 ease-out ${isPaused ? 'bg-gray-400 dark:bg-gray-600 opacity-30' : 'bg-black dark:bg-white opacity-100'}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

export default StatsBar;
