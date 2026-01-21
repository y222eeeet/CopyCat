
// Import React to provide the React namespace for RefObject
import React, { useCallback, useRef, useEffect } from 'react';

interface AutoScrollOptions {
  containerRef: React.RefObject<HTMLElement | null>;
  targetTop: number;
  targetHeight: number;
  isPaused?: boolean;
}

const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

export const useAutoScroll = ({
  containerRef,
  targetTop,
  targetHeight,
  isPaused = false
}: AutoScrollOptions) => {
  const scrollAnimRef = useRef<number | null>(null);

  const performSmoothScroll = useCallback((destinationTop: number) => {
    const container = containerRef.current;
    if (!container) return;

    if (scrollAnimRef.current) cancelAnimationFrame(scrollAnimRef.current);

    const startTop = container.scrollTop;
    const distance = destinationTop - startTop;

    // 이동 거리가 매우 짧으면 애니메이션 없이 즉시 이동하여 반응성 확보
    if (Math.abs(distance) < 1) {
      container.scrollTop = destinationTop;
      return;
    }

    const startTime = performance.now();
    // 거리 비례 시간 계산 (최소 150ms ~ 최대 450ms)
    const duration = isMobile 
      ? Math.min(450, Math.max(200, 250 + Math.abs(distance) / 2))
      : Math.min(400, Math.max(150, 200 + Math.abs(distance) / 3));

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease-out Cubic (더 매끄러운 감속)
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
      // 모바일: 현재 타이핑 라인을 화면의 상단 약 25% 지점에 위치시킴
      // 42%에서 25%로 조정하여 키보드에 가려지는 현상을 방지하고 더 일찍 스크롤되도록 함
      const centerTarget = targetTop - (viewportHeight * 0.25);
      nextScrollTop = centerTarget;
      
      // 반응성 향상을 위해 임계값을 10에서 5로 낮춤
      if (Math.abs(nextScrollTop - currentScroll) > 5) {
        performSmoothScroll(Math.max(0, nextScrollTop));
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
  }, [targetTop, targetHeight, isPaused, performSmoothScroll, containerRef]);

  useEffect(() => {
    return () => {
      if (scrollAnimRef.current) cancelAnimationFrame(scrollAnimRef.current);
    };
  }, []);
};
