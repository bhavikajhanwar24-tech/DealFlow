import { useRef, useEffect, useCallback } from 'react';
import { ArrowRight } from 'lucide-react';
import './ScrollVideoHero.css';

const TOTAL_FRAMES = 230;

// Global image cache so images persist across React component re-renders
const imageCache = [];
const loadedFrames = new Set();
const preloadCallbacks = new Set();
let isPreloadingStarted = false;

function preloadAllFrames(onFrameLoaded) {
  if (onFrameLoaded) preloadCallbacks.add(onFrameLoaded);

  if (isPreloadingStarted) {
    loadedFrames.forEach((frameIndex) => onFrameLoaded?.(frameIndex));
    return;
  }

  isPreloadingStarted = true;

  for (let i = 1; i <= TOTAL_FRAMES; i++) {
    if (!imageCache[i - 1]) {
      const img = new Image();
      const paddedIndex = String(i).padStart(3, '0');
      img.src = `/Create_a_premium_cinematic_pr_frames/frames/frame_${paddedIndex}.jpg`;
      img.onload = () => {
        loadedFrames.add(i - 1);
        preloadCallbacks.forEach((callback) => callback(i - 1));
      };
      imageCache[i - 1] = img;
    }
  }
}

export default function ScrollVideoHero({ onNavigate }) {
  const sectionRef = useRef(null);
  const canvasRef = useRef(null);

  const targetFrameRef = useRef(0);
  const smoothFrameRef = useRef(0);
  const isAnimatingRef = useRef(false);
  const rafIdRef = useRef(null);
  const renderLoopRef = useRef(() => {});

  // Draw a frame onto the Canvas with aspect-ratio cover scaling
  const drawFrame = useCallback((targetIndex) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const clampedIndex = Math.min(TOTAL_FRAMES - 1, Math.max(0, Math.floor(targetIndex)));
    
    // Attempt to get requested frame image
    let img = imageCache[clampedIndex];

    // Fallback: If requested frame isn't loaded yet, find nearest loaded frame
    if (!img || !img.complete || img.naturalWidth === 0) {
      for (let offset = 1; offset < TOTAL_FRAMES; offset++) {
        const prev = imageCache[clampedIndex - offset];
        if (prev && prev.complete && prev.naturalWidth > 0) {
          img = prev;
          break;
        }
        const next = imageCache[clampedIndex + offset];
        if (next && next.complete && next.naturalWidth > 0) {
          img = next;
          break;
        }
      }
    }

    if (!img || !img.complete || img.naturalWidth === 0) return;

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const imgWidth = img.naturalWidth;
    const imgHeight = img.naturalHeight;

    if (!canvasWidth || !canvasHeight || !imgWidth || !imgHeight) return;

    // Calculate aspect-ratio cover dimensions
    const scale = Math.max(canvasWidth / imgWidth, canvasHeight / imgHeight);
    const drawWidth = imgWidth * scale;
    const drawHeight = imgHeight * scale;
    const x = (canvasWidth - drawWidth) / 2;
    const y = (canvasHeight - drawHeight) / 2;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.drawImage(img, x, y, drawWidth, drawHeight);
  }, []);

  // Smooth LERP render loop
  const renderLoop = useCallback(() => {
    const frameDiff = targetFrameRef.current - smoothFrameRef.current;

    if (Math.abs(frameDiff) > 0.005) {
      // 0.25 LERP factor for crisp, instantaneous response
      smoothFrameRef.current += frameDiff * 0.25;
      drawFrame(smoothFrameRef.current);
      rafIdRef.current = requestAnimationFrame(() => renderLoopRef.current());
    } else {
      smoothFrameRef.current = targetFrameRef.current;
      drawFrame(smoothFrameRef.current);
      isAnimatingRef.current = false;
      rafIdRef.current = null;
    }
  }, [drawFrame]);

  useEffect(() => {
    renderLoopRef.current = renderLoop;
  }, [renderLoop]);

  // Scroll listener to update target frame index
  const handleScroll = useCallback(() => {
    if (!sectionRef.current) return;

    const rect = sectionRef.current.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const scrollableDistance = rect.height - windowHeight;

    if (scrollableDistance <= 0) return;

    const currentScroll = -rect.top;
    let progress = currentScroll / scrollableDistance;
    progress = Math.max(0, Math.min(1, progress));

    targetFrameRef.current = progress * (TOTAL_FRAMES - 1);

    if (!isAnimatingRef.current) {
      isAnimatingRef.current = true;
      rafIdRef.current = requestAnimationFrame(renderLoop);
    }
  }, [renderLoop]);

  // Resize listener to adjust Canvas resolution
  const handleResize = useCallback(() => {
    if (canvasRef.current) {
      canvasRef.current.width = window.innerWidth;
      canvasRef.current.height = window.innerHeight;
      drawFrame(smoothFrameRef.current);
    }
  }, [drawFrame]);

  // Preload frames and bind onload events
  useEffect(() => {
    if (canvasRef.current) {
      canvasRef.current.width = window.innerWidth;
      canvasRef.current.height = window.innerHeight;
    }

    const handleFrameLoaded = () => {
      drawFrame(smoothFrameRef.current);
    };

    preloadAllFrames(handleFrameLoaded);

    drawFrame(smoothFrameRef.current);

    return () => {
      preloadCallbacks.delete(handleFrameLoaded);
    };
  }, [drawFrame]);

  // Attach scroll & resize event listeners
  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });

    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [handleScroll, handleResize]);

  return (
    <section ref={sectionRef} className="scroll-canvas-section" aria-label="Cinematic Frame Scroll Sequence">
      <div className="scroll-canvas-sticky">
        <canvas ref={canvasRef} className="fullscreen-canvas" />
        <div className="hero-cta-wrap">
          <button
            type="button"
            className="hero-cta"
            onClick={() => onNavigate?.('/login')}
          >
            Turn Opportunities into Outcomes
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}
