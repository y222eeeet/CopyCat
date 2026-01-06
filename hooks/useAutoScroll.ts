// Import React to provide the React namespace for RefObject
import React, { useCallback, useRef, useEffect } from 'react';

interface AutoScrollOptions {
  containerRef: React.RefObject<HTMLElement | null>;
  targetTop: number;
  targetHeight: number;
  isPaused?: boolean;
}

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
    if (Math.abs(distance) < 2) {
      container.scrollTop = destinationTop;
      return;
    }

    const startTime = performance.now();
    // 거리 비례 시간 계산 (최소 150ms ~ 최대 400ms)
    const duration = Math.min(400, Math.max(150, 200 + Math.abs(distance) / 3));

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease-out Cubic
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
    
    // 안전 영역 설정 (상단 20%, 하단 35%) - 타이핑 흐름을 방해하지 않도록 하단 마진을 더 줌
    const topPadding = viewportHeight * 0.20;
    const bottomPadding = viewportHeight * 0.35;

    const safeTopBoundary = currentScroll + topPadding;
    const safeBottomBoundary = currentScroll + viewportHeight - bottomPadding;

    let nextScrollTop = currentScroll;

    if (targetTop < safeTopBoundary) {
      // 캐럿이 너무 위에 있음 -> 위로 스크롤
      nextScrollTop = targetTop - topPadding;
    } else if (targetTop + targetHeight > safeBottomBoundary) {
      // 캐럿이 너무 아래에 있음 -> 아래로 스크롤
      nextScrollTop = targetTop + targetHeight - (viewportHeight - bottomPadding);
    }

    nextScrollTop = Math.max(0, nextScrollTop);

    if (Math.abs(nextScrollTop - currentScroll) > 1) {
      performSmoothScroll(nextScrollTop);
    }
  }, [targetTop, targetHeight, isPaused, performSmoothScroll, containerRef]);

  useEffect(() => {
    return () => {
      if (scrollAnimRef.current) cancelAnimationFrame(scrollAnimRef.current);
    };
  }, []);
};