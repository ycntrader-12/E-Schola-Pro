'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  MonitorUp, 
  MonitorX, 
  PhoneOff, 
  Hand, 
  MessageSquare, 
  Users as UsersIcon, 
  Shield, 
  Radio, 
  Send, 
  AlertCircle, 
  CheckCircle2, 
  Settings, 
  Info,
  Maximize2,
  Copy,
  Check,
  Paperclip,
  FileText,
  Music,
  Film,
  Download,
  X,
  Lock,
  FileSpreadsheet,
  Loader2,
  Split,
  Layers,
  Timer,
  Bell,
  ArrowRight,
  LogOut,
  Shuffle,
  Eye,
  Plus,
  SwitchCamera,
  Smartphone,
  Clock,
  Trash2,
  ChevronLeft
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import BackButton from '@/components/BackButton';

interface ClassroomInfo {
  id: number;
  room_id: string;
  title: string;
  description?: string;
  instructor_id: number;
  is_active: boolean;
  instructor?: { email: string; role: string };
}

interface ChatAttachment {
  url: string;
  filename: string;
  category: 'document' | 'audio' | 'video' | 'image';
  ext: string;
}

interface ChatMessage {
  id: string;
  sender: string;
  sender_role?: string;
  text?: string;
  time: string;
  isMe: boolean;
  recipient: string; // 'everyone', user email, or 'subgroup:ID'
  subgroup_id?: string;
  attachment?: ChatAttachment;
}

interface SubGroup {
  id: string;
  name: string;
  members: string[]; // emails
}

interface RoomSubgroupsState {
  is_active: boolean;
  timer_minutes: number;
  subgroups: SubGroup[];
  launched_by?: string;
}

export default function VirtualClassroomLivePage() {
  const params = useParams();
  const router = useRouter();
  const roomId = (params?.id as string)?.toLowerCase();

  // Classroom & User state
  const [classroom, setClassroom] = useState<ClassroomInfo | null>(null);
  const [currentUser, setCurrentUser] = useState<{ email: string; role: string } | null>(null);
  const [isLoadingRoom, setIsLoadingRoom] = useState(true);
  const [roomError, setRoomError] = useState('');

  // Mobile detection & facing mode (Front / Back camera)
  const [isMobile, setIsMobile] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isFlippingCamera, setIsFlippingCamera] = useState(false);

  // Media Devices state
  const [mediaPermissionRequested, setMediaPermissionRequested] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);

  // Side drawers (Chat & Participants)
  const [activeSidePanel, setActiveSidePanel] = useState<'chat' | 'participants' | null>(null);
  const [chatFilter, setChatFilter] = useState<'public' | 'private' | 'subgroup'>('public');
  const [targetRecipient, setTargetRecipient] = useState<string>('everyone');
  const [newMessage, setNewMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Participants in Room
  const [participantsList, setParticipantsList] = useState<Array<{ email: string; role: string; isOnline: boolean }>>([]);

  // Chat messages
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // Breakout Rooms / Sous-groupes state
  const [subgroupsState, setSubgroupsState] = useState<RoomSubgroupsState>({
    is_active: false,
    timer_minutes: 15,
    subgroups: []
  });
  const [showSubgroupModal, setShowSubgroupModal] = useState(false);
  const [subgroupCount, setSubgroupCount] = useState(2);
  const [subgroupTimer, setSubgroupTimer] = useState(15);
  const [stagedSubgroups, setStagedSubgroups] = useState<SubGroup[]>([]);
  const [currentActiveSubgroupId, setCurrentActiveSubgroupId] = useState<string | null>(null);

  // File input ref for chat attachments
  const chatFileInputRef = useRef<HTMLInputElement | null>(null);

  // Media Stream references
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  const isManager = ['formateur', 'admin', 'admin_manager', 'admin_limited', 'pedagogique'].includes(currentUser?.role || '');

  // Detect mobile screen & browser
  useEffect(() => {
    const checkMobile = () => {
      const ua = typeof navigator !== 'undefined' ? (navigator.userAgent || navigator.vendor || (window as any).opera) : '';
      const isMobileUA = /android|iphone|ipad|ipod|windows phone/i.test(ua);
      const isSmallScreen = typeof window !== 'undefined' && window.innerWidth <= 768;
      setIsMobile(isMobileUA || isSmallScreen);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 1. Fetch Room Info & Current User & Subgroups
  useEffect(() => {
    const init = async () => {
      try {
        const [userRes, roomRes, subgroupsRes, messagesRes, learnersRes] = await Promise.all([
          apiClient.get('/users/me'),
          apiClient.get(`/classrooms/${roomId}`),
          apiClient.get(`/classrooms/${roomId}/subgroups`).catch(() => ({ data: { is_active: false, timer_minutes: 15, subgroups: [] } })),
          apiClient.get(`/classrooms/${roomId}/messages`).catch(() => ({ data: [] })),
          apiClient.get('/attendance/learners').catch(() => ({ data: [] })),
          apiClient.post(`/classrooms/${roomId}/join`).catch(() => ({}))
        ]);

        setCurrentUser(userRes.data);
        setClassroom(roomRes.data);
        if (subgroupsRes.data) {
          setSubgroupsState(subgroupsRes.data);
        }

        if (learnersRes.data && learnersRes.data.length > 0) {
          const list = learnersRes.data.map((l: any) => ({
            email: l.email,
            role: l.role,
            isOnline: true
          }));
          setParticipantsList(list);
        }

        if (messagesRes.data && messagesRes.data.length > 0) {
          setChatMessages(prev => {
            const existingIds = new Set(prev.map(m => m.id));
            const newOnes = messagesRes.data.filter((m: any) => !existingIds.has(m.id)).map((m: any) => ({
              ...m,
              isMe: m.sender.toLowerCase() === userRes.data.email.toLowerCase()
            }));
            return [...prev, ...newOnes];
          });
        }
      } catch (err: any) {
        console.error(err);
        setRoomError(err?.response?.data?.detail || "Impossible d'accéder à la classe virtuelle.");
      } finally {
        setIsLoadingRoom(false);
      }
    };
    if (roomId) init();
  }, [roomId]);

  // Periodic poll for subgroups and messages
  useEffect(() => {
    if (!roomId) return;
    const interval = setInterval(async () => {
      try {
        const [subRes, msgRes] = await Promise.all([
          apiClient.get(`/classrooms/${roomId}/subgroups`),
          apiClient.get(`/classrooms/${roomId}/messages`)
        ]);

        if (subRes.data) {
          setSubgroupsState(subRes.data);
          if (subRes.data.is_active && currentUser) {
            const mySg = subRes.data.subgroups.find((sg: SubGroup) => 
              sg.members.some(m => m.toLowerCase() === currentUser.email.toLowerCase())
            );
            if (mySg && !currentActiveSubgroupId) {
              setCurrentActiveSubgroupId(mySg.id);
            } else if (!subRes.data.is_active) {
              setCurrentActiveSubgroupId(null);
            }
          } else if (!subRes.data.is_active) {
            setCurrentActiveSubgroupId(null);
          }
        }

        if (msgRes.data && msgRes.data.length > 0 && currentUser) {
          setChatMessages(prev => {
            const existingIds = new Set(prev.map(m => m.id));
            const fresh = msgRes.data.filter((m: any) => !existingIds.has(m.id)).map((m: any) => ({
              ...m,
              isMe: m.sender.toLowerCase() === currentUser.email.toLowerCase()
            }));
            return [...prev, ...fresh];
          });
        }
      } catch {}
    }, 4000);
    return () => clearInterval(interval);
  }, [roomId, currentUser, currentActiveSubgroupId]);

  // 2. Request Camera and Microphone with Mobile Cross-Browser Compatibility
  const startCameraAndMic = async (targetFacing: 'user' | 'environment' = facingMode) => {
    setPermissionError(null);
    setMediaPermissionRequested(true);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Votre navigateur ne supporte pas l'accès caméra et micro. Veuillez utiliser Safari sur iOS ou Chrome sur Android.");
      }

      let stream: MediaStream;

      // Tier 1: Try with high quality & preferred facing mode (iOS/Android compatible)
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: targetFacing },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
      } catch (tier1Err) {
        // Tier 2: Fallback to basic constraints (for budget smartphones or strict mobile webviews)
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: targetFacing },
          audio: true
        }).catch(() => navigator.mediaDevices.getUserMedia({ video: true, audio: true }));
      }

      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        // Explicitly play for mobile Safari/WebKit policies
        localVideoRef.current.play().catch(() => {});
      }
      setIsCameraOff(false);
      setIsMicMuted(false);
    } catch (err: any) {
      console.warn("Camera/Mic permission status:", err?.name, err?.message);
      setIsCameraOff(true);
      setIsMicMuted(true);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionError("L'accès à la caméra ou au micro n'a pas été autorisé. Sur mobile, appuyez sur l'icône 'aA' ou le cadenas dans la barre d'adresse pour autoriser Caméra & Microphone.");
      } else if (err.name === 'NotFoundError') {
        setPermissionError("Aucune caméra ou microphone détecté sur cet appareil mobile.");
      } else {
        setPermissionError("Périphériques en attente. Appuyez sur 'Activer' pour autoriser l'accès.");
      }
    }
  };

  useEffect(() => {
    if (!isLoadingRoom && classroom) {
      startCameraAndMic();
    }
    return () => {
      stopAllMedia();
    };
  }, [isLoadingRoom, classroom]);

  const stopAllMedia = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
  };

  // 3. Toggle Microphone
  const toggleMicrophone = () => {
    if (!localStreamRef.current) {
      startCameraAndMic();
      return;
    }
    const audioTracks = localStreamRef.current.getAudioTracks();
    if (audioTracks.length > 0) {
      const nextState = !audioTracks[0].enabled;
      audioTracks.forEach(track => { track.enabled = nextState; });
      setIsMicMuted(!nextState);
    }
  };

  // 4. Toggle Camera
  const toggleCamera = () => {
    if (!localStreamRef.current) {
      startCameraAndMic();
      return;
    }
    const videoTracks = localStreamRef.current.getVideoTracks();
    if (videoTracks.length > 0) {
      const nextState = !videoTracks[0].enabled;
      videoTracks.forEach(track => { track.enabled = nextState; });
      setIsCameraOff(!nextState);
    }
  };

  // 5. Flip Camera on Mobile (Front <-> Rear)
  const handleFlipCamera = async () => {
    if (isFlippingCamera) return;
    setIsFlippingCamera(true);

    const nextFacing = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextFacing);

    try {
      if (localStreamRef.current) {
        const oldVideoTracks = localStreamRef.current.getVideoTracks();
        oldVideoTracks.forEach(t => t.stop());
      }

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { exact: nextFacing } },
        audio: false
      }).catch(() => navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: nextFacing } },
        audio: false
      }));

      const newVideoTrack = newStream.getVideoTracks()[0];

      if (localStreamRef.current) {
        const oldTrack = localStreamRef.current.getVideoTracks()[0];
        if (oldTrack) localStreamRef.current.removeTrack(oldTrack);
        localStreamRef.current.addTrack(newVideoTrack);
      } else {
        localStreamRef.current = newStream;
      }

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
        localVideoRef.current.play().catch(() => {});
      }
      setIsCameraOff(false);
    } catch (err) {
      console.warn("Camera flip error:", err);
    } finally {
      setIsFlippingCamera(false);
    }
  };

  // 6. Toggle Screen Sharing (Mobile & Desktop Compatible)
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      stopScreenShare();
      return;
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        alert(
          "Le partage d'écran sur mobile est pris en charge sur Android (Chrome 107+) et iOS 15.1+ (Safari). Si votre navigateur ne l'autorise pas, vous pouvez envoyer vos documents directement dans le chat."
        );
        return;
      }

      // Mobile compatible getDisplayMedia call
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      });

      screenStreamRef.current = stream;
      setIsScreenSharing(true);

      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = stream;
        screenVideoRef.current.play().catch(() => {});
      }

      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };
    } catch (err: any) {
      console.warn("Screen share status:", err);
      setIsScreenSharing(false);
      if (err.name !== 'NotAllowedError') {
        alert("Impossible de démarrer le partage d'écran sur ce terminal mobile. Vérifiez les autorisations de capture d'écran de votre système.");
      }
    }
  };

  const stopScreenShare = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = null;
    }
    setIsScreenSharing(false);
  };

  // 7. Leave Room
  const handleLeaveClass = () => {
    stopAllMedia();
    router.push('/classroom');
  };

  // 8. Handle Chat Attachment
  const handleChatFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 250 * 1024 * 1024) {
      alert("Le fichier est trop volumineux (taille maximale : 250 Mo).");
      return;
    }
    setSelectedFile(file);
  };

  // 9. Send Chat Message (Group, Private, or Subgroup)
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() && !selectedFile) return;

    let attachment: ChatAttachment | undefined = undefined;

    if (selectedFile) {
      setIsUploadingFile(true);
      try {
        const formData = new FormData();
        formData.append('file', selectedFile);
        const res = await apiClient.post('/upload/chat-file', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        attachment = {
          url: res.data.url,
          filename: res.data.filename,
          category: res.data.category,
          ext: res.data.ext
        };
      } catch (err) {
        console.error("Upload error:", err);
        alert("Erreur lors de l'envoi de la pièce jointe.");
        setIsUploadingFile(false);
        return;
      } finally {
        setIsUploadingFile(false);
      }
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let finalRecipient = targetRecipient;
    let finalSubgroupId: string | undefined = undefined;

    if (chatFilter === 'public') {
      finalRecipient = 'everyone';
    } else if (chatFilter === 'subgroup') {
      finalRecipient = `subgroup:${currentActiveSubgroupId || 'default'}`;
      finalSubgroupId = currentActiveSubgroupId || 'default';
    }

    const msgPayload = {
      text: newMessage.trim(),
      time: timeStr,
      recipient: finalRecipient,
      subgroup_id: finalSubgroupId,
      attachment
    };

    try {
      const res = await apiClient.post(`/classrooms/${roomId}/messages`, msgPayload);
      const newMsg: ChatMessage = {
        id: res.data.id,
        sender: currentUser?.email || 'Moi',
        sender_role: currentUser?.role,
        text: newMessage.trim(),
        time: timeStr,
        isMe: true,
        recipient: finalRecipient,
        subgroup_id: finalSubgroupId,
        attachment
      };
      setChatMessages(prev => [...prev, newMsg]);
    } catch {
      const localMsg: ChatMessage = {
        id: String(Date.now()),
        sender: currentUser?.email || 'Moi',
        text: newMessage.trim(),
        time: timeStr,
        isMe: true,
        recipient: finalRecipient,
        subgroup_id: finalSubgroupId,
        attachment
      };
      setChatMessages(prev => [...prev, localMsg]);
    }

    setNewMessage('');
    setSelectedFile(null);
    if (chatFileInputRef.current) {
      chatFileInputRef.current.value = '';
    }
  };

  const handleInitiatePrivateChat = (email: string) => {
    setActiveSidePanel('chat');
    setChatFilter('private');
    setTargetRecipient(email);
  };

  // Subgroups
  const handlePrepareSubgroups = () => {
    const generated: SubGroup[] = [];
    const pool = [...participantsList.map(p => p.email)];

    for (let i = 0; i < subgroupCount; i++) {
      generated.push({
        id: `sg-${i + 1}`,
        name: `Sous-Groupe ${i + 1} - Atelier`,
        members: []
      });
    }

    pool.forEach((email, idx) => {
      generated[idx % subgroupCount].members.push(email);
    });

    setStagedSubgroups(generated);
    setShowSubgroupModal(true);
  };

  const handleLaunchSubgroups = async () => {
    try {
      const payload = {
        timer_minutes: subgroupTimer,
        subgroups: stagedSubgroups
      };
      const res = await apiClient.post(`/classrooms/${roomId}/subgroups`, payload);
      setSubgroupsState(res.data);
      setShowSubgroupModal(false);
      alert("Sous-groupes lancés ! Les apprenants ont été notifiés sur leur mobile et ordinateur.");
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Erreur lors du lancement des sous-groupes.");
    }
  };

  const handleCloseSubgroups = async () => {
    if (!confirm("Clôturer tous les sous-groupes et rappeler tout le monde dans la salle principale ?")) return;
    try {
      await apiClient.delete(`/classrooms/${roomId}/subgroups`);
      setSubgroupsState({ is_active: false, timer_minutes: 15, subgroups: [] });
      setCurrentActiveSubgroupId(null);
      alert("Tous les sous-groupes ont été clôturés. Retour à la salle principale.");
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Erreur lors de la clôture des sous-groupes.");
    }
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomId);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  if (isLoadingRoom) {
    return (
      <div className="h-[100dvh] w-screen flex items-center justify-center bg-[#0b0f19] text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-gray-400 font-medium">Connexion à la classe mobile...</p>
        </div>
      </div>
    );
  }

  if (roomError || !classroom) {
    return (
      <div className="h-[100dvh] w-screen flex flex-col items-center justify-center px-4 text-center bg-[#0b0f19] text-white">
        <div className="glass-card p-8 sm:p-10 max-w-md w-full space-y-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center">
            <AlertCircle size={36} />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold">Classe introuvable</h2>
          <p className="text-gray-400 text-xs sm:text-sm">{roomError || "Cette classe virtuelle n'existe pas ou est fermée."}</p>
          <Link href="/classroom" className="btn-primary py-3 rounded-xl block font-bold text-xs sm:text-sm">
            Retour aux Classes Virtuelles
          </Link>
        </div>
      </div>
    );
  }

  const myName = currentUser?.email?.split('@')[0] || 'Participant';
  const instructorName = classroom.instructor?.email?.split('@')[0] || `Formateur #${classroom.instructor_id}`;
  const mySubgroup = subgroupsState.subgroups.find(sg => 
    sg.members.some(m => m.toLowerCase() === currentUser?.email?.toLowerCase())
  );

  return (
    <div className="h-[100dvh] max-h-[100dvh] w-screen bg-[#0b0f19] text-white flex flex-col overflow-hidden select-none touch-manipulation">
      
      {/* 1. TOP HEADER BAR (Mobile Optimized) */}
      <header className="h-14 sm:h-16 px-3 sm:px-6 bg-[#111827]/90 backdrop-blur border-b border-white/10 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
          <BackButton label="" className="!text-white hover:!text-primary shrink-0 mr-2" />
          <div className="flex items-center gap-2 shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-4.5" />
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-red-400">DIRECT</span>
          </div>

          <div className="h-4 w-px bg-white/20 shrink-0" />

          <div className="min-w-0">
            <h1 className="font-bold text-xs sm:text-sm text-white truncate flex items-center gap-1.5">
              <span className="truncate">{classroom.title}</span>
              {currentActiveSubgroupId && (
                <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-extrabold bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1 shrink-0">
                  <Split size={10} /> {subgroupsState.subgroups.find(s => s.id === currentActiveSubgroupId)?.name || 'Sous-groupe'}
                </span>
              )}
            </h1>
            <p className="text-[9px] sm:text-[10px] text-gray-400 truncate">Hôte : {instructorName}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Subgroups Banner indicator */}
          {subgroupsState.is_active && (
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-900/40 border border-purple-500/40 text-purple-300 text-[11px] font-bold">
              <Timer size={12} className="text-purple-400 animate-spin" />
              <span>Sous-groupes ({subgroupsState.timer_minutes} min)</span>
            </div>
          )}

          {/* Copy Code */}
          <button
            onClick={copyRoomCode}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 text-[11px] font-mono text-gray-300 border border-white/10 transition-all"
            title="Copier le code de la classe"
          >
            {copiedCode ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
            <span className="truncate max-w-[70px] sm:max-w-none">{roomId}</span>
          </button>
        </div>
      </header>

      {/* 2. MAIN STAGE & VIDEO TILES (Mobile Responsive Layout) */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Stage Content */}
        <div className="flex-1 p-2 sm:p-4 flex flex-col relative overflow-hidden">
          
          {/* Subgroups Student Invite Banner */}
          {subgroupsState.is_active && mySubgroup && !currentActiveSubgroupId && (
            <div className="mb-2 p-2.5 sm:p-3.5 rounded-2xl bg-gradient-to-r from-blue-900/90 to-indigo-900/90 border border-blue-500/50 shadow-xl flex items-center justify-between gap-2 text-xs shrink-0 animate-fade-in-up">
              <div className="flex items-center gap-2 min-w-0">
                <div className="p-1.5 rounded-xl bg-blue-500/20 text-blue-300 shrink-0">
                  <Split size={16} />
                </div>
                <div className="min-w-0">
                  <p className="font-extrabold text-white text-[11px] sm:text-xs truncate">Atelier sous-groupe disponible</p>
                  <p className="text-blue-200 text-[10px] truncate">
                    Assigné(e) au <span className="font-bold underline">{mySubgroup.name}</span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setCurrentActiveSubgroupId(mySubgroup.id);
                  setChatFilter('subgroup');
                  setActiveSidePanel('chat');
                }}
                className="px-3 py-1.5 rounded-xl bg-purple-500 hover:bg-purple-600 font-bold text-white text-[11px] shadow-md shadow-purple-500/30 flex items-center gap-1 shrink-0"
              >
                <span>Rejoindre</span>
                <ArrowRight size={12} />
              </button>
            </div>
          )}

          {/* If currently inside a subgroup */}
          {currentActiveSubgroupId && (
            <div className="mb-2 p-2 rounded-xl bg-purple-950/60 border border-purple-500/40 flex items-center justify-between text-xs shrink-0">
              <span className="font-bold text-purple-300 text-[11px] sm:text-xs flex items-center gap-1.5 truncate">
                <Split size={14} className="shrink-0" />
                <span className="truncate">{subgroupsState.subgroups.find(s => s.id === currentActiveSubgroupId)?.name}</span>
              </span>
              <button
                onClick={() => setCurrentActiveSubgroupId(null)}
                className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-gray-200 text-[10px] sm:text-xs font-semibold flex items-center gap-1 transition-all shrink-0 ml-2"
              >
                <LogOut size={12} /> Sortir
              </button>
            </div>
          )}

          {/* Permission Alert Banner */}
          {permissionError && (
            <div className="mb-2 p-2.5 sm:p-3 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <AlertCircle size={15} className="text-amber-400 shrink-0" />
                <span className="text-[10px] sm:text-xs leading-tight line-clamp-2">{permissionError}</span>
              </div>
              <button
                onClick={() => startCameraAndMic()}
                className="px-2.5 py-1 bg-amber-500 text-black font-bold rounded-lg text-[10px] sm:text-xs hover:bg-amber-400 transition-colors shrink-0"
              >
                Activer
              </button>
            </div>
          )}

          {/* Video Tiles Grid */}
          <div className="flex-1 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3 h-full relative overflow-y-auto content-start p-1 scrollbar-thin">
            
            {/* Screen Share Stage */}
            {isScreenSharing ? (
              <div className="col-span-2 md:col-span-3 lg:col-span-4 xl:col-span-5 relative rounded-2xl overflow-hidden bg-black border-2 border-primary/50 shadow-2xl flex items-center justify-center min-h-[300px]">
                <video
                  ref={screenVideoRef}
                  autoPlay
                  playsInline
                  webkit-playsinline="true"
                  className="w-full h-full object-contain"
                />
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur border border-white/20 text-[10px] sm:text-xs font-bold text-cyan-400 flex items-center gap-1.5">
                  <MonitorUp size={12} className="animate-pulse" /> Partage d'écran actif
                </div>
              </div>
            ) : null}

            {/* Simulated Instructor Tile */}
            <div className="relative rounded-2xl overflow-hidden bg-[#1f2937] border border-white/10 flex flex-col items-center justify-center shadow-lg group aspect-video min-h-[120px]">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-tr from-primary to-secondary p-0.5 flex items-center justify-center shadow-md">
                <div className="w-full h-full rounded-full bg-[#1f2937] flex items-center justify-center text-lg sm:text-xl font-bold text-white">
                  {instructorName.charAt(0).toUpperCase()}
                </div>
              </div>
              <p className="mt-2 font-bold text-[10px] sm:text-xs text-gray-200 truncate px-2">{instructorName} (Hôte)</p>
              <div className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 bg-black/50 backdrop-blur rounded-full text-[9px] font-semibold text-green-400 border border-white/10">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> Direct
              </div>
              <div className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur text-[9px] sm:text-[10px] font-semibold">
                <Mic size={10} className="text-green-400" />
              </div>
            </div>

            {/* Local User Camera Tile */}
            <div className="relative rounded-2xl overflow-hidden bg-black border border-white/10 flex flex-col items-center justify-center shadow-lg aspect-video min-h-[120px]">
              {/* Camera Video Stream */}
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                webkit-playsinline="true"
                muted
                className={`absolute inset-0 w-full h-full object-cover ${isCameraOff ? 'hidden' : 'block'}`}
              />

              {/* Fallback Avatar when Camera is OFF */}
              {isCameraOff && (
                <div className="flex flex-col items-center justify-center space-y-1.5 z-10">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-primary/20 border-2 border-primary/50 flex items-center justify-center text-lg font-bold text-primary">
                    {myName.charAt(0).toUpperCase()}
                  </div>
                  <p className="text-[9px] text-gray-400">Désactivée</p>
                </div>
              )}

              {/* User Name & Status Tags */}
              <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur text-[9px] sm:text-[10px] font-semibold border border-white/10 z-10">
                <span className="truncate max-w-[60px] sm:max-w-[100px]">{myName} (Vous)</span>
                {isMicMuted ? (
                  <MicOff size={10} className="text-red-400 shrink-0" />
                ) : (
                  <Mic size={10} className="text-green-400 shrink-0" />
                )}
              </div>

              {/* Hand Raised badge */}
              {isHandRaised && (
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 text-[9px] font-bold flex items-center gap-1 animate-bounce z-10">
                  <Hand size={10} /> Main
                </div>
              )}
            </div>

            {/* Simulated Other Participants Tiles */}
            {participantsList.map((participant, idx) => (
              <div key={idx} className="relative rounded-2xl overflow-hidden bg-[#1f2937] border border-white/10 flex flex-col items-center justify-center shadow-lg group aspect-video min-h-[120px]">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-surface border-2 border-border flex items-center justify-center text-lg font-bold text-gray-300 shadow-inner">
                  {participant.email.split('.')[0].charAt(0).toUpperCase()}
                </div>
                <p className="mt-2 font-semibold text-[10px] text-gray-300 capitalize truncate px-2 max-w-[95%]">
                  {participant.email.split('@')[0].replace('.', ' ')}
                </p>
                <div className="absolute bottom-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-black/50 backdrop-blur text-[9px] font-semibold text-gray-400">
                  <MicOff size={10} />
                </div>
              </div>
            ))}

          </div>
        </div>

        {/* ========================================================================= */}
        {/* SIDE PANELS (Chat & Participants Drawer) - Mobile Fullscreen Sheet        */}
        {/* ========================================================================= */}
        {activeSidePanel && (
          <aside className="fixed sm:static inset-0 z-50 sm:z-20 w-full sm:w-80 md:w-96 bg-[#111827] border-l border-white/10 flex flex-col shrink-0 transition-all">
            
            {/* Drawer Header */}
            <div className="p-3 sm:p-4 border-b border-white/10 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-xs sm:text-sm flex items-center gap-2">
                  {activeSidePanel === 'chat' ? (
                    <><MessageSquare size={16} className="text-primary" /> Discussion en Direct</>
                  ) : (
                    <><UsersIcon size={16} className="text-secondary" /> Participants ({participantsList.length + 2})</>
                  )}
                </h3>
                <button 
                  onClick={() => setActiveSidePanel(null)}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-xs font-bold flex items-center gap-1"
                >
                  <X size={16} />
                  <span className="sm:hidden text-[10px]">Fermer</span>
                </button>
              </div>

              {/* Chat sub-filters */}
              {activeSidePanel === 'chat' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg text-xs">
                    <button
                      onClick={() => { setChatFilter('public'); setTargetRecipient('everyone'); }}
                      className={`flex-1 py-1.5 text-[10px] sm:text-[11px] font-bold rounded-md transition-all ${chatFilter === 'public' ? 'bg-primary text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                    >
                      📢 Groupe
                    </button>
                    <button
                      onClick={() => setChatFilter('private')}
                      className={`flex-1 py-1.5 text-[10px] sm:text-[11px] font-bold rounded-md transition-all ${chatFilter === 'private' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                    >
                      🔒 Privé
                    </button>
                    {subgroupsState.is_active && (
                      <button
                        onClick={() => setChatFilter('subgroup')}
                        className={`flex-1 py-1.5 text-[10px] sm:text-[11px] font-bold rounded-md transition-all ${chatFilter === 'subgroup' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                      >
                        👥 Sous-Groupe
                      </button>
                    )}
                  </div>

                  {chatFilter === 'private' && (
                    <div className="p-2 rounded-xl bg-purple-950/30 border border-purple-500/30 space-y-1">
                      <label className="text-[9px] font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1">
                        <Lock size={10} /> Destinataire Privé :
                      </label>
                      <select
                        value={targetRecipient}
                        onChange={(e) => setTargetRecipient(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-black/60 border border-purple-500/40 rounded-lg text-xs text-white outline-none focus:border-purple-400 cursor-pointer"
                      >
                        <option value="everyone" disabled>Sélectionner un participant...</option>
                        <option value={classroom.instructor?.email || 'formateur@eschola.pro'}>
                          👨‍🏫 {instructorName} (Formateur)
                        </option>
                        {participantsList
                          .filter(p => p.email.toLowerCase() !== currentUser?.email.toLowerCase())
                          .map(p => (
                            <option key={p.email} value={p.email}>
                              👤 {p.email.split('@')[0]} ({p.role})
                            </option>
                          ))
                        }
                      </select>
                    </div>
                  )}

                  {chatFilter === 'subgroup' && (
                    <div className="p-2 rounded-xl bg-indigo-950/30 border border-indigo-500/30 text-[10px] sm:text-[11px] text-indigo-200">
                      <span>👥 Discussion réservée au <strong>{subgroupsState.subgroups.find(s => s.id === currentActiveSubgroupId)?.name || 'Sous-groupe'}</strong></span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Content : CHAT */}
            {activeSidePanel === 'chat' && (
              <div className="flex-1 flex flex-col justify-between overflow-hidden">
                <div className="flex-1 p-3 sm:p-4 space-y-3 overflow-y-auto">
                  {chatMessages
                    .filter(msg => {
                      if (chatFilter === 'public') return msg.recipient === 'everyone';
                      if (chatFilter === 'private') return msg.recipient !== 'everyone' && !msg.recipient?.startsWith('subgroup:');
                      if (chatFilter === 'subgroup') return msg.recipient?.startsWith('subgroup:');
                      return true;
                    })
                    .map(msg => {
                      const isPrivate = msg.recipient !== 'everyone' && !msg.recipient?.startsWith('subgroup:');
                      const isSubgroup = msg.recipient?.startsWith('subgroup:');

                      return (
                        <div key={msg.id} className={`flex flex-col ${msg.isMe ? 'items-end' : 'items-start'}`}>
                          <div className="flex items-center gap-1.5 text-[10px] text-gray-400 mb-1">
                            <span className="font-semibold">{msg.sender.split('@')[0]}</span>
                            <span>{msg.time}</span>
                            {isPrivate && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-purple-500/20 text-purple-300 text-[9px] font-bold border border-purple-500/30">
                                <Lock size={9} /> {msg.isMe ? `Privé à ${msg.recipient.split('@')[0]}` : 'Privé'}
                              </span>
                            )}
                            {isSubgroup && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-indigo-500/20 text-indigo-300 text-[9px] font-bold border border-indigo-500/30">
                                <Split size={9} /> Sous-groupe
                              </span>
                            )}
                          </div>

                          <div className={`p-2.5 sm:p-3 rounded-2xl text-xs max-w-[90%] leading-relaxed ${
                            msg.isMe 
                              ? isPrivate 
                                ? 'bg-purple-900/80 border border-purple-500/40 text-white rounded-br-none' 
                                : isSubgroup
                                  ? 'bg-indigo-700 text-white rounded-br-none'
                                  : 'bg-primary text-white rounded-br-none' 
                              : isPrivate 
                                ? 'bg-purple-950/60 border border-purple-500/30 text-gray-200 rounded-bl-none' 
                                : isSubgroup
                                  ? 'bg-indigo-950/60 border border-indigo-500/30 text-gray-200 rounded-bl-none'
                                  : 'bg-white/10 text-gray-200 rounded-bl-none'
                          }`}>
                            {msg.text && <p className="whitespace-pre-wrap">{msg.text}</p>}

                            {/* Message Attachment */}
                            {msg.attachment && (
                              <div className="mt-2">
                                {msg.attachment.category === 'image' && (
                                  <div className="rounded-xl overflow-hidden border border-white/10 bg-black/40">
                                    <img 
                                      src={msg.attachment.url} 
                                      alt={msg.attachment.filename} 
                                      className="w-full h-auto max-h-40 object-cover cursor-pointer hover:scale-105 transition-transform"
                                      onClick={() => window.open(msg.attachment!.url, '_blank')}
                                    />
                                    <p className="text-[9px] text-gray-300 p-1 truncate">{msg.attachment.filename}</p>
                                  </div>
                                )}

                                {msg.attachment.category === 'audio' && (
                                  <div className="p-2 bg-black/40 rounded-xl border border-white/10 space-y-1">
                                    <div className="flex items-center gap-1.5 text-[10px] font-medium text-cyan-300 truncate">
                                      <Music size={12} className="shrink-0" />
                                      <span className="truncate">{msg.attachment.filename}</span>
                                    </div>
                                    <audio controls src={msg.attachment.url} className="w-full h-7" />
                                  </div>
                                )}

                                {msg.attachment.category === 'video' && (
                                  <div className="rounded-xl overflow-hidden border border-white/10 bg-black/60">
                                    <video controls src={msg.attachment.url} className="w-full max-h-40 object-contain" />
                                    <p className="text-[9px] text-gray-300 p-1 truncate">{msg.attachment.filename}</p>
                                  </div>
                                )}

                                {msg.attachment.category === 'document' && (
                                  <a
                                    href={msg.attachment.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    download={msg.attachment.filename}
                                    className="flex items-center justify-between gap-2 p-2 bg-black/40 hover:bg-black/60 rounded-xl border border-white/10 transition-colors group/file text-left"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <FileText size={18} className="text-primary shrink-0" />
                                      <div className="min-w-0">
                                        <p className="text-[11px] font-semibold text-white truncate max-w-[130px]">
                                          {msg.attachment.filename}
                                        </p>
                                        <span className="text-[9px] text-gray-400 uppercase font-mono">
                                          .{msg.attachment.ext}
                                        </span>
                                      </div>
                                    </div>
                                    <Download size={13} className="text-gray-400 group-hover/file:text-white shrink-0" />
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>

                {/* Chat Input Bar */}
                <form onSubmit={handleSendMessage} className="p-2 sm:p-3 border-t border-white/10 bg-black/40 flex items-center gap-1.5 sm:gap-2">
                  <input
                    type="file"
                    ref={chatFileInputRef}
                    onChange={handleChatFileSelect}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.gif,.mp3,.wav,.mp4,.webm"
                  />

                  <button
                    type="button"
                    onClick={() => chatFileInputRef.current?.click()}
                    disabled={isUploadingFile}
                    className={`p-2 rounded-xl border border-white/10 transition-colors shrink-0 ${
                      selectedFile ? 'bg-primary/20 text-primary border-primary/50' : 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white'
                    }`}
                    title="Joindre un document ou média"
                  >
                    <Paperclip size={16} />
                  </button>

                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={
                      chatFilter === 'public'
                        ? "Message au groupe..."
                        : chatFilter === 'subgroup'
                          ? "Message au sous-groupe..."
                          : `Message privé à ${targetRecipient.split('@')[0]}...`
                    }
                    disabled={isUploadingFile}
                    className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-gray-500 outline-none focus:border-primary"
                  />

                  <button
                    type="submit"
                    disabled={isUploadingFile || (!newMessage.trim() && !selectedFile)}
                    className="p-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white rounded-xl transition-colors shrink-0"
                  >
                    {isUploadingFile ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </form>
              </div>
            )}

            {/* Content : PARTICIPANTS */}
            {activeSidePanel === 'participants' && (
              <div className="p-3 sm:p-4 space-y-2.5 overflow-y-auto">
                
                {/* Formateur */}
                <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl bg-white/5 border border-white/5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                      {instructorName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">{instructorName}</p>
                      <p className="text-[10px] text-cyan-400 font-semibold">Formateur / Hôte</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleInitiatePrivateChat(classroom.instructor?.email || 'formateur@eschola.pro')}
                      className="px-2 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-[10px] font-bold border border-purple-500/30 flex items-center gap-1"
                      title="Envoyer un message privé"
                    >
                      <Lock size={10} /> Privé
                    </button>
                    <Mic size={14} className="text-green-400 ml-1" />
                  </div>
                </div>

                {/* Current user */}
                <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl bg-white/5 border border-white/5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-secondary/20 text-secondary flex items-center justify-center font-bold text-xs shrink-0">
                      {myName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">{myName} (Vous)</p>
                      <p className="text-[10px] text-gray-400 uppercase">{currentUser?.role || 'Étudiant'}</p>
                    </div>
                  </div>
                  {isMicMuted ? <MicOff size={14} className="text-red-400 shrink-0" /> : <Mic size={14} className="text-green-400 shrink-0" />}
                </div>

                {/* Other participants */}
                {participantsList
                  .filter(p => p.email.toLowerCase() !== currentUser?.email.toLowerCase())
                  .map(p => (
                    <div key={p.email} className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl bg-white/5 border border-white/5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">
                          {p.email.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-gray-200 truncate">{p.email.split('@')[0]}</p>
                          <p className="text-[10px] text-gray-400 uppercase">{p.role}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleInitiatePrivateChat(p.email)}
                          className="px-2 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-[10px] font-bold border border-purple-500/30 flex items-center gap-1"
                          title="Message privé"
                        >
                          <Lock size={10} /> Privé
                        </button>
                        <MicOff size={14} className="text-gray-500" />
                      </div>
                    </div>
                  ))
                }
              </div>
            )}

          </aside>
        )}

      </div>

      {/* 3. BOTTOM CONTROLS BAR (Mobile Touch Optimized & Full Width) */}
      <footer className="h-16 sm:h-20 bg-[#111827] border-t border-white/10 px-2 sm:px-6 flex items-center justify-between shrink-0 z-30 overflow-x-auto scrollbar-none">
        
        {/* Left info (Code on desktop) */}
        <div className="hidden lg:flex items-center gap-3 max-w-[200px] truncate">
          <p className="text-xs text-gray-400 font-mono">Code : <span className="text-white font-bold">{roomId}</span></p>
        </div>

        {/* Center Main Action Buttons */}
        <div className="flex items-center gap-2 sm:gap-3.5 mx-auto">
          
          {/* Micro Button */}
          <button
            onClick={toggleMicrophone}
            className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all shrink-0 ${
              isMicMuted 
                ? 'bg-red-500 hover:bg-red-600 text-white shadow-md shadow-red-500/30' 
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
            title={isMicMuted ? "Activer le micro" : "Couper le micro"}
          >
            {isMicMuted ? <MicOff size={18} /> : <Mic size={18} />}
          </button>

          {/* Camera Button */}
          <button
            onClick={toggleCamera}
            className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all shrink-0 ${
              isCameraOff 
                ? 'bg-red-500 hover:bg-red-600 text-white shadow-md shadow-red-500/30' 
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
            title={isCameraOff ? "Activer la caméra" : "Couper la caméra"}
          >
            {isCameraOff ? <VideoOff size={18} /> : <Video size={18} />}
          </button>

          {/* Flip Camera Button (Mobile only) */}
          {isMobile && !isCameraOff && (
            <button
              onClick={handleFlipCamera}
              disabled={isFlippingCamera}
              className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white/10 hover:bg-white/20 text-cyan-400 flex items-center justify-center transition-all shrink-0"
              title="Changer de caméra (Avant / Arrière)"
            >
              {isFlippingCamera ? <Loader2 size={18} className="animate-spin" /> : <SwitchCamera size={18} />}
            </button>
          )}

          {/* Screen Share Button */}
          <button
            onClick={toggleScreenShare}
            className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all shrink-0 ${
              isScreenSharing 
                ? 'bg-cyan-500 hover:bg-cyan-600 text-black font-bold shadow-md shadow-cyan-500/30' 
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
            title={isScreenSharing ? "Arrêter le partage d'écran" : "Partager votre écran"}
          >
            {isScreenSharing ? <MonitorX size={18} /> : <MonitorUp size={18} />}
          </button>

          {/* Raise Hand Button */}
          <button
            onClick={() => setIsHandRaised(!isHandRaised)}
            className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all shrink-0 ${
              isHandRaised 
                ? 'bg-yellow-500 hover:bg-yellow-600 text-black font-bold' 
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
            title={isHandRaised ? "Baisser la main" : "Lever la main"}
          >
            <Hand size={18} />
          </button>

          {/* Chat Button (Prominent in main action bar) */}
          <button
            onClick={() => setActiveSidePanel(activeSidePanel === 'chat' ? null : 'chat')}
            className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all relative shrink-0 ${
              activeSidePanel === 'chat' 
                ? 'bg-primary text-white shadow-md shadow-primary/30' 
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
            title="Ouvrir la discussion"
          >
            <MessageSquare size={18} />
            <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          </button>

          {/* Breakout Rooms Button (Formateurs & Admins) */}
          {isManager && (
            <button
              onClick={handlePrepareSubgroups}
              className={`px-3 h-11 sm:h-12 rounded-full flex items-center gap-1.5 text-xs font-bold transition-all shrink-0 ${
                subgroupsState.is_active
                  ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-600/30'
                  : 'bg-white/10 hover:bg-white/20 text-purple-300'
              }`}
              title="Sous-groupes"
            >
              <Split size={17} />
              <span className="hidden sm:inline">Sous-groupes</span>
            </button>
          )}

          {/* Leave Call (Red Button) */}
          <button
            onClick={handleLeaveClass}
            className="px-4 sm:px-6 h-11 sm:h-12 bg-red-600 hover:bg-red-700 text-white font-bold rounded-full flex items-center gap-1.5 shadow-md shadow-red-600/40 transition-all shrink-0"
            title="Quitter la classe virtuelle"
          >
            <PhoneOff size={18} />
            <span className="hidden sm:inline">Quitter</span>
          </button>

        </div>

        {/* Right Action Icons (Participants) */}
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <button
            onClick={() => setActiveSidePanel(activeSidePanel === 'participants' ? null : 'participants')}
            className={`p-2.5 sm:p-3 rounded-full transition-all relative ${
              activeSidePanel === 'participants' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
            title="Participants"
          >
            <UsersIcon size={18} />
            <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full bg-primary text-[9px] font-bold text-white">
              {participantsList.length + 2}
            </span>
          </button>
        </div>

      </footer>

      {/* ========================================================================= */}
      {/* MODAL DE CRÉATION & GESTION DES SOUS-GROUPES (Formateurs & Admins)        */}
      {/* ========================================================================= */}
      {showSubgroupModal && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="glass-card max-w-2xl w-full p-5 sm:p-8 rounded-3xl border border-purple-500/40 space-y-5 shadow-2xl my-auto">
            
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2 text-purple-400 font-extrabold text-sm sm:text-base">
                <Split size={18} />
                <h3>Création des Sous-Groupes (Breakout Rooms)</h3>
              </div>
              <button 
                onClick={() => setShowSubgroupModal(false)}
                className="text-gray-400 hover:text-white font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-white/5 border border-white/5">
                <div>
                  <label className="block uppercase font-bold text-gray-300 mb-1 text-[10px]">
                    Nombre de Salles
                  </label>
                  <select
                    value={subgroupCount}
                    onChange={(e) => {
                      const count = parseInt(e.target.value);
                      setSubgroupCount(count);
                      const gen: SubGroup[] = [];
                      for (let i = 0; i < count; i++) {
                        gen.push({ id: `sg-${i + 1}`, name: `Sous-Groupe ${i + 1} - Atelier`, members: [] });
                      }
                      participantsList.forEach((p, idx) => {
                        gen[idx % count].members.push(p.email);
                      });
                      setStagedSubgroups(gen);
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-black border border-white/10 text-white outline-none focus:border-purple-400 cursor-pointer text-xs"
                  >
                    <option value={2}>2 Sous-groupes</option>
                    <option value={3}>3 Sous-groupes</option>
                    <option value={4}>4 Sous-groupes</option>
                    <option value={5}>5 Sous-groupes</option>
                  </select>
                </div>

                <div>
                  <label className="block uppercase font-bold text-gray-300 mb-1 text-[10px]">
                    Durée de l'atelier (Minutes)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={120}
                    value={subgroupTimer}
                    onChange={(e) => setSubgroupTimer(parseInt(e.target.value) || 15)}
                    className="w-full px-3 py-2 rounded-xl bg-black border border-white/10 text-white outline-none focus:border-purple-400 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold uppercase text-gray-300 text-[10px]">
                    Répartition des Apprenants :
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const shuffled = [...participantsList.map(p => p.email)].sort(() => Math.random() - 0.5);
                      const gen = stagedSubgroups.map(sg => ({ ...sg, members: [] as string[] }));
                      shuffled.forEach((email, idx) => {
                        gen[idx % gen.length].members.push(email);
                      });
                      setStagedSubgroups(gen);
                    }}
                    className="text-purple-400 hover:text-purple-300 font-bold flex items-center gap-1 text-[10px]"
                  >
                    <Shuffle size={11} /> Mélanger aléatoirement
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto">
                  {stagedSubgroups.map((sg) => (
                    <div key={sg.id} className="p-3 rounded-2xl bg-black/40 border border-purple-500/20 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <input
                          type="text"
                          value={sg.name}
                          onChange={(e) => {
                            const val = e.target.value;
                            setStagedSubgroups(prev => prev.map(s => s.id === sg.id ? { ...s, name: val } : s));
                          }}
                          className="font-bold text-purple-300 bg-transparent border-b border-transparent hover:border-purple-500/40 outline-none text-xs w-3/4"
                        />
                        <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[9px] font-bold">
                          {sg.members.length}
                        </span>
                      </div>

                      <div className="space-y-1">
                        {sg.members.map(member => (
                          <div key={member} className="px-2 py-0.5 rounded-lg bg-white/5 text-[10px] text-gray-300 truncate">
                            👤 {member.split('@')[0]}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-white/10">
                {subgroupsState.is_active ? (
                  <button
                    type="button"
                    onClick={handleCloseSubgroups}
                    className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 font-bold text-white text-xs flex items-center gap-1.5"
                  >
                    <PhoneOff size={13} />
                    <span>Clôturer</span>
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowSubgroupModal(false)}
                    className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 font-semibold text-gray-300 text-xs"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleLaunchSubgroups}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 font-bold text-white shadow-md shadow-blue-500/30 flex items-center gap-1.5 text-xs"
                  >
                    <Split size={14} />
                    <span>Lancer les Salles</span>
                  </button>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
