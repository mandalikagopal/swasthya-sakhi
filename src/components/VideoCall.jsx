import React, { useEffect, useRef, useState, useCallback } from 'react';
import Peer from 'simple-peer';
import { db, auth } from '../services/firebase';
import {
  doc,
  onSnapshot,
  getDoc,
  updateDoc,
  setDoc,
  collection,
  addDoc,
  deleteDoc,
  getDocs,
  serverTimestamp
} from 'firebase/firestore';
import { useParams, useNavigate } from 'react-router-dom';

const VideoCall = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const bookingId = roomId.replace('room-', '');

  const localVideo = useRef(null);
  const remoteVideo = useRef(null);
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const roomRef = useRef(null);
  const unsubscribeRoomRef = useRef(null);
  const isPeerActiveRef = useRef(false);
  const callStartTimeRef = useRef(null);

  const [userRole, setUserRole] = useState('loading');
  const [callStatus, setCallStatus] = useState('waiting');
  const [errorMsg, setErrorMsg] = useState('');
  const [duration, setDuration] = useState(0);

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  /* ================= CLEANUP ================= */
  const cleanupEverything = useCallback(() => {
    if (unsubscribeRoomRef.current) {
      unsubscribeRoomRef.current();
      unsubscribeRoomRef.current = null;
    }

    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }

    if (remoteVideo.current) remoteVideo.current.srcObject = null;
    isPeerActiveRef.current = false;
    setCallStatus('waiting');
  }, []);

  const clearRoomData = async () => {
    if (!roomRef.current) return;

    const [doctorCands, customerCands] = await Promise.all([
      getDocs(collection(roomRef.current, 'doctorCandidates')),
      getDocs(collection(roomRef.current, 'customerCandidates'))
    ]);

    await Promise.all([
      ...doctorCands.docs.map(d => deleteDoc(d.ref)),
      ...customerCands.docs.map(d => deleteDoc(d.ref))
    ]);

    await updateDoc(roomRef.current, {
      offer: null,
      answer: null
    });
  };

  /* ================= CREATE PEER ================= */
  const createPeerConnection = useCallback(async (isDoctor, initialSignal) => {
    if (isPeerActiveRef.current || !localStreamRef.current) return;

    isPeerActiveRef.current = true;

    const peer = new Peer({
      initiator: isDoctor,
      trickle: true,
      stream: localStreamRef.current,
      config: {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      }
    });

    peerRef.current = peer;

    peer.on('stream', async (remoteStream) => {
      remoteVideo.current.srcObject = remoteStream;
      remoteVideo.current.play().catch(() => {});
      setCallStatus('active');

      if (!callStartTimeRef.current) {
        callStartTimeRef.current = Date.now();
        await updateDoc(doc(db, 'bookings', bookingId), {
          status: 'in_call',
          callStartedAt: serverTimestamp()
        });
      }
    });

    peer.on('signal', async (data) => {
      if (!roomRef.current) return;

      if (data.type === 'offer') {
        await updateDoc(roomRef.current, { offer: data });
      } else if (data.type === 'answer') {
        await updateDoc(roomRef.current, { answer: data });
      } else if (data.candidate) {
        const col = isDoctor ? 'doctorCandidates' : 'customerCandidates';
        await addDoc(collection(roomRef.current, col), data);
      }
    });

    const otherCol = isDoctor ? 'customerCandidates' : 'doctorCandidates';
    onSnapshot(collection(roomRef.current, otherCol), snap => {
      snap.docChanges().forEach(c => {
        if (c.type === 'added') peer.signal(c.doc.data());
      });
    });

    if (initialSignal) peer.signal(initialSignal);

    peer.on('close', cleanupEverything);
    peer.on('error', cleanupEverything);
  }, [bookingId, cleanupEverything]);

  /* ================= INIT ================= */
  useEffect(() => {
    const init = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const bookingRef = doc(db, 'bookings', bookingId);
      const bookingSnap = await getDoc(bookingRef);

      if (bookingSnap.exists() && bookingSnap.data().status === 'completed') {
        setCallStatus('completed');
        setErrorMsg('Booking already completed');
        return;
      }

      const userSnap = await getDoc(doc(db, 'users', user.uid));
      const role = userSnap.data()?.role || 'customer';
      setUserRole(role);

      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      localVideo.current.srcObject = stream;

      roomRef.current = doc(db, 'videoRooms', roomId);
      await setDoc(roomRef.current, { active: true }, { merge: true });

      unsubscribeRoomRef.current = onSnapshot(roomRef.current, snap => {
        const data = snap.data();
        if (!data) return;

        if (data.ended) {
          cleanupEverything();
          navigate('/');
        }

        if (role === 'doctor' && !data.offer && !isPeerActiveRef.current) {
          createPeerConnection(true);
        }

        if (role === 'customer' && data.offer && !isPeerActiveRef.current) {
          createPeerConnection(false, data.offer);
        }

        if (role === 'doctor' && data.answer && peerRef.current && !peerRef.current._answered) {
          peerRef.current.signal(data.answer);
          peerRef.current._answered = true;
        }
      });
    };

    init();

    return () => {
      cleanupEverything();
      localStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [bookingId, roomId, createPeerConnection, cleanupEverything, navigate]);

  /* ================= CONTROLS ================= */
  const toggleMute = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setIsMuted(!track.enabled);
    }
  };

  const toggleVideo = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setIsVideoOff(!track.enabled);
    }
  };

  const endCall = async () => {
    const durationSeconds = callStartTimeRef.current
      ? Math.floor((Date.now() - callStartTimeRef.current) / 1000)
      : 0;

    await updateDoc(doc(db, 'bookings', bookingId), {
      status: 'completed',
      callEndedAt: serverTimestamp(),
      callDurationSeconds: durationSeconds
    });

    await updateDoc(roomRef.current, {
      ended: true,
      endedAt: serverTimestamp()
    });

    await clearRoomData();
    cleanupEverything();
    navigate('/');
  };

  /* ================= UI ================= */
  if (callStatus === 'completed') {
    return <h2 style={{ color: '#4caf50', textAlign: 'center' }}>✅ Booking Completed</h2>;
  }

  return (
    <div style={{ background: '#000', height: '100vh', position: 'relative' }}>
      <video
        ref={remoteVideo}
        autoPlay
        playsInline
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />

      {/* Picture-in-picture local video */}
      <video
        ref={localVideo}
        autoPlay
        muted
        playsInline
        style={{
          position: 'absolute',
          bottom: 90,
          right: 20,
          width: 120,
          height: 160,
          borderRadius: 12,
          border: '2px solid #fff',
          objectFit: 'cover'
        }}
      />

      {/* Controls */}
      <div style={{
        position: 'absolute',
        bottom: 20,
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        gap: 12
      }}>
        <button onClick={toggleMute}>{isMuted ? 'Unmute' : 'Mute'}</button>
        <button onClick={toggleVideo}>{isVideoOff ? 'Video On' : 'Video Off'}</button>
        <button onClick={endCall} style={{ background: 'red', color: '#fff' }}>End</button>
      </div>
    </div>
  );
};

export default VideoCall;
