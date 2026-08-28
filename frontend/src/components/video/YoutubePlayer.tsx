'use client';

import React, { useRef, useState, useEffect } from 'react';
import { 
  Play, Pause, Volume2, VolumeX, Maximize, Settings, 
  Download, Check
} from 'lucide-react';

interface YoutubePlayerProps {
  src: string;
  title: string;
}

export default function YoutubePlayer({ src, title }: YoutubePlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState('0:00');
  const [duration, setDuration] = useState('0:00');
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [showSettings, setShowSettings] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [quality, setQuality] = useState('Auto'); // Simulated quality

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const current = videoRef.current.currentTime;
      const total = videoRef.current.duration;
      setProgress((current / total) * 100);
      setCurrentTime(formatTime(current));
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(formatTime(videoRef.current.duration));
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (videoRef.current && containerRef.current) {
      const rect = e.currentTarget.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / rect.width;
      videoRef.current.currentTime = pos * videoRef.current.duration;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
    }
    setIsMuted(val === 0);
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
      if (!isMuted) setVolume(0);
      else setVolume(1);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        console.error("Error attempting to enable fullscreen:", err);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const formatTime = (timeInSeconds: number) => {
    const m = Math.floor(timeInSeconds / 60);
    const s = Math.floor(timeInSeconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handlePlaybackRateChange = (rate: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
      setPlaybackRate(rate);
    }
    setShowSettings(false);
  };

  const handleQualityChange = (q: string) => {
    setQuality(q);
    setShowSettings(false);
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = src;
    a.download = title || 'video.mp4';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div 
      ref={containerRef} 
      className="relative group bg-black rounded-2xl overflow-hidden aspect-video shadow-2xl"
      onMouseLeave={() => setShowSettings(false)}
    >
      <video
        ref={videoRef}
        src={src}
        className="w-full h-full object-contain cursor-pointer"
        onClick={togglePlay}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
      />

      {/* Controls Overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        
        {/* Progress Bar */}
        <div 
          className="w-full h-1.5 bg-white/30 rounded-full mb-4 cursor-pointer relative overflow-hidden group/progress"
          onClick={handleProgressClick}
        >
          <div 
            className="absolute top-0 left-0 h-full bg-primary"
            style={{ width: `${progress}%` }}
          />
          <div 
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full scale-0 group-hover/progress:scale-100 transition-transform shadow-lg"
            style={{ left: `calc(${progress}% - 6px)` }}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={togglePlay} className="text-white hover:text-primary transition-colors">
              {isPlaying ? <Pause fill="currentColor" size={24} /> : <Play fill="currentColor" size={24} />}
            </button>
            
            <div className="flex items-center gap-2 group/volume">
              <button onClick={toggleMute} className="text-white hover:text-primary transition-colors">
                {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
              <input 
                type="range" 
                min="0" max="1" step="0.1" 
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-0 group-hover/volume:w-20 transition-all duration-300 origin-left accent-primary"
              />
            </div>

            <span className="text-white text-sm font-medium ml-2">
              {currentTime} / {duration}
            </span>
          </div>

          <div className="flex items-center gap-4 relative">
            
            {/* Download Button */}
            <button onClick={handleDownload} className="text-white hover:text-primary transition-colors" title="Télécharger la vidéo">
              <Download size={20} />
            </button>

            {/* Settings Button */}
            <div className="relative">
              <button 
                onClick={() => setShowSettings(!showSettings)} 
                className={`text-white hover:text-primary transition-transform ${showSettings ? 'rotate-90' : ''}`}
              >
                <Settings size={20} />
              </button>

              {/* Settings Menu */}
              {showSettings && (
                <div className="absolute bottom-full right-0 mb-4 w-48 bg-black/90 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl overflow-hidden text-white text-sm z-50">
                  <div className="p-2 border-b border-white/10">
                    <p className="px-2 py-1 text-xs text-gray-400 font-semibold uppercase">Vitesse</p>
                    {[0.5, 1, 1.25, 1.5, 2].map(rate => (
                      <button 
                        key={rate}
                        onClick={() => handlePlaybackRateChange(rate)}
                        className="w-full text-left px-3 py-1.5 hover:bg-white/10 rounded-lg flex items-center justify-between"
                      >
                        <span>{rate === 1 ? 'Normale' : `${rate}x`}</span>
                        {playbackRate === rate && <Check size={14} className="text-primary" />}
                      </button>
                    ))}
                  </div>
                  <div className="p-2">
                    <p className="px-2 py-1 text-xs text-gray-400 font-semibold uppercase">Qualité</p>
                    {['Auto', '1080p', '720p', '480p'].map(q => (
                      <button 
                        key={q}
                        onClick={() => handleQualityChange(q)}
                        className="w-full text-left px-3 py-1.5 hover:bg-white/10 rounded-lg flex items-center justify-between"
                      >
                        <span>{q}</span>
                        {quality === q && <Check size={14} className="text-primary" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button onClick={toggleFullscreen} className="text-white hover:text-primary transition-colors">
              <Maximize size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
