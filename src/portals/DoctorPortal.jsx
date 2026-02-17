import React, { useState, useEffect } from 'react';
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  onSnapshot,
  setDoc,
  arrayUnion, increment
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, auth } from '../services/firebase';
import { useNavigate } from 'react-router-dom';

const DoctorPortal = () => {
  const [online, setOnline] = useState(false);
  const [profile, setProfile] = useState({ name: '', phoneNumber: '', licenseNumber: '' });
  const [schedule, setSchedule] = useState({
    sun: { from: '', to: '' }, mon: { from: '', to: '' }, tue: { from: '', to: '' },
    wed: { from: '', to: '' }, thu: { from: '', to: '' }, fri: { from: '', to: '' },
    sat: { from: '', to: '' }
  });

  const [pendingBookings, setPendingBookings] = useState([]);
  const [completedBookings, setCompletedBookings] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showSchedule, setShowSchedule] = useState(false);

  const navigate = useNavigate();
  const storage = getStorage();


  useEffect(() => {
    const currentUser = auth.currentUser;
    if (currentUser) {
      loadProfile(currentUser.uid);
      listenToPendingBookings(currentUser.uid);
      listenToCompletedBookings(currentUser.uid);
    }
  }, []);

  /* ================= PROFILE ================= */
  const loadProfile = async (uid) => {
    try {
      const userRef = doc(db, 'users', uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const data = snap.data();
        setProfile({
          name: data.name || 'Dr. Unknown',
          phoneNumber: data.phoneNumber || '',
          licenseNumber: data.licenseNumber || ''
        });
        setOnline(data.online || false);
        setSchedule(data.schedule || schedule);
      }
      setLoading(false);
    } catch {
      setError('Profile load failed');
      setLoading(false);
    }
  };

  /* ================= BOOKINGS ================= */
  const listenToPendingBookings = (doctorId) => {
    const q = query(
      collection(db, 'bookings'),
      where('doctorId', '==', doctorId),
      where('status', 'in', ['pending', 'accepted'])
    );

    return onSnapshot(q, snap => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setPendingBookings(list);
    });
  };

  const listenToCompletedBookings = (doctorId) => {
    const q = query(
      collection(db, 'bookings'),
      where('doctorId', '==', doctorId),
      where('status', '==', 'completed')
    );

    return onSnapshot(q, snap => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setCompletedBookings(list);
    });
  };

  /* ================= ACTIONS ================= */
  const toggleOnline = async () => {
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), { online: !online });
      setOnline(!online);
    } catch {
      setError('Status update failed');
    }
  };

  const saveSchedule = async () => {
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), { schedule });
    } catch {
      setError('Schedule save failed');
    }
  };

  const handleFileUpload = async (e, bookingId) => {
  try {
    const file = e.target.files[0];
    if (!file) return;

    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/jpg',
      'image/heic',
      'image/heif'
    ];

    if (!allowedTypes.includes(file.type)) {
      alert('Only PDF or image files are allowed');
      return;
    }

    const storageRef = ref(
      storage,
      `prescriptions/${bookingId}/${Date.now()}_${file.name}`
    );

    // Upload to Firebase Storage
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);

    const bookingRef = doc(db, 'bookings', bookingId);

    // Save in bookings
    await updateDoc(bookingRef, {
      prescriptions: arrayUnion({
        name: file.name,
        url: downloadURL,
        type: file.type,
        uploadedAt: new Date().toISOString()
      }),
      prescriptionCount: increment(1),
      prescriptionNote: 'Prescription added'
    });

    alert('Prescription uploaded successfully');
  } catch (err) {
    console.error('Upload failed', err);
    alert('Upload failed');
  }
};


  const handleBookingAction = async (bookingId, action) => {
    try {
      const bookingRef = doc(db, 'bookings', bookingId);

      if (action === 'accepted') {
        const roomId = `room-${bookingId}`;

        await setDoc(doc(db, 'videoRooms', roomId), {
          bookingId,
          doctorId: auth.currentUser.uid,
          status: 'active',
          users: { [auth.currentUser.uid]: 'doctor' },
          createdAt: new Date().toISOString()
        }, { merge: true });

        await updateDoc(bookingRef, {
          status: 'accepted',
          videoRoomId: roomId,
          updatedAt: new Date().toISOString()
        });

        navigate(`/video-call/${roomId}?booking=${bookingId}`);
      } else {
        await updateDoc(bookingRef, { status: action });
      }
    } catch (err) {
      setError('Action failed: ' + err.message);
    }
  };

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>;

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 20 }}>
      <h1 style={{ textAlign: 'center' }}>Doctor Portal</h1>

      {/* PROFILE */}
      <Card>
        <h3>👤 Profile</h3>
        <p><b>Name:</b> {profile.name}</p>
        <p><b>Phone:</b> {profile.phoneNumber}</p>
        <p><b>License:</b> {profile.licenseNumber}</p>
        <button onClick={toggleOnline} style={btn(online ? '#dc2626' : '#059669')}>
          {online ? 'Go Offline' : 'Go Online'}
        </button>
      </Card>

      {/* WEEKLY SCHEDULE ACCORDION */}
      <Card>
        <div onClick={() => setShowSchedule(v => !v)} style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}>
          <h3>📅 Weekly Schedule</h3>
          <span>{showSchedule ? '▲' : '＋'}</span>
        </div>

        {showSchedule && (
          <>
            {Object.keys(schedule).map(day => (
              <div key={day} style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <b style={{ width: 50 }}>{day}</b>
                <input type="time" value={schedule[day].from}
                  onChange={e => setSchedule(s => ({ ...s, [day]: { ...s[day], from: e.target.value } }))} />
                <input type="time" value={schedule[day].to}
                  onChange={e => setSchedule(s => ({ ...s, [day]: { ...s[day], to: e.target.value } }))} />
              </div>
            ))}
            <button onClick={saveSchedule} style={btn('#2563eb')}>Save Schedule</button>
          </>
        )}
      </Card>

      {/* PENDING BOOKINGS */}
      <h3>📋 Active Consultations</h3>
      {pendingBookings.map(b => (
        <Card key={b.id}>
          <b>{b.customerName}</b>
          <p>{new Date(b.createdAt).toLocaleString()}</p>
          {b.status === 'pending' && (
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => handleBookingAction(b.id, 'accepted')} style={btn('#059669')}>Accept</button>
              <button onClick={() => handleBookingAction(b.id, 'declined')} style={btn('#dc2626')}>Decline</button>
            </div>
          )}
        </Card>
      ))}

      {/* COMPLETED BOOKINGS */}
      <h3 style={{ marginTop: 30 }}>✅ Completed Consultations</h3>

      {completedBookings.length === 0 && <p>No completed bookings</p>}

      {completedBookings.map(b => (
  <Card key={b.id}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <b>{b.customerName}</b>
        <p style={{ fontSize: 13, opacity: 0.7 }}>
          {b.callEndedAt?.toDate?.().toLocaleString() || 'N/A'}
        </p>
        <p style={{ fontSize: 13, fontWeight: 'bold', color: '#2563eb' }}>
          ⏱ Duration: {Math.floor((b.callDurationSeconds || 0) / 60)}m {(b.callDurationSeconds || 0) % 60}s
        </p>
        {b.prescriptionCount > 0 && (
  <p style={{ fontSize: 12, color: '#059669', marginTop: 6 }}>
    📎 {b.prescriptionCount} prescription{b.prescriptionCount > 1 ? 's' : ''} added
  </p>
)}

      </div>

            <button
  onClick={() => document.getElementById(`upload-${b.id}`).click()}
  style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    background: '#2563eb',
    color: '#fff',
    borderRadius: '50%',
    cursor: 'pointer',
    fontSize: 24,
    fontWeight: 'bold',
    border: 'none',
    boxShadow: '0 2px 4px rgba(37, 99, 235, 0.3)'
  }}
>
  +
</button>

<input
  id={`upload-${b.id}`}
  type="file"
  accept=".pdf,image/*,.heic,.heif"
  style={{ display: 'none' }}
  onChange={(e) => handleFileUpload(e, b.id)}
/>

          </div>
        </Card>
      ))}

      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
};

/* ================= STYLES ================= */
const Card = ({ children }) => (
  <div style={{
    background: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
  }}>
    {children}
  </div>
);

const btn = (bg) => ({
  background: bg,
  color: '#fff',
  padding: 12,
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
  width: '100%'
});

export default DoctorPortal;
