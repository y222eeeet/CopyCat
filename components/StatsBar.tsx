
import React from 'react';
import { Stats, Language } from '../types';

interface Props {
  stats: Stats;
  language: Language;
  isPaused: boolean;
}

const StatsBar: React.FC<Props> = ({ stats, language, isPaused }) => {
  const progress = stats.totalCount > 0 ? (stats.typedCount / stats.totalCount) * 100 : 0;

  return (
    <div className="w-full select-none flex flex-col gap-0.5">
      {/* 모바일 Line 3: Speed & Accuracy (Left Aligned) */}
      <div className="flex justify-start gap-8 items-end">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[10px] font-bold text-[#D1D5DB] uppercase tracking-widest">Speed</span>
          <span className={`text-xl font-bold ${isPaused ? 'text-gray-300' : 'text-black'}`}>
            {Math.round(stats.speed)}
          </span>
          <span className="text-[10px] font-bold text-[#D1D5DB] uppercase tracking-widest">
            {language === Language.KOREAN ? '타/분' : 'WPM'}
          </span>
        </div>
        
        <div className="flex items-baseline gap-1.5">
          <span className="text-[10px] font-bold text-[#D1D5DB] uppercase tracking-widest">Accuracy</span>
          <span className={`text-xl font-bold ${isPaused ? 'text-gray-300' : 'text-black'}`}>
            {Math.round(stats.accuracy)}
          </span>
          <span className="text-[10px] font-bold text-[#D1D5DB] uppercase tracking-widest">%</span>
        </div>
      </div>

      {/* 모바일 Line 4: Counts & Paused Indicator */}
      <div className="flex justify-between items-baseline">
        <div className="flex items-center">
          {isPaused && (
            <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest animate-pulse">
              ● Paused
            </span>
          )}
        </div>
        <div className="flex items-baseline">
          <span className={`text-xl font-bold ${isPaused ? 'text-gray-300' : 'text-black'}`}>{stats.typedCount}</span>
          <span className="text-xl font-bold text-[#D1D5DB] mx-1.5">/</span>
          <span className="text-xl font-bold text-[#D1D5DB]">{stats.totalCount}</span>
        </div>
      </div>

      {/* Progress Line */}
      <div className="w-full h-[2px] bg-[#f1f1f1] relative overflow-hidden mt-1">
        <div 
          className={`absolute top-0 left-0 h-full bg-black transition-all duration-300 ease-out ${isPaused ? 'opacity-30' : 'opacity-100'}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

export default StatsBar;
