import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import useSocketEvent from "./useSocketEvent";

const ICE_CONFIGURATION = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

const createCallId = () =>
  `call-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const useInAppCall = ({ socket, role, displayName }) => {
  const [callStatus, setCallStatus] = useState("idle");
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);

  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const activeCallRef = useRef(null);
  const incomingCallRef = useRef(null);
  const ringtoneContextRef = useRef(null);
  const ringtoneTimeoutRef = useRef(null);
  const ringtonePlayingRef = useRef(false);

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);

  const clearRingtoneTimer = () => {
    if (ringtoneTimeoutRef.current) {
      window.clearTimeout(ringtoneTimeoutRef.current);
      ringtoneTimeoutRef.current = null;
    }
  };

  const stopIncomingRingtone = () => {
    ringtonePlayingRef.current = false;
    clearRingtoneTimer();

    if (ringtoneContextRef.current) {
      ringtoneContextRef.current.close().catch(() => {});
      ringtoneContextRef.current = null;
    }
  };

  const playTone = (audioContext, frequency, startAt, duration, gainValue) => {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, startAt);

    gainNode.gain.setValueAtTime(0.0001, startAt);
    gainNode.gain.exponentialRampToValueAtTime(gainValue, startAt + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.03);
  };

  const startIncomingRingtone = async () => {
    if (ringtonePlayingRef.current) return;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    ringtonePlayingRef.current = true;

    const ringPattern = async () => {
      if (!ringtonePlayingRef.current) return;

      if (!ringtoneContextRef.current) {
        ringtoneContextRef.current = new AudioContextClass();
      }

      const audioContext = ringtoneContextRef.current;
      if (audioContext.state === "suspended") {
        try {
          await audioContext.resume();
        } catch (_) {
          return;
        }
      }

      const now = audioContext.currentTime + 0.02;

      // Smartphone-style double chime pattern.
      playTone(audioContext, 880, now, 0.18, 0.035);
      playTone(audioContext, 1318.5, now, 0.18, 0.018);
      playTone(audioContext, 987.8, now + 0.24, 0.22, 0.03);
      playTone(audioContext, 1479.98, now + 0.24, 0.22, 0.014);

      clearRingtoneTimer();
      ringtoneTimeoutRef.current = window.setTimeout(() => {
        ringPattern();
      }, 1800);
    };

    ringPattern();
  };

  const stopLocalStream = () => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
  };

  const cleanupConnection = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.ontrack = null;
      peerConnectionRef.current.onconnectionstatechange = null;
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
  };

  const resetCallState = ({ keepLocalStream = false } = {}) => {
    stopIncomingRingtone();
    cleanupConnection();
    if (!keepLocalStream) {
      stopLocalStream();
    }
    setIncomingCall(null);
    setActiveCall(null);
    setCallStatus("idle");
  };

  const ensureLocalStream = async () => {
    if (localStreamRef.current) {
      return localStreamRef.current;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Audio calling is not supported in this browser.");
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
    localStreamRef.current = stream;
    return stream;
  };

  const createPeerConnection = async (call) => {
    const stream = await ensureLocalStream();
    const peerConnection = new RTCPeerConnection(ICE_CONFIGURATION);

    stream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, stream);
    });

    peerConnection.onicecandidate = (event) => {
      if (!event.candidate) return;

      socket?.emit("in_app_call_ice", {
        callId: call.callId,
        fromRole: role,
        toRole: call.otherRole,
        candidate: event.candidate,
      });
    };

    peerConnection.ontrack = (event) => {
      if (!remoteAudioRef.current) return;
      remoteAudioRef.current.srcObject = event.streams[0];
    };

    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;
      if (state === "connected") {
        setCallStatus("in_call");
      }

      if (["failed", "disconnected", "closed"].includes(state)) {
        resetCallState();
      }
    };

    peerConnectionRef.current = peerConnection;
    return peerConnection;
  };

  const startCall = async (toRole) => {
    if (!socket) {
      toast.error("Socket connection unavailable.");
      return;
    }

    if (activeCallRef.current || incomingCallRef.current) {
      toast.error("A call is already in progress.");
      return;
    }

    const call = {
      callId: createCallId(),
      otherRole: toRole,
      otherName: toRole,
    };

    try {
      setCallStatus("outgoing");
      setActiveCall(call);
      const peerConnection = await createPeerConnection(call);
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      socket.emit("in_app_call_offer", {
        callId: call.callId,
        fromRole: role,
        fromName: displayName || role,
        toRole,
        offer,
      });

      toast.success(`Calling ${toRole}...`);
    } catch (error) {
      toast.error(error.message || "Could not start the call.");
      resetCallState();
    }
  };

  const acceptCall = async () => {
    if (!incomingCallRef.current || !socket) return;

    const call = {
      callId: incomingCallRef.current.callId,
      otherRole: incomingCallRef.current.fromRole,
      otherName: incomingCallRef.current.fromName,
    };

    try {
      setCallStatus("connecting");
      setActiveCall(call);
      const peerConnection = await createPeerConnection(call);
      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(incomingCallRef.current.offer)
      );
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      socket.emit("in_app_call_answer", {
        callId: call.callId,
        fromRole: role,
        toRole: call.otherRole,
        answer,
      });

      setIncomingCall(null);
      stopIncomingRingtone();
      toast.success("Call accepted.");
    } catch (error) {
      toast.error(error.message || "Could not accept the call.");
      resetCallState();
    }
  };

  const rejectCall = () => {
    const currentIncomingCall = incomingCallRef.current;
    if (!currentIncomingCall || !socket) return;

    socket.emit("in_app_call_reject", {
      callId: currentIncomingCall.callId,
      fromRole: role,
      toRole: currentIncomingCall.fromRole,
    });

    stopIncomingRingtone();
    setIncomingCall(null);
    setCallStatus("idle");
    toast.error("Call rejected.");
  };

  const endCall = ({ silent = false } = {}) => {
    const currentCall = activeCallRef.current;

    if (currentCall && socket) {
      socket.emit("in_app_call_end", {
        callId: currentCall.callId,
        fromRole: role,
        toRole: currentCall.otherRole,
      });
    }

    resetCallState();
    if (!silent) {
      toast.success("Call ended.");
    }
  };

  useSocketEvent("in_app_call_offer", (data) => {
    if (!data || data.toRole !== role || data.fromRole === role) return;

    if (activeCallRef.current || incomingCallRef.current) {
      socket?.emit("in_app_call_reject", {
        callId: data.callId,
        fromRole: role,
        toRole: data.fromRole,
      });
      return;
    }

    setIncomingCall(data);
    setCallStatus("incoming");
    startIncomingRingtone();
    toast(`Incoming call from ${data.fromName || data.fromRole}.`, {
      duration: 6000,
    });
  });

  useSocketEvent("in_app_call_answer", async (data) => {
    if (!data || data.toRole !== role) return;
    if (!activeCallRef.current || activeCallRef.current.callId !== data.callId) return;

    try {
      await peerConnectionRef.current?.setRemoteDescription(
        new RTCSessionDescription(data.answer)
      );
      setCallStatus("connecting");
      toast.success("Police joined the call.");
    } catch (error) {
      toast.error("Could not connect the call.");
      resetCallState();
    }
  });

  useSocketEvent("in_app_call_ice", async (data) => {
    if (!data || data.toRole !== role) return;
    if (!activeCallRef.current || activeCallRef.current.callId !== data.callId) return;

    try {
      await peerConnectionRef.current?.addIceCandidate(
        new RTCIceCandidate(data.candidate)
      );
    } catch (error) {
      console.log("ICE candidate error:", error.message);
    }
  });

  useSocketEvent("in_app_call_reject", (data) => {
    if (!data || data.toRole !== role) return;
    if (!activeCallRef.current || activeCallRef.current.callId !== data.callId) return;

    toast.error("Call was rejected.");
    resetCallState();
  });

  useSocketEvent("in_app_call_end", (data) => {
    if (!data || data.toRole !== role) return;

    const matchingActiveCall =
      activeCallRef.current && activeCallRef.current.callId === data.callId;
    const matchingIncomingCall =
      incomingCallRef.current && incomingCallRef.current.callId === data.callId;

    if (!matchingActiveCall && !matchingIncomingCall) return;

    resetCallState();
    toast("Call ended by the other side.");
  });

  useEffect(() => {
    return () => {
      stopIncomingRingtone();
      resetCallState();
    };
  }, []);

  return {
    callStatus,
    incomingCall,
    activeCall,
    remoteAudioRef,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
  };
};

export default useInAppCall;
