import { useRef, useEffect, useCallback } from 'react';
import { ArrowRight } from 'lucide-react';
import './ScrollVideoHero.css';

const TOTAL_FRAMES = 230;

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

  for (let i = 1; i <= TOTAL_FRAMES; i += 1) {
    const image = new Image();
    const paddedIndex = String(i).padStart(3, '0');
    image.src = `/Create_a_premium_cinematic_pr_frames/frames/frame_${paddedIndex}.jpg`;
    image.onload = () => {
      loadedFrames.add(i - 1);
      preloadCallbacks.forEach((callback) => callback(i - 1));
    };
    imageCache[i - 1] = image;
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

  const drawFrame = useCallback((targetIndex) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    const frameIndex = Math.min(
      TOTAL_FRAMES - 1,
      Math.max(0, Math.floor(targetIndex)),
    );
    let image = imageCache[frameIndex];

    if (!image || !image.complete || image.naturalWidth === 0) {
      for (let offset = 1; offset < TOTAL_FRAMES; offset += 1) {
        const previous = imageCache[frameIndex - offset];
        const next = imageCache[frameIndex + offset];
        if (previous?.complete && previous.naturalWidth > 0) {
          image = previous;
          break;
        }
        if (next?.complete && next.naturalWidth > 0) {
          image = next;
          break;
        }
      }
    }

    if (!image || !image.complete || image.naturalWidth === 0) return;

    const scale = Math.max(
      canvas.width / image.naturalWidth,
      canvas.height / image.naturalHeight,
    );
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(
      image,
      (canvas.width - drawWidth) / 2,
      (canvas.height - drawHeight) / 2,
      drawWidth,
      drawHeight,
    );
  }, []);

  const renderLoop = useCallback(() => {
    const frameDiff = targetFrameRef.current - smoothFrameRef.current;

    if (Math.abs(frameDiff) > 0.005) {
      smoothFrameRef.current += frameDiff * 0.25;
      drawFrame(smoothFrameRef.current);
      rafIdRef.current = requestAnimationFrame(() => renderLoopRef.current());
      return;
    }

    smoothFrameRef.current = targetFrameRef.current;
    drawFrame(smoothFrameRef.current);
    isAnimatingRef.current = false;
    rafIdRef.current = null;
  }, [drawFrame]);

  useEffect(() => {
    renderLoopRef.current = renderLoop;
  }, [renderLoop]);

  const handleScroll = useCallback(() => {
    if (!sectionRef.current) return;

    const section = sectionRef.current;
    const scrollableDistance = section.offsetHeight - window.innerHeight;
    if (scrollableDistance <= 0) return;

    const progress = Math.max(
      0,
      Math.min(1, -section.getBoundingClientRect().top / scrollableDistance),
    );
    targetFrameRef.current = progress * (TOTAL_FRAMES - 1);

    if (!isAnimatingRef.current) {
      isAnimatingRef.current = true;
      rafIdRef.current = requestAnimationFrame(() => renderLoopRef.current());
    }
  }, []);

  const handleResize = useCallback(() => {
    if (!canvasRef.current) return;
    canvasRef.current.width = window.innerWidth;
    canvasRef.current.height = window.innerHeight;
    drawFrame(smoothFrameRef.current);
  }, [drawFrame]);

  useEffect(() => {
    handleResize();

    const handleFrameLoaded = () => drawFrame(smoothFrameRef.current);
    preloadAllFrames(handleFrameLoaded);
    drawFrame(smoothFrameRef.current);

    return () => {
      preloadCallbacks.delete(handleFrameLoaded);
    };
  }, [drawFrame, handleResize]);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [handleScroll, handleResize]);

  return (
    <section
      ref={sectionRef}
      className="scroll-canvas-section"
      aria-label="Cinematic Frame Scroll Sequence"
    >
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
