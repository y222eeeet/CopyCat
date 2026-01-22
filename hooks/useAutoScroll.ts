
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
  const prevLineIndexRef = useRef<number>(currentLineIndex);

  const performSmoothScroll = useCallback((destinationTop: number) => {
    const container = containerRef.current;
    if (!container) return;

    if (scrollAnimRef.current) cancelAnimationFrame(scrollAnimRef.current);

    const startTop = container.scrollTop;
    const distance = destinationTop - startTop;

    // Small threshold to prevent micro-animations and jitter
    if (Math.abs(distance) < 0.8) {
      container.scrollTop = destinationTop;
      return;
    }

    const startTime = performance.now();
    // PC uses a slightly longer duration for more "weighty" and smooth feeling, synchronized with cursor ease
    const duration = isMobile ? 180 : 350; 

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Quintic ease-out for extremely smooth deceleration
      const ease = 1 - Math.pow(1 - progress, 4);
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
    const lineChanged = currentLineIndex !== prevLineIndexRef.current;
    
    let nextScrollTop = currentScroll;

    if (isMobile) {
      // Mobile: Keep original scrolling logic but ensure it triggers smoothly
      if (currentLineIndex >= 2) {
        nextScrollTop = targetTop - (targetHeight * 2);
        if (Math.abs(nextScrollTop - currentScroll) > 1.0) {
          performSmoothScroll(Math.max(0, nextScrollTop));
        }
      } else if (currentScroll > 1) {
        performSmoothScroll(0);
      }
    } else {
      // PC: Scroll ONLY when the line changes (due to Enter or Space trigger)
      // This prevents the cursor from "floating" while typing inside a line
      if (lineChanged || currentLineIndex === 0) {
        const topOffset = viewportHeight * 0.25;
        nextScrollTop = Math.max(0, targetTop - topOffset);
        
        if (Math.abs(nextScrollTop - currentScroll) > 1.5) {
          performSmoothScroll(nextScrollTop);
        }
      }
    }
    
    prevLineIndexRef.current = currentLineIndex;
  }, [currentLineIndex, targetTop, targetHeight, isPaused, performSmoothScroll, containerRef]);

  useEffect(() => {
    return () => {
      if (scrollAnimRef.current) cancelAnimationFrame(scrollAnimRef.current);
    };
  }, []);
};
