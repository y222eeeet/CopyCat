
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

    // Mobile needs even snappier scrolling to feel responsive
    if (Math.abs(distance) < 0.5) {
      container.scrollTop = destinationTop;
      return;
    }

    const startTime = performance.now();
    const duration = isMobile ? 180 : 300; 

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
      // targetHeight는 보통 40px (leading-relaxed)
      if (currentLineIndex >= 2) {
        // 정확히 2줄만큼의 높이를 상단 여백으로 남기고 고정
        // targetTop은 현재 줄의 절대 위치
        nextScrollTop = targetTop - (targetHeight * 2);
        
        // 오차 범위를 0.5px로 줄여 아주 미세한 움직임도 즉각 반영 (자석 고정 효과)
        if (Math.abs(nextScrollTop - currentScroll) > 0.5) {
          performSmoothScroll(Math.max(0, nextScrollTop));
        }
      } else {
        if (currentScroll > 1) performSmoothScroll(0);
      }
    } else {
      // PC: Safe Zone logic with smoother clamping
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
