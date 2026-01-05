
import React, { useRef } from 'react';
import { TypingSession, Language } from '../types';
import { detectLanguage } from '../services/hangulUtils';

interface Props {
  onUpload: (session: TypingSession) => void;
}

// Mammoth is loaded globally in index.html
declare const mammoth: any;

const FileUploader: React.FC<Props> = ({ onUpload }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

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

      // Cleanup content: normalize line endings and spaces
      const normalizedContent = content
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .trim();

      if (!normalizedContent) {
        alert("The file is empty.");
        return;
      }

      onUpload({
        filename,
        content: normalizedContent,
        language: detectLanguage(normalizedContent) as Language,
      });
    } catch (err) {
      console.error(err);
      alert("Error reading file. Please ensure it's a valid .txt or .docx file.");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
      <div 
        onClick={() => fileInputRef.current?.click()}
        className="w-full max-w-xl p-12 border-2 border-dashed border-gray-300 rounded-3xl cursor-pointer hover:border-black transition-colors bg-white shadow-sm"
      >
        <div className="mb-6">
          <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h2 className="text-2xl font-semibold text-gray-800 mb-2">필사할 파일을 업로드하세요</h2>
        <p className="text-gray-500 mb-8">.txt 또는 .docx 파일을 지원합니다</p>
        <button className="px-8 py-3 bg-black text-white rounded-full font-medium hover:bg-gray-800 transition-all">
          파일 선택하기
        </button>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          className="hidden" 
          accept=".txt,.docx"
        />
      </div>
      <div className="mt-8 text-sm text-gray-400">
        최적의 환경을 위해 모바일보다 데스크탑 이용을 권장합니다.
      </div>
    </div>
  );
};

export default FileUploader;
