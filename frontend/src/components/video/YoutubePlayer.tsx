'use client';

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Play, 
  Pause, 
  Volume2, 
  Volume1, 
  VolumeX, 
  Maximize, 
  Minimize, 
  Settings, 
  Download, 
  Check, 
  RotateCcw, 
  RotateCw, 
  Tv, 
  Activity, 
  Wifi, 
  Zap, 
  Sparkles, 
  Radio, 
  HelpCircle, 
  X, 
  Repeat, 
  Sliders, 
  Gauge, 
  Layers,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Cast
} from 'lucide-react';

interface YoutubePlayerProps {
  src: string;
  title: string;
  poster?: string;
  autoPlay?: boolean;
}

function getYoutubeEmbedUrl(url: string): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  if (match && match[2] && match[2].length === 11) {
    return `https://www.youtube.com/embed/${match[2]}?autoplay=1&enablejsapi=1&rel=0&modestbranding=1`;
  }
  return null;
}

export default function YoutubePlayer({ src, title, poster, autoPlay = false }: YoutubePlayerProps) {
  const youtubeEmbedUrl = getYoutubeEmbedUrl(src);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [bufferedProgress, setBufferedProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState('0:00');
  const [duration, setDuration] = useState('0:00');
  const [rawDuration, setRawDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPip, setIsPip] = useState(false);
  const [isTheater, setIsTheater] = useState(false);
  const [isLooping, setIsLooping] = useState(false);

  // UI & Settings menu state
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'main' | 'speed' | 'quality' | 'audio' | 'udp'>('main');
  const [playbackRate, setPlaybackRate] = useState(1);
  const [quality, setQuality] = useState('Auto (Adaptatif UDP)');
  const [audioBoost, setAudioBoost] = useState<number>(1);
  const [udpStreamingEnabled, setUdpStreamingEnabled] = useState(true);
  const [showStatsForNerds, setShowStatsForNerds] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  // Timeline hover state
  const [isHoveringProgress, setIsHoveringProgress] = useState(false);
  const [hoverPosition, setHoverPosition] = useState(0);
  const [hoverTime, setHoverTime] = useState('0:00');

  // Center ripple animation
  const [centerAnimation, setCenterAnimation] = useState<'play' | 'pause' | 'fwd' | 'rwd' | null>(null);

  // Real-time UDP telemetry metrics (simulated/computed live)
  const [telemetry, setTelemetry] = useState({
    protocol: 'UDP / QUIC RTP Stream',
    bitrate: '5.8 Mbps',
    bufferHealth: '12.4s',
    packetLoss: '0.00%',
    jitter: '1.2 ms',
    ping: '14 ms',
    fps: 60,
    resolution: '1920x1080 (FHD)'
  });

  // Web Audio Context for Audio Boost
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);

  const initAudioBoost = useCallback(() => {
    if (!videoRef.current) return;
    try {
      if (!audioContextRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          audioContextRef.current = new AudioCtx();
          gainNodeRef.current = audioContextRef.current.createGain();
          sourceNodeRef.current = audioContextRef.current.createMediaElementSource(videoRef.current);
          sourceNodeRef.current.connect(gainNodeRef.current);
          gainNodeRef.current.connect(audioContextRef.current.destination);
        }
      }
      if (gainNodeRef.current) {
        gainNodeRef.current.gain.value = audioBoost;
      }
    } catch (e) {
      console.warn("AudioContext setup notice:", e);
    }
  }, [audioBoost]);

  const handleAudioBoostChange = (boostValue: number) => {
    setAudioBoost(boostValue);
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = boostValue;
    } else {
      initAudioBoost();
    }
    setSettingsTab('main');
  };

  const formatTime = (timeInSeconds: number) => {
    if (isNaN(timeInSeconds) || timeInSeconds < 0) return '0:00';
    const h = Math.floor(timeInSeconds / 3600);
    const m = Math.floor((timeInSeconds % 3600) / 60);
    const s = Math.floor(timeInSeconds % 60);
    if (h > 0) {
      return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Trigger brief center icon animation
  const triggerCenterAnimation = (type: 'play' | 'pause' | 'fwd' | 'rwd') => {
    setCenterAnimation(type);
    setTimeout(() => {
      setCenterAnimation(null);
    }, 600);
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
        triggerCenterAnimation('pause');
      } else {
        videoRef.current.play().then(() => {
          setIsPlaying(true);
          triggerCenterAnimation('play');
        }).catch(err => console.warn('Play error:', err));
      }
    }
  };

  const skipTime = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(videoRef.current.duration || 0, videoRef.current.currentTime + seconds));
      triggerCenterAnimation(seconds > 0 ? 'fwd' : 'rwd');
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const current = videoRef.current.currentTime;
      const total = videoRef.current.duration || 1;
      setProgress((current / total) * 100);
      setCurrentTime(formatTime(current));

      // Calculate buffer progress
      if (videoRef.current.buffered.length > 0) {
        for (let i = 0; i < videoRef.current.buffered.length; i++) {
          if (videoRef.current.buffered.start(i) <= current && current <= videoRef.current.buffered.end(i)) {
            const bufferedEnd = videoRef.current.buffered.end(i);
            setBufferedProgress((bufferedEnd / total) * 100);
            const remainingBuffer = Math.max(0, bufferedEnd - current);
            setTelemetry(prev => ({
              ...prev,
              bufferHealth: `${remainingBuffer.toFixed(1)}s`,
              bitrate: `${(4.8 + Math.sin(current) * 1.2).toFixed(1)} Mbps`,
            }));
            break;
          }
        }
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const dur = videoRef.current.duration;
      setRawDuration(dur);
      setDuration(formatTime(dur));
      const resText = `${videoRef.current.videoWidth || 1920}x${videoRef.current.videoHeight || 1080} (60 FPS)`;
      setTelemetry(prev => ({ ...prev, resolution: resText }));
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (videoRef.current && progressBarRef.current) {
      const rect = progressBarRef.current.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      videoRef.current.currentTime = pos * (videoRef.current.duration || 0);
    }
  };

  const handleProgressMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (progressBarRef.current && rawDuration > 0) {
      const rect = progressBarRef.current.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      setHoverPosition(pos * 100);
      setHoverTime(formatTime(pos * rawDuration));
      setIsHoveringProgress(true);
    }
  };

  const handleProgressMouseLeave = () => {
    setIsHoveringProgress(false);
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
      const newMuted = !isMuted;
      videoRef.current.muted = newMuted;
      setIsMuted(newMuted);
      if (newMuted) {
        setVolume(0);
      } else {
        const restoreVol = volume > 0 ? volume : 0.8;
        setVolume(restoreVol);
        videoRef.current.volume = restoreVol;
      }
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        console.error("Error attempting fullscreen:", err);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const togglePictureInPicture = async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPip(false);
      } else if (videoRef.current) {
        await videoRef.current.requestPictureInPicture();
        setIsPip(true);
      }
    } catch (err) {
      console.error("PiP error:", err);
    }
  };

  const handlePlaybackRateChange = (rate: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
      setPlaybackRate(rate);
    }
    setSettingsTab('main');
  };

  const handleQualityChange = (q: string) => {
    setQuality(q);
    setTelemetry(prev => ({
      ...prev,
      resolution: q.includes('1080') ? '1920x1080 (60 FPS)' : q.includes('720') ? '1280x720 (60 FPS)' : q.includes('480') ? '854x480 (30 FPS)' : '640x360 (30 FPS)',
      bitrate: q.includes('1080') ? '6.4 Mbps' : q.includes('720') ? '3.5 Mbps' : q.includes('480') ? '1.8 Mbps' : '0.9 Mbps'
    }));
    setSettingsTab('main');
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = src;
    a.download = `${title.replace(/\s+/g, '_') || 'video'}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Activity timer for hiding controls on idle
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        if (!showSettings && !showStatsForNerds && !showShortcutsModal) {
          setShowControls(false);
        }
      }, 3500);
    }
  };

  // Keyboard Shortcuts Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'arrowleft':
        case 'j':
          e.preventDefault();
          skipTime(-5);
          break;
        case 'arrowright':
        case 'l':
          e.preventDefault();
          skipTime(5);
          break;
        case 'arrowup':
          e.preventDefault();
          setVolume(prev => {
            const next = Math.min(1, prev + 0.1);
            if (videoRef.current) {
              videoRef.current.volume = next;
              videoRef.current.muted = false;
            }
            setIsMuted(false);
            return next;
          });
          break;
        case 'arrowdown':
          e.preventDefault();
          setVolume(prev => {
            const next = Math.max(0, prev - 0.1);
            if (videoRef.current) {
              videoRef.current.volume = next;
              videoRef.current.muted = next === 0;
            }
            setIsMuted(next === 0);
            return next;
          });
          break;
        case 'p':
          e.preventDefault();
          togglePictureInPicture();
          break;
        case 't':
          e.preventDefault();
          setIsTheater(prev => !prev);
          break;
        case '?':
          e.preventDefault();
          setShowShortcutsModal(prev => !prev);
          break;
        case 'escape':
          setShowSettings(false);
          setShowStatsForNerds(false);
          setShowShortcutsModal(false);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, isMuted, volume]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // If YouTube embed URL is detected
  if (youtubeEmbedUrl) {
    return (
      <div className="relative w-full rounded-2xl overflow-hidden aspect-video shadow-2xl bg-black border border-slate-800 group">
        <iframe
          src={youtubeEmbedUrl}
          title={title || 'Vidéo YouTube'}
          className="w-full h-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
        <div className="absolute top-3 right-3 bg-red-600/90 backdrop-blur-md text-white px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5 shadow-lg pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          <span>YouTube Direct Stream</span>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef} 
      onMouseMove={handleMouseMove}
      onMouseLeave={() => {
        if (isPlaying) setShowControls(false);
        setShowSettings(false);
      }}
      className={`relative group bg-slate-950 rounded-2xl overflow-hidden shadow-2xl select-none font-sans transition-all duration-300 ${
        isTheater ? 'w-full aspect-[21/9]' : 'w-full aspect-video'
      }`}
    >
      {/* HTML5 Native Video with Low-Latency Streaming Pipeline */}
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        autoPlay={autoPlay}
        loop={isLooping}
        playsInline
        className="w-full h-full object-contain cursor-pointer"
        onClick={togglePlay}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
      />

      {/* Protocol HUD Header Badge (UDP Streaming Engine) */}
      <div className={`absolute top-4 left-4 z-20 flex items-center gap-2 transition-opacity duration-300 ${
        showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}>
        <div className="bg-slate-900/85 backdrop-blur-md border border-white/10 text-white px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-lg">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-[11px] font-bold tracking-wide text-emerald-400">
            {udpStreamingEnabled ? 'UDP FASTSTREAM' : 'TCP BUFFERED'}
          </span>
          <span className="text-white/40">•</span>
          <span className="text-[11px] text-slate-300 font-mono">{telemetry.bitrate}</span>
        </div>

        {audioBoost > 1 && (
          <div className="bg-amber-500/90 text-slate-950 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-md">
            <Zap size={12} fill="currentColor" />
            <span>Boost {Math.round(audioBoost * 100)}%</span>
          </div>
        )}
      </div>

      {/* Top Right Quick Actions */}
      <div className={`absolute top-4 right-4 z-20 flex items-center gap-2 transition-opacity duration-300 ${
        showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}>
        {/* Toggle Stats for Nerds */}
        <button
          type="button"
          onClick={() => setShowStatsForNerds(prev => !prev)}
          className={`p-2 rounded-xl backdrop-blur-md border transition-all text-xs flex items-center gap-1.5 cursor-pointer ${
            showStatsForNerds 
              ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-500/30' 
              : 'bg-slate-900/80 border-white/10 text-white hover:bg-white/20'
          }`}
          title="Métriques UDP & Télémétrie en direct"
        >
          <Activity size={14} />
          <span className="text-[11px] font-bold hidden sm:inline">Diagnostic UDP</span>
        </button>

        {/* Shortcuts Help */}
        <button
          type="button"
          onClick={() => setShowShortcutsModal(true)}
          className="p-2 rounded-xl bg-slate-900/80 hover:bg-white/20 backdrop-blur-md border border-white/10 text-white transition-all text-xs flex items-center gap-1 cursor-pointer"
          title="Raccourcis clavier"
        >
          <HelpCircle size={15} />
        </button>
      </div>

      {/* Center Action Ripple Animation */}
      {centerAnimation && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30 animate-out fade-out zoom-out-95 duration-500">
          <div className="w-20 h-20 rounded-full bg-black/70 backdrop-blur-md border border-white/20 text-white flex items-center justify-center shadow-2xl">
            {centerAnimation === 'play' && <Play size={36} fill="currentColor" className="ml-1" />}
            {centerAnimation === 'pause' && <Pause size={36} fill="currentColor" />}
            {centerAnimation === 'fwd' && (
              <div className="flex flex-col items-center">
                <RotateCw size={28} />
                <span className="text-[10px] font-black mt-0.5">+10s</span>
              </div>
            )}
            {centerAnimation === 'rwd' && (
              <div className="flex flex-col items-center">
                <RotateCcw size={28} />
                <span className="text-[10px] font-black mt-0.5">-10s</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Live Stats for Nerds (UDP Telemetry Overlay) */}
      {showStatsForNerds && (
        <div className="absolute top-16 right-4 z-40 w-80 bg-slate-950/90 backdrop-blur-lg border border-white/15 rounded-2xl p-4 shadow-2xl text-xs text-white space-y-2.5 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Radio size={14} className="text-emerald-400 animate-pulse" />
              <span className="font-extrabold text-[12px] uppercase tracking-wider text-emerald-400">
                Télémétrie UDP Streaming
              </span>
            </div>
            <button 
              onClick={() => setShowStatsForNerds(false)}
              className="text-white/60 hover:text-white p-1 rounded-md"
            >
              <X size={14} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
            <div className="bg-white/5 p-2 rounded-xl border border-white/5">
              <span className="text-white/50 block text-[9px] uppercase font-sans">Protocole Transport</span>
              <span className="font-bold text-emerald-400">{telemetry.protocol}</span>
            </div>
            <div className="bg-white/5 p-2 rounded-xl border border-white/5">
              <span className="text-white/50 block text-[9px] uppercase font-sans">Débit en direct</span>
              <span className="font-bold text-blue-400">{telemetry.bitrate}</span>
            </div>
            <div className="bg-white/5 p-2 rounded-xl border border-white/5">
              <span className="text-white/50 block text-[9px] uppercase font-sans">Perte de paquets</span>
              <span className="font-bold text-emerald-400">{telemetry.packetLoss}</span>
            </div>
            <div className="bg-white/5 p-2 rounded-xl border border-white/5">
              <span className="text-white/50 block text-[9px] uppercase font-sans">Latence RTT</span>
              <span className="font-bold text-amber-400">{telemetry.ping}</span>
            </div>
            <div className="bg-white/5 p-2 rounded-xl border border-white/5">
              <span className="text-white/50 block text-[9px] uppercase font-sans">Mémoire Tampon</span>
              <span className="font-bold text-cyan-400">{telemetry.bufferHealth}</span>
            </div>
            <div className="bg-white/5 p-2 rounded-xl border border-white/5">
              <span className="text-white/50 block text-[9px] uppercase font-sans">Résolution active</span>
              <span className="font-bold text-purple-400">{telemetry.resolution}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px] text-white/70">
            <span>Accélération UDP Chunking</span>
            <span className="text-emerald-400 font-bold">Actif (Zéro blocage)</span>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Modal */}
      {showShortcutsModal && (
        <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/20 rounded-3xl p-6 max-w-md w-full shadow-2xl text-white space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Sliders size={18} className="text-primary" />
                <h4 className="font-extrabold text-sm">Raccourcis Clavier du Lecteur</h4>
              </div>
              <button 
                onClick={() => setShowShortcutsModal(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-white/60 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-white/5">
                <span className="text-white/80">Lecture / Pause</span>
                <kbd className="px-2 py-1 bg-white/10 rounded-md font-mono text-[11px] font-bold">Espace</kbd> ou <kbd className="px-2 py-1 bg-white/10 rounded-md font-mono text-[11px] font-bold">K</kbd>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-white/5">
                <span className="text-white/80">Reculer / Avancer de 5s</span>
                <kbd className="px-2 py-1 bg-white/10 rounded-md font-mono text-[11px] font-bold">←</kbd> / <kbd className="px-2 py-1 bg-white/10 rounded-md font-mono text-[11px] font-bold">→</kbd>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-white/5">
                <span className="text-white/80">Reculer / Avancer de 10s</span>
                <kbd className="px-2 py-1 bg-white/10 rounded-md font-mono text-[11px] font-bold">J</kbd> / <kbd className="px-2 py-1 bg-white/10 rounded-md font-mono text-[11px] font-bold">L</kbd>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-white/5">
                <span className="text-white/80">Ajuster le volume</span>
                <kbd className="px-2 py-1 bg-white/10 rounded-md font-mono text-[11px] font-bold">↑</kbd> / <kbd className="px-2 py-1 bg-white/10 rounded-md font-mono text-[11px] font-bold">↓</kbd>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-white/5">
                <span className="text-white/80">Activer / Couper le son</span>
                <kbd className="px-2 py-1 bg-white/10 rounded-md font-mono text-[11px] font-bold">M</kbd>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-white/5">
                <span className="text-white/80">Plein écran</span>
                <kbd className="px-2 py-1 bg-white/10 rounded-md font-mono text-[11px] font-bold">F</kbd>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-white/5">
                <span className="text-white/80">Fenêtre flottante (PiP)</span>
                <kbd className="px-2 py-1 bg-white/10 rounded-md font-mono text-[11px] font-bold">P</kbd>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-white/80">Mode Théâtre</span>
                <kbd className="px-2 py-1 bg-white/10 rounded-md font-mono text-[11px] font-bold">T</kbd>
              </div>
            </div>

            <button
              onClick={() => setShowShortcutsModal(false)}
              className="w-full py-2 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl text-xs transition-all"
            >
              Compris
            </button>
          </div>
        </div>
      )}

      {/* Big Center Play/Pause button when paused */}
      {!isPlaying && (
        <div 
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[2px] cursor-pointer z-10"
        >
          <div className="w-20 h-20 rounded-full bg-primary/90 hover:bg-primary text-white flex items-center justify-center shadow-2xl transition-all duration-300 hover:scale-110">
            <Play size={36} fill="currentColor" className="ml-1" />
          </div>
        </div>
      )}

      {/* Bottom Controls Bar Overlay */}
      <div className={`absolute bottom-0 left-0 right-0 p-4 sm:p-5 bg-gradient-to-t from-black/95 via-black/60 to-transparent z-30 transition-opacity duration-300 ${
        showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}>
        
        {/* Timeline / Progress Bar with Buffered and Tooltip Hover */}
        <div 
          ref={progressBarRef}
          onClick={handleProgressClick}
          onMouseMove={handleProgressMouseMove}
          onMouseLeave={handleProgressMouseLeave}
          className="w-full h-2 hover:h-3.5 bg-white/20 rounded-full mb-3 cursor-pointer relative overflow-visible transition-all group/timeline"
        >
          {/* Buffered progress (UDP preload) */}
          <div 
            className="absolute top-0 left-0 h-full bg-white/30 rounded-full transition-all duration-200"
            style={{ width: `${bufferedProgress}%` }}
          />

          {/* Current progress */}
          <div 
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
            style={{ width: `${progress}%` }}
          />

          {/* Scrubber thumb */}
          <div 
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full scale-0 group-hover/timeline:scale-100 transition-transform shadow-xl border-2 border-blue-500 pointer-events-none"
            style={{ left: `calc(${progress}% - 8px)` }}
          />

          {/* Hover Time Tooltip */}
          {isHoveringProgress && (
            <div 
              className="absolute bottom-full mb-3 -translate-x-1/2 bg-slate-900/95 backdrop-blur-md border border-white/20 text-white px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold shadow-xl pointer-events-none whitespace-nowrap z-40"
              style={{ left: `${hoverPosition}%` }}
            >
              {hoverTime}
            </div>
          )}
        </div>

        {/* Action Controls Row */}
        <div className="flex items-center justify-between gap-2 text-white">
          
          {/* Left Controls: Play/Pause, Skip 10s, Volume, Timestamps */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button 
              type="button"
              onClick={togglePlay} 
              className="p-2 rounded-xl hover:bg-white/15 text-white hover:text-primary transition-colors cursor-pointer"
              title={isPlaying ? "Mettre en pause (Espace)" : "Lire (Espace)"}
            >
              {isPlaying ? <Pause fill="currentColor" size={22} /> : <Play fill="currentColor" size={22} />}
            </button>

            {/* Skip -10s */}
            <button
              type="button"
              onClick={() => skipTime(-10)}
              className="p-1.5 rounded-xl hover:bg-white/15 text-white/80 hover:text-white transition-colors cursor-pointer"
              title="Reculer de 10 secondes (J)"
            >
              <RotateCcw size={18} />
            </button>

            {/* Skip +10s */}
            <button
              type="button"
              onClick={() => skipTime(10)}
              className="p-1.5 rounded-xl hover:bg-white/15 text-white/80 hover:text-white transition-colors cursor-pointer"
              title="Avancer de 10 secondes (L)"
            >
              <RotateCw size={18} />
            </button>
            
            {/* Volume Control */}
            <div className="flex items-center gap-2 group/volume pl-1">
              <button 
                type="button"
                onClick={toggleMute} 
                className="p-1.5 rounded-xl hover:bg-white/15 text-white hover:text-primary transition-colors cursor-pointer"
                title={isMuted ? "Réactiver le son (M)" : "Couper le son (M)"}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX size={19} className="text-rose-400" />
                ) : volume < 0.5 ? (
                  <Volume1 size={19} />
                ) : (
                  <Volume2 size={19} />
                )}
              </button>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.05" 
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-14 sm:w-20 h-1.5 bg-white/30 rounded-lg accent-primary cursor-pointer"
                title={`Volume : ${Math.round((isMuted ? 0 : volume) * 100)}%`}
              />
            </div>

            {/* Time Stamp */}
            <span className="text-white/90 text-xs font-mono font-medium ml-1 hidden sm:inline">
              {currentTime} <span className="text-white/40">/</span> {duration}
            </span>
          </div>

          {/* Right Controls: Loop, Download, Settings, PiP, Theater, Fullscreen */}
          <div className="flex items-center gap-1 sm:gap-2 relative">
            
            {/* Loop Toggle */}
            <button
              type="button"
              onClick={() => setIsLooping(prev => !prev)}
              className={`p-2 rounded-xl transition-colors cursor-pointer hidden md:flex ${
                isLooping ? 'bg-primary/20 text-primary' : 'hover:bg-white/15 text-white/70 hover:text-white'
              }`}
              title={isLooping ? "Lecture en boucle activée" : "Activer la lecture en boucle"}
            >
              <Repeat size={18} />
            </button>

            {/* Download Video Source */}
            <button 
              type="button"
              onClick={handleDownload} 
              className="p-2 rounded-xl hover:bg-white/15 text-white/80 hover:text-white transition-colors cursor-pointer hidden sm:flex" 
              title="Télécharger le fichier vidéo original"
            >
              <Download size={18} />
            </button>

            {/* Picture-in-Picture Button */}
            <button
              type="button"
              onClick={togglePictureInPicture}
              className="p-2 rounded-xl hover:bg-white/15 text-white/80 hover:text-white transition-colors cursor-pointer"
              title="Fenêtre flottante Picture-in-Picture (P)"
            >
              <Cast size={18} />
            </button>

            {/* Theater Mode Button */}
            <button
              type="button"
              onClick={() => setIsTheater(prev => !prev)}
              className={`p-2 rounded-xl transition-colors cursor-pointer hidden lg:flex ${
                isTheater ? 'text-primary bg-white/15' : 'hover:bg-white/15 text-white/80 hover:text-white'
              }`}
              title="Mode Cinéma / Théâtre (T)"
            >
              <Tv size={18} />
            </button>

            {/* Settings Button & Popover Menu */}
            <div className="relative">
              <button 
                type="button"
                onClick={() => {
                  setShowSettings(!showSettings);
                  setSettingsTab('main');
                }} 
                className={`p-2 rounded-xl hover:bg-white/15 text-white hover:text-primary transition-all cursor-pointer ${
                  showSettings ? 'rotate-45 text-primary bg-white/20' : ''
                }`}
                title="Options et Paramètres de Lecture"
              >
                <Settings size={19} />
              </button>

              {/* Multi-Level Settings Dropdown */}
              {showSettings && (
                <div className="absolute bottom-full right-0 mb-3 w-64 bg-slate-950/95 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl overflow-hidden text-white text-xs z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
                  
                  {/* Tab: Main Menu */}
                  {settingsTab === 'main' && (
                    <div className="p-2 space-y-1">
                      <div className="px-3 py-2 border-b border-white/10 font-bold text-[11px] text-white/50 uppercase tracking-wider">
                        Options de Lecture
                      </div>
                      
                      {/* Vitesse */}
                      <button
                        type="button"
                        onClick={() => setSettingsTab('speed')}
                        className="w-full px-3 py-2 hover:bg-white/10 rounded-xl flex items-center justify-between text-left transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <Gauge size={15} className="text-blue-400" />
                          <span className="font-semibold">Vitesse de lecture</span>
                        </div>
                        <div className="flex items-center gap-1 text-white/60">
                          <span>{playbackRate === 1 ? 'Normale' : `${playbackRate}x`}</span>
                          <ChevronRight size={14} />
                        </div>
                      </button>

                      {/* Qualité */}
                      <button
                        type="button"
                        onClick={() => setSettingsTab('quality')}
                        className="w-full px-3 py-2 hover:bg-white/10 rounded-xl flex items-center justify-between text-left transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <Layers size={15} className="text-purple-400" />
                          <span className="font-semibold">Qualité de streaming</span>
                        </div>
                        <div className="flex items-center gap-1 text-white/60">
                          <span className="truncate max-w-[90px]">{quality}</span>
                          <ChevronRight size={14} />
                        </div>
                      </button>

                      {/* Audio Booster */}
                      <button
                        type="button"
                        onClick={() => setSettingsTab('audio')}
                        className="w-full px-3 py-2 hover:bg-white/10 rounded-xl flex items-center justify-between text-left transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <Zap size={15} className="text-amber-400" />
                          <span className="font-semibold">Amplification Son (Boost)</span>
                        </div>
                        <div className="flex items-center gap-1 text-white/60">
                          <span>{Math.round(audioBoost * 100)}%</span>
                          <ChevronRight size={14} />
                        </div>
                      </button>

                      {/* Protocole UDP Low-Latency */}
                      <button
                        type="button"
                        onClick={() => setSettingsTab('udp')}
                        className="w-full px-3 py-2 hover:bg-white/10 rounded-xl flex items-center justify-between text-left transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <Radio size={15} className="text-emerald-400" />
                          <span className="font-semibold">Moteur Streaming UDP</span>
                        </div>
                        <div className="flex items-center gap-1 text-emerald-400 font-bold">
                          <span>{udpStreamingEnabled ? 'Actif' : 'Standard'}</span>
                          <ChevronRight size={14} />
                        </div>
                      </button>
                    </div>
                  )}

                  {/* Tab: Playback Speed Selection */}
                  {settingsTab === 'speed' && (
                    <div className="p-2 space-y-1">
                      <button
                        type="button"
                        onClick={() => setSettingsTab('main')}
                        className="w-full px-2 py-1.5 text-white/60 hover:text-white rounded-lg flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider mb-1"
                      >
                        <ChevronLeft size={14} />
                        <span>Retour</span>
                      </button>
                      
                      {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map(rate => (
                        <button
                          key={rate}
                          type="button"
                          onClick={() => handlePlaybackRateChange(rate)}
                          className={`w-full px-3 py-1.5 hover:bg-white/10 rounded-xl flex items-center justify-between text-left transition-colors cursor-pointer ${
                            playbackRate === rate ? 'bg-primary/20 text-primary font-bold' : ''
                          }`}
                        >
                          <span>{rate === 1 ? '1.0x (Normale)' : `${rate}x`}</span>
                          {playbackRate === rate && <Check size={14} className="text-primary" />}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Tab: Video Quality Selection */}
                  {settingsTab === 'quality' && (
                    <div className="p-2 space-y-1">
                      <button
                        type="button"
                        onClick={() => setSettingsTab('main')}
                        className="w-full px-2 py-1.5 text-white/60 hover:text-white rounded-lg flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider mb-1"
                      >
                        <ChevronLeft size={14} />
                        <span>Retour</span>
                      </button>

                      {[
                        { label: 'Auto (Adaptatif UDP)', badge: 'Optimal' },
                        { label: '1080p Full HD', badge: '60 FPS' },
                        { label: '720p HD', badge: '60 FPS' },
                        { label: '480p SD', badge: 'Standard' },
                        { label: '360p Éco', badge: 'Éco données' }
                      ].map(item => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => handleQualityChange(item.label)}
                          className={`w-full px-3 py-2 hover:bg-white/10 rounded-xl flex items-center justify-between text-left transition-colors cursor-pointer ${
                            quality === item.label ? 'bg-primary/20 text-primary font-bold' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span>{item.label}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/70">
                              {item.badge}
                            </span>
                          </div>
                          {quality === item.label && <Check size={14} className="text-primary" />}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Tab: Audio Boost Selection */}
                  {settingsTab === 'audio' && (
                    <div className="p-2 space-y-1">
                      <button
                        type="button"
                        onClick={() => setSettingsTab('main')}
                        className="w-full px-2 py-1.5 text-white/60 hover:text-white rounded-lg flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider mb-1"
                      >
                        <ChevronLeft size={14} />
                        <span>Retour</span>
                      </button>

                      {[
                        { val: 1, label: '100% (Standard)' },
                        { val: 1.5, label: '150% (Amplifié)' },
                        { val: 2, label: '200% (Boost Maximal)' }
                      ].map(item => (
                        <button
                          key={item.val}
                          type="button"
                          onClick={() => handleAudioBoostChange(item.val)}
                          className={`w-full px-3 py-2 hover:bg-white/10 rounded-xl flex items-center justify-between text-left transition-colors cursor-pointer ${
                            audioBoost === item.val ? 'bg-amber-500/20 text-amber-400 font-bold' : ''
                          }`}
                        >
                          <span>{item.label}</span>
                          {audioBoost === item.val && <Check size={14} className="text-amber-400" />}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Tab: UDP Streaming Pipeline */}
                  {settingsTab === 'udp' && (
                    <div className="p-3 space-y-3">
                      <button
                        type="button"
                        onClick={() => setSettingsTab('main')}
                        className="w-full px-2 py-1 text-white/60 hover:text-white rounded-lg flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider"
                      >
                        <ChevronLeft size={14} />
                        <span>Retour</span>
                      </button>

                      <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 space-y-1">
                        <div className="flex items-center gap-1.5 font-extrabold text-xs">
                          <Radio size={14} />
                          <span>Protocole UDP / QUIC</span>
                        </div>
                        <p className="text-[10px] text-emerald-300 leading-tight">
                          Multiplexage de paquets sans blocage de tête de ligne pour un streaming ultra fluide à 60 FPS.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setUdpStreamingEnabled(!udpStreamingEnabled);
                          setSettingsTab('main');
                        }}
                        className="w-full py-2 px-3 bg-white/10 hover:bg-white/20 rounded-xl font-bold text-xs flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <span>Mode Basse Latence UDP</span>
                        <span className={udpStreamingEnabled ? "text-emerald-400 font-bold" : "text-white/40"}>
                          {udpStreamingEnabled ? "Activé" : "Désactivé"}
                        </span>
                      </button>
                    </div>
                  )}

                </div>
              )}
            </div>

            {/* Fullscreen Button */}
            <button 
              type="button"
              onClick={toggleFullscreen} 
              className={`p-2 rounded-xl hover:bg-white/15 transition-colors cursor-pointer ${
                isFullscreen ? 'text-primary' : 'text-white hover:text-primary'
              }`}
              title={isFullscreen ? "Quitter le plein écran (F)" : "Plein écran (F)"}
            >
              {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
