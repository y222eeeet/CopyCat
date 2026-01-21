
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
    // 모바일에서는 조금 더 부드러운 느낌을 위해 지속 시간을 약간 조정
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
      // 모바일: 현재 타이핑 라인을 화면의 약 40~45% 지점에 위치시킴
      // 키보드가 올라오면 가용 높이가 줄어드는데, 그 상태에서 중앙에 가깝게 유지
      const centerTarget = targetTop - (viewportHeight * 0.42);
      nextScrollTop = centerTarget;
      
      // 모바일에서는 미세한 움직임에도 계속 반응하면 어지러울 수 있으므로
      // 어느 정도 차이가 날 때만 스무스 스크롤을 실행
      if (Math.abs(nextScrollTop - currentScroll) > 10) {
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
