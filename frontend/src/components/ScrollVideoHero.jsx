<<<<<<< HEAD
import React, { useRef, useEffect, useState, useCallback } from 'react';
import './ScrollVideoHero.css';

export default function ScrollVideoHero({ onNavigateToLogin }) {
=======
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
>>>>>>> 2ca274a4a1f288334fa6ccd6f2926b3ef4865720
  const sectionRef = useRef(null);
  const videoRef = useRef(null);
  const rafIdRef = useRef(null);
<<<<<<< HEAD
  const durationRef = useRef(0);
  const isLoadedRef = useRef(false);
=======
  const renderLoopRef = useRef(() => {});
>>>>>>> 2ca274a4a1f288334fa6ccd6f2926b3ef4865720

  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  // RAF scroll position calculator
  const updateVideoProgress = useCallback(() => {
    if (!sectionRef.current || !videoRef.current || !durationRef.current) return;

    const docHeight = document.documentElement.scrollHeight || document.body.scrollHeight || 0;
    const winHeight = window.innerHeight || 1;
    const maxScroll = Math.max(docHeight - winHeight, 1);
    const currentScroll = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;

<<<<<<< HEAD
    let progress = currentScroll / maxScroll;
=======
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
>>>>>>> 2ca274a4a1f288334fa6ccd6f2926b3ef4865720
    progress = Math.max(0, Math.min(1, progress));

    setScrollProgress(progress);

    const targetTime = progress * durationRef.current;

    // Safely update video currentTime
    if (isFinite(targetTime) && videoRef.current.readyState >= 1) {
      if (Math.abs(videoRef.current.currentTime - targetTime) > 0.001) {
        videoRef.current.currentTime = targetTime;
      }
    }
  }, []);

  // Handle scroll events with requestAnimationFrame
  useEffect(() => {
    const handleScroll = () => {
      if (!rafIdRef.current) {
        rafIdRef.current = requestAnimationFrame(() => {
          updateVideoProgress();
          rafIdRef.current = null;
        });
      }
    };

<<<<<<< HEAD
=======
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
>>>>>>> 2ca274a4a1f288334fa6ccd6f2926b3ef4865720
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });

    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [updateVideoProgress]);

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      durationRef.current = videoRef.current.duration;
      isLoadedRef.current = true;
      setIsLoaded(true);
      setHasError(false);
      updateVideoProgress();
    }
  };

  const handleVideoError = () => {
    setHasError(true);
    setIsLoaded(false);
  };

  // Section click handler to redirect to login
  const handleSectionClick = () => {
    if (scrollProgress >= 0.75 && onNavigateToLogin) {
      onNavigateToLogin();
    }
  };

  return (
    <section 
      ref={sectionRef} 
      className="scroll-canvas-section" 
      aria-label="Interactive DealFlow360 Scroll Video Hero"
      onClick={handleSectionClick}
    >
      <div className="scroll-canvas-sticky">
<<<<<<< HEAD
        
        {/* Loading Spinner */}
        {!isLoaded && !hasError && (
          <div className="fullscreen-loading">
            <div className="spinner-large" />
            <span>Loading interactive video experience...</span>
          </div>
        )}

        {/* Error Fallback */}
        {hasError && (
          <div className="fullscreen-error">
            <p>Interactive video preview currently unavailable.</p>
          </div>
        )}

        {/* Full Viewport MP4 Video */}
        <video
          ref={videoRef}
          className={`fullscreen-scroll-video ${isLoaded ? 'loaded' : ''}`}
          muted
          playsInline
          preload="auto"
          onLoadedMetadata={handleLoadedMetadata}
          onError={handleVideoError}
          aria-label="DealFlow360 interactive video demonstration"
        >
          <source src="/videos/dealflow-hero.mp4" type="video/mp4" />
          Your browser does not support HTML5 video playback.
        </video>

        {/* End of Scroll Redirect Prompt Overlay */}
        {scrollProgress >= 0.75 && (
          <div 
            className="scroll-end-overlay"
            onClick={(e) => {
              e.stopPropagation();
              if (onNavigateToLogin) onNavigateToLogin();
            }}
          >
            <button className="btn-enter-login" aria-label="Click to Log In">
              <span>Click Anywhere to Log In</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        )}

=======
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
>>>>>>> 2ca274a4a1f288334fa6ccd6f2926b3ef4865720
      </div>
    </section>
  );
}
