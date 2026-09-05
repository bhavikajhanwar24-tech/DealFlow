import React, { useRef, useEffect, useState, useCallback } from 'react';
import './ScrollVideoHero.css';

export default function ScrollVideoHero({ onNavigateToLogin }) {
  const sectionRef = useRef(null);
  const videoRef = useRef(null);
  const rafIdRef = useRef(null);
  const durationRef = useRef(0);
  const isLoadedRef = useRef(false);

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

    let progress = currentScroll / maxScroll;
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

      </div>
    </section>
  );
}
