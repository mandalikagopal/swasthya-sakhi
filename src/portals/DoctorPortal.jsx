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
  arrayUnion, 
  increment,
  writeBatch,
  getDocs // Added for atomic refunds
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, auth } from '../services/firebase';
import { useNavigate } from 'react-router-dom';

const DoctorPortal = () => {
  const [online, setOnline] = useState(false);
  // ✅ Updated profile state to include balances
  const [profile, setProfile] = useState({ 
    name: '', 
    phoneNumber: '', 
    licenseNumber: '',
    waitingBalance: 0,
    accumulatedBalance: 0 
  });
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

  // Add these state variables near your other useState hooks
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [upiId, setUpiId] = useState('');

  const handleWithdrawalRequest = async (e) => {
    e.preventDefault();
    const amount = parseFloat(withdrawAmount);

    // Basic Validation
    if (!upiId.includes('@')) {
      alert("Please enter a valid UPI ID (e.g., name@upi)");
      return;
    }
    if (amount <= 0 || amount > profile.accumulatedBalance) {
      alert("Invalid amount. Ensure it's greater than 0 and less than your total balance.");
      return;
    }

    try {
      const batch = writeBatch(db);
      const doctorRef = doc(db, 'users', auth.currentUser.uid);
      const payoutRef = doc(collection(db, 'payout_requests'));

      // 1. Create the payout record for you to see in the dashboard
      batch.set(payoutRef, {
        doctorId: auth.currentUser.uid,
        doctorName: profile.name,
        amount: amount,
        upiId: upiId,
        status: 'pending',
        createdAt: new Date().toISOString()
      });

      // 2. Deduct the amount from Accumulated Balance immediately
      batch.update(doctorRef, {
        accumulatedBalance: increment(-amount)
      });

      await batch.commit();

      alert("Withdrawal request submitted! Funds will be sent to " + upiId);
      setIsWithdrawModalOpen(false);
      setWithdrawAmount('');
      setUpiId('');
    } catch (err) {
      console.error("Withdrawal error:", err);
      alert("Request failed. Please try again.");
    }
  };

  /* ================= AUTO-PAYMENT PROCESSOR ================= */
  useEffect(() => {
    const processPendingPayments = async () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        // Look for completed bookings for this doctor that aren't settled yet
        const q = query(
          collection(db, 'bookings'),
          where('doctorId', '==', user.uid),
          where('status', '==', 'completed'),
          where('paymentStatus', '==', 'escrow')
        );

        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) return;

        const batch = writeBatch(db);
        let count = 0;

        querySnapshot.forEach((docSnap) => {
          const booking = docSnap.data();
          const amount = booking.amountPaid || 0;
          const duration = booking.callDurationSeconds || 0;
          
          const doctorRef = doc(db, 'users', user.uid);
          const customerRef = doc(db, 'users', booking.customerId);
          const bookingRef = docSnap.ref;

          if (duration >= 30) {
            // SUCCESS: Move from Waiting to Accumulated
            batch.update(doctorRef, {
              waitingBalance: increment(- 0.9 * amount),
              accumulatedBalance: increment(0.9 * amount)
            });
          } else {
            // REFUND: Give back to customer
            batch.update(customerRef, {
              walletBalance: increment(amount)
            });
            batch.update(doctorRef, {
              waitingBalance: increment(- 0.9 * amount)
            });
          }

          // Mark as settled so we don't process it again
          batch.update(bookingRef, { paymentStatus: 'complete' });
          count++;
        });

        if (count > 0) {
          await batch.commit();
          console.log(`Processed ${count} pending payments.`);
        }
      } catch (err) {
        console.error("Payment processing error:", err);
      }
    };

    if (!loading) {
      processPendingPayments();
    }
  }, [loading]); // Runs once when the portal finishes loading

  {/* WITHDRAW BUTTON (Add this below your Balance cards) */}

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (currentUser) {
      // ✅ Changed loadProfile to a real-time listener
      const userRef = doc(db, 'users', currentUser.uid);
      const unsubProfile = onSnapshot(userRef, (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setProfile({
            name: data.name || 'Dr. Unknown',
            phoneNumber: data.phoneNumber || '',
            licenseNumber: data.licenseNumber || '',
            waitingBalance: data.waitingBalance || 0,
            accumulatedBalance: data.accumulatedBalance || 0
          });
          setOnline(data.online || false);
          setSchedule(data.schedule || schedule);
        }
        setLoading(false);
      });

      listenToPendingBookings(currentUser.uid);
      listenToCompletedBookings(currentUser.uid);
      
      return () => unsubProfile();
    }
  }, []);

    useEffect(() => {
    const killLeakingHardware = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasActiveHardware = devices.some(device => device.kind === 'videoinput' || device.kind === 'audioinput');
  
        if (hasActiveHardware) {
          navigator.mediaDevices.getUserMedia({ audio: true, video: true })
            .then(stream => {
              stream.getTracks().forEach(track => track.stop());
            })
            .catch(() => {
              console.log("audio and video inactive");
            });
        }
      } catch (err) {
        console.log("Hardware cleanup skipped:", err);
      }
    };
  
    killLeakingHardware();
  }, []);

  /* ================= PROFILE ================= */
  const loadProfile = async (uid) => {
    // This is now handled by the onSnapshot listener in useEffect
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

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'image/heic', 'image/heif'];
    if (!allowedTypes.includes(file.type)) {
      alert('Only PDF or image files are allowed');
      return;
    }

    const storageRef = ref(storage, `prescriptions/${bookingId}/${Date.now()}_${file.name}`);
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);

    const bookingRef = doc(db, 'bookings', bookingId);

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
      const bookingSnap = await getDoc(bookingRef);
      const bookingData = bookingSnap.data();

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
      } else if (action === 'declined') {
        // ✅ REFUND LOGIC: Move from Waiting -> Customer Wallet
        const batch = writeBatch(db);
        const customerRef = doc(db, 'users', bookingData.customerId);
        const doctorRef = doc(db, 'users', auth.currentUser.uid);

        batch.update(customerRef, { walletBalance: increment(bookingData.amountPaid) });
        batch.update(doctorRef, { waitingBalance: increment(-bookingData.amountPaid) });
        batch.update(bookingRef, { status: 'declined' });

        await batch.commit();
        alert('Booking declined and customer refunded.');
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

      {/* ✅ WALLET & BALANCES SECTION */}
      <div style={{ display: 'flex', gap: 15, marginBottom: 20 }}>
        <div style={{ flex: 1, background: '#059669', color: 'white', padding: 15, borderRadius: 12, boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
          <p style={{ margin: 0, fontSize: 12, opacity: 0.8 }}>Accumulated Balance</p>
          <h2 style={{ margin: '5px 0' }}>₹{profile.accumulatedBalance}</h2>
        </div>
        <div style={{ flex: 1, background: '#f59e0b', color: 'white', padding: 15, borderRadius: 12, boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
          <p style={{ margin: 0, fontSize: 12, opacity: 0.8 }}>Waiting Balance</p>
          <h2 style={{ margin: '5px 0' }}>₹{profile.waitingBalance}</h2>
        </div>
      </div>
      
      <button 
        onClick={() => setIsWithdrawModalOpen(true)}
        style={{
          width: '100%', padding: '12px', background: '#059669', color: 'white',
          border: 'none', borderRadius: '8px', fontWeight: 'bold', marginBottom: '20px', cursor: 'pointer'
        }}
      >
        Request UPI Withdrawal
      </button>

      {/* WITHDRAWAL MODAL */}
      {isWithdrawModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div style={{
            background: 'white', padding: '30px', borderRadius: '16px', width: '90%', maxWidth: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
          }}>
            <h2 style={{ marginTop: 0 }}>Withdraw Funds</h2>
            <p style={{ color: '#64748b', fontSize: '14px' }}>Available: <b>₹{profile.accumulatedBalance}</b></p>
            
            <form onSubmit={handleWithdrawalRequest}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: '5px', fontWeight: 'bold' }}>Amount (₹)</label>
                <input 
                  type="number" required placeholder="Min 100"
                  value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: '5px', fontWeight: 'bold' }}>UPI ID</label>
                <input 
                  type="text" required placeholder="doctorname@okaxis"
                  value={upiId} onChange={(e) => setUpiId(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" onClick={() => setIsWithdrawModalOpen(false)} style={{ flex: 1, padding: '12px', background: '#f1f5f9', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="submit" style={{ flex: 1, padding: '12px', background: '#059669', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                  Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
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
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <b>{b.customerName}</b>
            <b style={{ color: '#059669' }}>₹{b.amountPaid}</b>
          </div>
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