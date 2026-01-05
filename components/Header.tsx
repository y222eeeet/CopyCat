
import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import { TypingSession, Language } from '../types';
import { detectLanguage } from '../services/hangulUtils';

declare const mammoth: any;

interface Props {
  onUpload: (session: TypingSession) => void;
  onReset: () => void;
}

export interface HeaderHandle {
  triggerUpload: () => void;
}

const Header = forwardRef<HeaderHandle, Props>(({ onUpload, onReset }, ref) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    triggerUpload: () => {
      fileInputRef.current?.click();
    }
  }));

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
      
      // Cleanup content: Remove indentation, normalize line endings, collapse to max 2 newlines
      const normalizedContent = content
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .split('\n')
        .map(line => line.trim())
        .join('\n')
        .replace(/\n{3,}/g, '\n\n');

      if (!normalizedContent) return;
      onUpload({
        filename: filename.split('.').slice(0, -1).join('.'),
        content: normalizedContent,
        language: detectLanguage(normalizedContent) as Language,
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <header className="flex justify-between items-center px-6 py-8 bg-white select-none">
      <div className="flex items-center gap-1 cursor-default">
        <span className="text-xl font-bold tracking-tight text-[#333]">typing</span>
        <span className="text-xl font-bold tracking-tight text-[#9ca3af]">.works</span>
      </div>

      <div className="flex items-center gap-6 text-sm font-medium text-gray-500">
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="hover:text-black transition-colors"
        >
          Upload
        </button>
        <button 
          onClick={onReset}
          className="hover:text-black transition-colors"
        >
          Reset
        </button>
        <div className="h-4 w-[1px] bg-gray-200"></div>
        <button className="hover:text-black transition-colors">A</button>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          className="hidden" 
          accept=".txt,.docx"
        />
      </div>
    </header>
  );
});

export default Header;
