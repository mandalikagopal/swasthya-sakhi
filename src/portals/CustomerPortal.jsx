import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc, addDoc } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { useNavigate } from 'react-router-dom';

const CustomerPortal = () => {
  const [medicines] = useState([
    { id: 1, name: 'Paracetamol 500mg', price: 25 },
    { id: 2, name: 'Vitamin C 500mg', price: 150 },
    { id: 3, name: 'Crocin 650mg', price: 35 }
  ]);
  const [onlineDoctors, setOnlineDoctors] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (currentUser) {
      loadProfile(currentUser.uid);
      listenToMyBookings(currentUser.uid);
    }
    const unsubDoctors = loadOnlineDoctors();
    return unsubDoctors;
  }, []);

  const loadOnlineDoctors = () => {
    const q = query(collection(db, 'users'), where('role', '==', 'doctor'), where('online', '==', true));
    return onSnapshot(q, snap => {
      const doctors = [];
      snap.forEach(doc => doctors.push({ id: doc.id, ...doc.data() }));
      setOnlineDoctors(doctors);
    });
  };

  const loadProfile = async (uid) => {
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) {
        setUserProfile(snap.data());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const listenToMyBookings = (customerId) => {
    const q = query(collection(db, 'bookings'), where('customerId', '==', customerId));
    return onSnapshot(q, snap => {
      const bookings = [];
      snap.forEach(doc => bookings.push({ id: doc.id, ...doc.data() }));
      setMyBookings(bookings);
    });
  };

  const bookConsultation = async (doctorId, doctorName) => {
  try {
    // ✅ FIX 1: Use addDoc instead of doc(collection)
    const newBookingRef = await addDoc(collection(db, 'bookings'), {
      customerId: auth.currentUser.uid,
      doctorId,
      customerName: userProfile?.name || 'Customer',
      doctorName,  // ✅ FIX 2: Add doctor name
      createdAt: new Date().toISOString(),
      status: 'pending'
    });
    alert('✅ Booking request sent!');
  } catch (err) {
    console.error('Booking error:', err);  // ✅ FIX 3: Log full error
    alert(`Failed: ${err.message}`);
  }
};


 const CustomerJoinButton = ({ roomId, bookingId }) => {
  const [roomStatus, setRoomStatus] = useState(null);
  
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'videoRooms', roomId), snap => {
      const data = snap.data();
      setRoomStatus(data?.status);
    });
    return unsub;
  }, [roomId]);

  if (roomStatus === 'completed') {
    return <span style={{color: '#10B981'}}>✓ Completed</span>;
  }

  const canJoin = roomStatus === 'active';

  return (
    <button 
      onClick={() => navigate(`/video-call/${roomId}?booking=${bookingId}`)}
      disabled={!canJoin}
      style={{
        width: '100%', padding: '12px', marginTop: '8px',
        background: canJoin ? '#10B981' : '#6b7280',  // Green when ready
        color: 'white', border: 'none', borderRadius: '8px',
        fontWeight: 500
      }}
    >
      {canJoin ? '✅ Join Call Now' : '⏳ Doctor Preparing...'}
    </button>
  );
};

  const callAmbulance = () => window.location.href = 'tel:108';

  if (loading) return <div style={{textAlign: 'center', padding: '50px'}}>Loading...</div>;

  return (
    <div style={{
      maxWidth: '1200px', margin: '0 auto', padding: '20px',
      background: '#f8fafc', minHeight: '100vh'
    }}>
      {/* Header - Centered */}
      <div style={{textAlign: 'center', marginBottom: '40px'}}>
        <h1 style={{color: '#1e293b', marginBottom: '8px'}}>Swasthya Sakhi</h1>
        <p style={{color: '#64748b'}}>Welcome, {userProfile?.name || 'Customer'}</p>
      </div>

      {/* Emergency Button - Full Width */}
      <div style={{marginBottom: '30px'}}>
        <button onClick={callAmbulance} style={{
          width: '100%', padding: '16px', background: '#dc2626',
          color: 'white', border: 'none', borderRadius: '12px',
          fontSize: '18px', fontWeight: 600, cursor: 'pointer'
        }}>
          🚨 Emergency Ambulance 108
        </button>
      </div>

      {/* Online Doctors - Grid */}
      <div style={{marginBottom: '40px'}}>
        <h2 style={{color: '#1e293b', marginBottom: '20px'}}>
          👨‍⚕️ Online Doctors ({onlineDoctors.length})
        </h2>
        {onlineDoctors.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '60px 20px',
            background: 'white', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
          }}>
            <p style={{color: '#64748b'}}>No doctors online right now</p>
          </div>
        ) : (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '20px'
          }}>
            {onlineDoctors.map(doctor => (
              <div key={doctor.id} style={{
                background: 'white', padding: '24px', borderRadius: '12px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
              }}>
                <div>
                  <h3 style={{margin: '0 0 8px 0', color: '#1e293b'}}>{doctor.name}</h3>
                  <p style={{color: '#64748b', margin: '0 0 12px 0'}}>{doctor.specialization}</p>
                  <p style={{fontWeight: 600, color: '#059669', margin: '0 0 16px 0'}}>
                    ₹{doctor.rate || 100}/min
                  </p>
                </div>
                <button onClick={() => bookConsultation(doctor.id, doctor.name)} style={{
                  width: '100%', padding: '14px', background: '#2563eb',
                  color: 'white', border: 'none', borderRadius: '8px',
                  fontWeight: 500, cursor: 'pointer'
                }}>
                  Book Consultation
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* My Bookings */}
      <div>
        <h2 style={{color: '#1e293b', marginBottom: '20px'}}>
          📋 My Bookings ({myBookings.length})
        </h2>
        {myBookings.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '60px 20px',
            background: 'white', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
          }}>
            <p style={{color: '#64748b'}}>No bookings yet</p>
          </div>
        ) : (
          myBookings.map(booking => (
            <div key={booking.id} style={{
              background: 'white', padding: '20px', borderRadius: '12px',
              marginBottom: '16px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
            }}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <div>
                  <p style={{margin: '0 0 4px 0', fontWeight: 600}}>{booking.doctorName}</p>
                  <p style={{color: '#64748b', margin: 0, fontSize: '14px'}}>
                    {new Date(booking.createdAt).toLocaleString()}
                  </p>
                </div>
                <span style={{
                  padding: '6px 12px', borderRadius: '20px',
                  background: booking.status === 'accepted' ? '#059669' : 
                            booking.status === 'pending' ? '#f59e0b' : '#dc2626',
                  color: 'white', fontSize: '12px', fontWeight: 500
                }}>
                  {booking.status.toUpperCase()}
                </span>
              </div>
              
              {booking.status === 'accepted' && booking.videoRoomId && (
                <CustomerJoinButton roomId={booking.videoRoomId} bookingId={booking.id} />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default CustomerPortal;
