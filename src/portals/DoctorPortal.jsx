import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, collection, query, where, onSnapshot, setDoc } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { useNavigate } from 'react-router-dom';

const DoctorPortal = () => {
  const [online, setOnline] = useState(false);
  const [profile, setProfile] = useState({ name: '', phoneNumber: '', licenseNumber: '' });
  const [schedule, setSchedule] = useState({
    sun: {from: '', to: ''}, mon: {from: '', to: ''}, tue: {from: '', to: ''},
    wed: {from: '', to: ''}, thu: {from: '', to: ''}, fri: {from: '', to: ''},
    sat: {from: '', to: ''}
  });
  const [pendingBookings, setPendingBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (currentUser) {
      loadProfile(currentUser.uid);
      listenToPendingBookings(currentUser.uid);
    }
  }, []);

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
    } catch (err) {
      setError('Profile load failed');
      setLoading(false);
    }
  };

  const listenToPendingBookings = (doctorId) => {
    const q = query(
      collection(db, 'bookings'),
      where('doctorId', '==', doctorId),
      where('status', 'in', ['pending', 'accepted'])
    );
    return onSnapshot(q, snap => {
      const bookings = [];
      snap.forEach(doc => bookings.push({ id: doc.id, ...doc.data() }));
      setPendingBookings(bookings);
    });
  };

  const toggleOnline = async () => {
    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(userRef, { online: !online });
      setOnline(!online);
      setError(null);
    } catch (err) {
      setError('Status update failed');
    }
  };

  const saveSchedule = async () => {
    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(userRef, { schedule });
      setError(null);
    } catch (err) {
      setError('Schedule save failed');
    }
  };

 const handleBookingAction = async (bookingId, action) => {
  try {
    const bookingRef = doc(db, 'bookings', bookingId);
    
    if (action === 'accepted') {
      const roomId = `room-${bookingId}`;
      
      // ✅ DOCTOR AUTO-CREATES ROOM + JOINS
      await setDoc(doc(db, 'videoRooms', roomId), {
        bookingId,
        doctorId: auth.currentUser.uid,
        customerId: pendingBookings.find(b => b.id === bookingId)?.customerId,
        status: 'active',  // ✅ Changed from 'waiting' to 'active'
        users: {
          [auth.currentUser.uid]: 'doctor'  // ✅ Doctor immediately joins
        },
        createdAt: new Date().toISOString()
      }, { merge: true });

      // Update booking
      await updateDoc(bookingRef, {
        status: 'accepted',
        videoRoomId: roomId,
        updatedAt: new Date().toISOString()
      });
      
      // ✅ DOCTOR AUTO-JOINS
      navigate(`/video-call/${roomId}?booking=${bookingId}`);
      
    } else {
      // Decline
      await updateDoc(bookingRef, { status: action });
    }
    
    setError(null);
  } catch (err) {
    console.error('Action failed:', err);
    setError('Action failed: ' + err.message);
  }
};


  if (loading) {
    return (
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        minHeight: '100vh', background: '#f8fafc'
      }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{
      maxWidth: '600px', margin: '0 auto', padding: '20px',
      background: '#f8fafc', minHeight: '100vh'
    }}>
      <h1 style={{textAlign: 'center', color: '#1e293b', marginBottom: '32px'}}>
        Doctor Portal
      </h1>

      {/* Profile Card */}
      <div style={{
        background: 'white', padding: '24px', borderRadius: '12px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.05)', marginBottom: '24px'
      }}>
        <h3 style={{marginTop: 0, color: '#374151'}}>👤 Profile</h3>
        <p><strong>Name:</strong> <span style={{color: '#1e293b'}}>{profile.name}</span></p>
        <p><strong>Phone:</strong> <span style={{color: '#1e293b'}}>{profile.phoneNumber}</span></p>
        <p><strong>License:</strong> <span style={{color: '#1e293b'}}>{profile.licenseNumber}</span></p>
        <button 
          onClick={toggleOnline}
          style={{
            width: '100%', padding: '14px', marginTop: '16px',
            background: online ? '#dc2626' : '#059669',
            color: 'white', border: 'none', borderRadius: '8px',
            fontSize: '16px', fontWeight: 500, cursor: 'pointer'
          }}
        >
          {online ? '🟢 Go Offline' : '🔴 Go Online'}
        </button>
      </div>

      {/* Schedule */}
      <div style={{
        background: 'white', padding: '24px', borderRadius: '12px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.05)', marginBottom: '24px'
      }}>
        <h3 style={{marginTop: 0, color: '#374151'}}>📅 Weekly Schedule</h3>
        <div style={{maxHeight: '280px', overflowY: 'auto'}}>
          {['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map(day => (
            <div key={day} style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '12px 0', borderBottom: '1px solid #e2e8f0'
            }}>
              <span style={{minWidth: '60px', fontWeight: 600, textTransform: 'capitalize'}}>
                {day}
              </span>
              <input 
                type="time" 
                value={schedule[day].from}
                onChange={e => setSchedule(prev => ({
                  ...prev, [day]: {...prev[day], from: e.target.value}
                }))}
                style={{
                  padding: '10px 14px', borderRadius: '6px',
                  border: '1px solid #d1d5db', background: 'white',
                  fontSize: '14px'
                }}
              />
              <span style={{color: '#6b7280', fontSize: '14px'}}>to</span>
              <input 
                type="time" 
                value={schedule[day].to}
                onChange={e => setSchedule(prev => ({
                  ...prev, [day]: {...prev[day], to: e.target.value}
                }))}
                style={{
                  padding: '10px 14px', borderRadius: '6px',
                  border: '1px solid #d1d5db', background: 'white',
                  fontSize: '14px'
                }}
              />
            </div>
          ))}
        </div>
        <button 
          onClick={saveSchedule}
          style={{
            width: '100%', padding: '14px', marginTop: '16px',
            background: '#2563eb', color: 'white', border: 'none',
            borderRadius: '8px', fontSize: '16px', fontWeight: 500,
            cursor: 'pointer'
          }}
        >
          💾 Save Schedule
        </button>
      </div>

      {/* Bookings */}
      <div>
        <h3 style={{color: '#1e293b', marginBottom: '20px'}}>
          📋 Consultations ({pendingBookings.length})
        </h3>
        {pendingBookings.length === 0 ? (
          <div style={{
            background: 'white', padding: '40px 24px', borderRadius: '12px',
            textAlign: 'center', color: '#64748b', boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
          }}>
            No consultations waiting
          </div>
        ) : (
          pendingBookings.map(booking => (
            <div key={booking.id} style={{
              background: 'white', padding: '20px', borderRadius: '12px',
              marginBottom: '16px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
            }}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <div>
                  <p style={{margin: '0 0 4px 0', fontWeight: 600}}>
                    {booking.customerName}
                  </p>
                  <p style={{color: '#64748b', margin: 0, fontSize: '14px'}}>
                    {new Date(booking.createdAt).toLocaleString()}
                  </p>
                </div>
                <span style={{
                  padding: '6px 12px', borderRadius: '20px',
                  background: booking.status === 'accepted' ? '#059669' : '#f59e0b',
                  color: 'white', fontSize: '12px', fontWeight: 500
                }}>
                  {booking.status.toUpperCase()}
                </span>
              </div>
              
              {booking.status === 'pending' ? (
                <div style={{display: 'flex', gap: '12px', marginTop: '16px'}}>
                  <button 
                    onClick={() => handleBookingAction(booking.id, 'accepted')}
                    style={{
                      flex: 1, padding: '12px', background: '#059669',
                      color: 'white', border: 'none', borderRadius: '8px',
                      fontWeight: 500, cursor: 'pointer', fontSize: '14px'
                    }}
                  >
                    Accept
                  </button>
                  <button 
                    onClick={() => handleBookingAction(booking.id, 'declined')}
                    style={{
                      flex: 1, padding: '12px', background: '#dc2626',
                      color: 'white', border: 'none', borderRadius: '8px',
                      fontWeight: 500, cursor: 'pointer', fontSize: '14px'
                    }}
                  >
                    Decline
                  </button>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>

      {error && (
        <div style={{
          background: '#fee2e2', border: '1px solid #fecaca', color: '#dc2626',
          padding: '16px', borderRadius: '8px', marginTop: '24px', textAlign: 'center'
        }}>
          {error} <button onClick={() => setError(null)} 
            style={{background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer'}}>
            ×
          </button>
        </div>
      )}
    </div>
  );
};

export default DoctorPortal;
