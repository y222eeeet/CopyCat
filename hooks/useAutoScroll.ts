
// Import React to provide the React namespace for RefObject
import React, { useCallback, useRef, useEffect } from 'react';

interface AutoScrollOptions {
  containerRef: React.RefObject<HTMLElement | null>;
  targetTop: number;
  targetHeight: number;
  currentLineIndex: number;
  isPaused?: boolean;
}

const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

export const useAutoScroll = ({
  containerRef,
  targetTop,
  targetHeight,
  currentLineIndex,
  isPaused = false
}: AutoScrollOptions) => {
  const scrollAnimRef = useRef<number | null>(null);

  const performSmoothScroll = useCallback((destinationTop: number) => {
    const container = containerRef.current;
    if (!container) return;

    if (scrollAnimRef.current) cancelAnimationFrame(scrollAnimRef.current);

    const startTop = container.scrollTop;
    const distance = destinationTop - startTop;

    if (Math.abs(distance) < 0.5) {
      container.scrollTop = destinationTop;
      return;
    }

    const startTime = performance.now();
    const duration = isMobile ? 200 : 300; // Faster scroll for mobile to keep up with typing

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      const ease = 1 - Math.pow(1 - progress, 3);
      container.scrollTop = startTop + (distance * ease);

      if (progress < 1) {
        scrollAnimRef.current = requestAnimationFrame(step);
      } else {
        scrollAnimRef.current = null;
      }
    };

    scrollAnimRef.current = requestAnimationFrame(step);
  }, [containerRef]);

  useEffect(() => {
    if (isPaused) return;

    const container = containerRef.current;
    if (!container || targetHeight === 0) return;

    const viewportHeight = container.clientHeight;
    const currentScroll = container.scrollTop;
    
    let nextScrollTop = currentScroll;

    if (isMobile) {
      // 3번째 줄(index 2)부터 스크롤 시작
      // 줄 높이가 대략 40px이므로, 3번째 줄이 화면 상단 근처에 오도록 고정
      if (currentLineIndex >= 2) {
        // 현재 줄의 top 위치에서 상단 여백(줄 2개 정도의 높이)을 뺀 지점으로 스크롤
        // 이렇게 하면 현재 입력줄이 항상 화면 상단에서 3번째 위치 정도에 고정됨
        nextScrollTop = targetTop - (targetHeight * 2);
        
        if (Math.abs(nextScrollTop - currentScroll) > 2) {
          performSmoothScroll(Math.max(0, nextScrollTop));
        }
      } else {
        // 1, 2번째 줄일 때는 스크롤을 0으로 유지
        if (currentScroll > 5) performSmoothScroll(0);
      }
    } else {
      // PC: 기존의 안전 영역(Safe Zone) 방식 유지
      const topPadding = viewportHeight * 0.20;
      const bottomPadding = viewportHeight * 0.35;

      const safeTopBoundary = currentScroll + topPadding;
      const safeBottomBoundary = currentScroll + viewportHeight - bottomPadding;

      if (targetTop < safeTopBoundary) {
        nextScrollTop = targetTop - topPadding;
      } else if (targetTop + targetHeight > safeBottomBoundary) {
        nextScrollTop = targetTop + targetHeight - (viewportHeight - bottomPadding);
      }

      nextScrollTop = Math.max(0, nextScrollTop);

      if (Math.abs(nextScrollTop - currentScroll) > 1) {
        performSmoothScroll(nextScrollTop);
      }
    }
  }, [targetTop, targetHeight, currentLineIndex, isPaused, performSmoothScroll, containerRef]);

  useEffect(() => {
    return () => {
      if (scrollAnimRef.current) cancelAnimationFrame(scrollAnimRef.current);
    };
  }, []);
};
