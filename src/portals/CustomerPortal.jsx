import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc, addDoc, writeBatch, updateDoc, increment } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { useNavigate } from 'react-router-dom';
import WalletManager from '../components/WalletManager';
import { useCart } from '../context/CartContext';

const CustomerPortal = () => {
  // ✅ Updated: Full medicines list from database + fallback
  // const [medicines, setMedicines] = useState([
  //   { id: 1, name: 'Paracetamol 500mg', price: 1, category: 'Pain Relief' },
  //   { id: 2, name: 'Vitamin C 500mg', price: 1.5, category: 'Vitamins' },
  //   { id: 3, name: 'Crocin 650mg', price: 1.2, category: 'Pain Relief' },
  //   { id: 4, name: 'Ibuprofen 400mg', price: 3, category: 'Pain Relief' },
  //   { id: 5, name: 'Cetirizine 10mg', price: 0.8, category: 'Allergy' },
  //   { id: 6, name: 'Vitamin D3 60000IU', price: 12, category: 'Vitamins' },
  //   { id: 7, name: 'Pantoprazole 40mg', price: 1.8, category: 'Gastro' },
  //   { id: 8, name: 'Aspirin 150mg', price: 0.7, category: 'Pain Relief' },
  //   { id: 9, name: 'Levocetirizine 5mg', price: 1.5, category: 'Allergy' },
  //   { id: 10, name: 'Multivitamin Daily', price: 6, category: 'Vitamins' },
  //   { id: 11, name: 'Ambroxol 30mg', price: 1.5, category: 'Cough' },
  //   { id: 12, name: 'B-Complex', price: 3, category: 'Vitamins' },
  //   { id: 13, name: 'ORS Sachet', price: 6, category: 'Hydration' },
  //   { id: 14, name: 'Dextromethorphan 10mg', price: 2.5, category: 'Cough' },
  //   { id: 15, name: 'Ranitidine 150mg', price: 1.2, category: 'Gastro' }
  // ]);
  const [medicines, setMedicines] = useState([]);
  const [onlineDoctors, setOnlineDoctors] = useState([]);
  const { cart, addtoCart, updateQuantity, removeFromCart, clearCart, cartTotalItems } = useCart();
  const [selectedCategory, setSelectedCategory] = useState('All'); // ✅ NEW: Category state
  const [myBookings, setMyBookings] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [prescriptions, setPrescriptions] = useState([]);
  const navigate = useNavigate();
  const [myOrders, setMyOrders] = useState([]);
  const [showOrder, setShowOrder] = useState(false);
  const [showPharmacy, setPharmacy] = useState(false);
  const [showBookings, setBookings] = useState(false);
  const [showPrescriptionslist, setPrescriptionslist] = useState(false);

  const categories = ['All', ...new Set(medicines.map(m => m.category || 'General'))];
  const filteredMedicines = selectedCategory === 'All' 
    ? medicines 
    : medicines.filter(m => (m.category || 'General') === selectedCategory);

  const addToCart = (med) => {
    addtoCart(med);
  };

  useEffect(() => {
  try {
    if (cart.length === 0) {
      localStorage.removeItem('swasthya_cart');
    } else {
      localStorage.setItem('swasthya_cart', JSON.stringify(cart));
    }
  } catch (e) {
    console.log('Failed to save cart to storage', e);
  }
}, [cart]);

  // ✅ Load medicines from Firestore
  useEffect(() => {
    const q = query(collection(db, 'medicines'));
    const unsub = onSnapshot(q, (snap) => {
      const meds = [];
      snap.forEach(doc => meds.push({ id: doc.id, ...doc.data() }));
      if (meds.length > 0) {
        setMedicines(meds); // Override with DB data
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
  // Fail-safe: Force stop any leaking camera/mic tracks from a previous video call
  const killLeakingHardware = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasActiveHardware = devices.some(device => device.kind === 'videoinput' || device.kind === 'audioinput');

      if (hasActiveHardware) {
        // We request a dummy stream just to grab the current active session and kill it
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

//   const uploadMedicinesToDB = async () => {
//   try {
//     const batch = writeBatch(db);
//     medicines.forEach((med) => {
//       // Create a unique ID or let Firestore generate one
//       const docRef = doc(collection(db, 'medicines')); 
//       batch.set(docRef, {
//         name: med.name,
//         price: med.price,
//         category: med.category,
//         createdAt: new Date().toISOString()
//       });
//     });
//     await batch.commit();
//     alert('✅ All medicines added to Firestore!');
//   } catch (err) {
//     console.error("Error uploading medicines:", err);
//   }
// };

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setLoading(false);
      return;
    }

    const unsubBookings = listenToMyBookings(currentUser.uid);
    const unsubDoctors = loadOnlineDoctors();
    const unsubOrders = listenToMyOrders(currentUser.uid); // ✅ Add this
    
    loadProfile(currentUser.uid);

    return () => {
      //unsubProfile(); 
    unsubBookings();
    unsubDoctors();
    unsubOrders();
    };
  }, []);

  const listenToMyOrders = (userId) => {
    const q = query(collection(db, 'orders'), where('userId', '==', userId));
    
    return onSnapshot(q, (snap) => {
      const ordersList = [];
      snap.forEach((doc) => {
        ordersList.push({ id: doc.id, ...doc.data() });
      });
      
      // Sort manually in JS to avoid "Missing Index" errors while testing
      const sorted = ordersList.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
        const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
        return dateB - dateA;
      });

      setMyOrders(sorted);
    });
  };

  const loadOnlineDoctors = () => {
    const q = query(collection(db, 'users'), where('role', '==', 'doctor'), where('online', '==', true));
    return onSnapshot(q, snap => {
      const doctors = [];
      snap.forEach(doc => doctors.push({ id: doc.id, ...doc.data() }));
      setOnlineDoctors(doctors);
    });
  };

  const loadProfile = (uid) => {
  const userRef = doc(db, 'users', uid);
  // This listens to Firestore. When WalletManager updates the DB, 
  // this function triggers automatically and updates the UI.
  return onSnapshot(userRef, (snap) => {
    if (snap.exists()) {
      setUserProfile(snap.data());
    }
    setLoading(false);
  });
};

  const listenToMyBookings = (customerId) => {
    const q = query(collection(db, 'bookings'), where('customerId', '==', customerId));
    
    return onSnapshot(q, (snap) => {
      const bookingsList = [];
      const collectedPrescriptions = [];
      
      snap.forEach((doc) => {
        const data = { id: doc.id, ...doc.data() };
        bookingsList.push(data);
        
        if (data.prescriptions && Array.isArray(data.prescriptions)) {
          data.prescriptions.forEach((p) => {
            collectedPrescriptions.push({
              ...p,
              doctorName: data.doctorName || 'Doctor',
              bookingId: data.id,
              sortDate: toDate(p.uploadedAt || data.updatedAt || data.createdAt)
            });
          });
        }
      });

      setMyBookings(bookingsList.sort((a, b) => 
        toDate(b.updatedAt || b.createdAt) - toDate(a.updatedAt || a.createdAt)
      ));
      
      setPrescriptions(collectedPrescriptions.sort((a, b) => b.sortDate - a.sortDate));
    });
  };

  const toDate = (dateValue) => {
    if (!dateValue) return new Date(0);
    if (dateValue instanceof Date) return dateValue;
    if (typeof dateValue === 'string') return new Date(dateValue);
    if (dateValue.toDate) return dateValue.toDate();
    return new Date(0);
  };

  const bookConsultation = async (doctorId, doctorName, doctorRate) => {
  const balance = userProfile?.walletBalance || 0;
  
  // 1. Check if user has enough money
  if (balance < doctorRate) {
    alert(`Insufficient balance! Consultation cost is ₹${doctorRate}. Please top up your wallet.`);
    return;
  }

  if(doctorId && doctorName && doctorRate){
    try {
      const batch = writeBatch(db); // Atomic transaction

      // 2. References
      const customerRef = doc(db, 'users', auth.currentUser.uid);
      const doctorRef = doc(db, 'users', doctorId);
      
      // 3. Deduct from Customer & Add to Doctor's WAITING balance
      batch.update(customerRef, {
        walletBalance: increment(-doctorRate)
      });

      batch.update(doctorRef, {
        waitingBalance: increment(0.9 * doctorRate) // ✅ Money is held in "Waiting"
      });

      // 4. Create the Booking entry
      const bookingRef = doc(collection(db, 'bookings'));
      batch.set(bookingRef, {
        customerId: auth.currentUser.uid,
        doctorId,
        customerName: userProfile?.name || 'Customer',
        doctorName,
        createdAt: new Date().toISOString(),
        status: 'pending',
        amountPaid: doctorRate,
        paymentStatus: 'escrow' // Track that money is in waiting state
      });

      // 5. Log transaction for Customer (Debit)
      const customerTransRef = doc(collection(db, 'transactions'));
      batch.set(customerTransRef, {
        userId: auth.currentUser.uid,
        amount: doctorRate,
        type: 'debit',
        description: `Consultation Fee (Held for Dr. ${doctorName})`,
        date: new Date().toISOString()
      });

      // 6. Log transaction for Doctor (Pending Credit)
      const doctorTransRef = doc(collection(db, 'transactions'));
      batch.set(doctorTransRef, {
        userId: doctorId,
        amount: doctorRate,
        type: 'pending_credit',
        description: `Incoming Consultation from ${userProfile?.name || 'Customer'} (Awaiting Completion)`,
        date: new Date().toISOString()
      });

      await batch.commit();
      alert('✅ Payment held in escrow. Booking request sent!');
    } catch (err) {
      console.error('Booking error:', err);
      alert(`Failed: ${err.message}`);
    }
  }
};

  const downloadPrescription = (url) => {
    if (!url) return alert("File not found");
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleMedicineCheckout = async () => {
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const balance = userProfile?.walletBalance || 0;

    if (balance < total) return alert("Insufficient balance!");

    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(userRef, { walletBalance: increment(-total) });

      await addDoc(collection(db, 'orders'), {
        userId: auth.currentUser.uid,
        items: cart,
        totalAmount: total,
        status: 'paid',
        createdAt: new Date().toISOString()
      });
      clearCart();
      alert('✅ Order placed successfully!');
    } catch (err) {
      alert("Error: " + err.message);
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
          background: canJoin ? '#10B981' : '#6b7280',
          color: 'white', border: 'none', borderRadius: '8px',
          fontWeight: 500
        }}
      >
        {canJoin ? '✅ Join Call Now' : '⏳ Doctor Preparing...'}
      </button>
    );
  };

  const safeDate = (value) => {
  if (!value) return '—';
  try {
    if (value.toDate) return value.toDate().toLocaleString();
    return new Date(value).toLocaleString();
  } catch {
    return '—';
  }
};

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

  const callAmbulance = () => window.location.href = 'tel:108';

  const formatDuration = (seconds) => {
    if (!seconds || typeof seconds !== 'number') return '0s';
    const s = Math.floor(seconds);
    const mins = Math.floor(s / 60);
    const rem = s % 60;
    return `${mins}m ${rem}s`;
  };

  if (loading) return <div style={{textAlign: 'center', padding: '50px'}}>Loading...</div>;

  return (
    <div style={{
      maxWidth: '1200px', margin: '0 auto', padding: '20px',
      background: '#f8fafc', minHeight: '100vh'
    }}>
      {/* Header */}
      <div style={{textAlign: 'center', marginBottom: '40px'}}>
        <h1 style={{color: '#1e293b', marginBottom: '8px'}}>Swasthya Sakhi</h1>
        <p style={{color: '#64748b'}}>Welcome, {userProfile?.name || 'Customer'}</p>
      </div>
      <WalletManager balance={userProfile?.walletBalance || 0} />
      {/* Emergency */}
      <div style={{marginBottom: '30px'}}>
        <button onClick={callAmbulance} style={{
          width: '100%', padding: '16px', background: '#dc2626',
          color: 'white', border: 'none', borderRadius: '12px',
          fontSize: '18px', fontWeight: 600, cursor: 'pointer'
        }}>
          🚨 Emergency Ambulance 108
        </button>
      </div>

      {cart.length > 0 && (
  <div className="cart-section" style={{
    background: 'white', padding: '20px', borderRadius: '12px', 
    marginBottom: '30px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' 
  }}>
    <h3 style={{margin: '0 0 10px 0'}}>🛒 Your Cart</h3>

    {cart.map(item => (
      <div 
        key={item.id} 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          fontSize: '14px',
          marginBottom: '8px'
        }}
      >
        <div style={{ flex: 1 }}>
          <span>{item.name}</span>
        </div>

        {/* Quantity controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => {
              updateQuantity(item.id, -1);
            }}
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              border: '1px solid #2563eb',
              background: '#2563eb',
              color: '#fff',
              cursor: 'pointer',
              lineHeight: '20px',
              textAlign: 'center',
              padding: '0'
            }}
          >
            −
          </button>

          <span style={{ minWidth: 20, textAlign: 'center' }}>
            {item.quantity || 1}
          </span>

          <button
            onClick={() => {
              updateQuantity(item.id, 1);
            }}
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              border: '1px solid #2563eb',
              background: '#2563eb',
              color: '#fff',
              cursor: 'pointer',
              lineHeight: '20px',
              textAlign: 'center',
              padding: '0'
            }}
          >
            +
          </button>
        </div>

        {/* Line total */}
        <div style={{ width: 70, textAlign: 'right' }}>
          ₹{item.price * (item.quantity || 1)}
        </div>

        {/* Remove item */}
        <button
          onClick={() => {
            removeFromCart(item.id);
          }}
          style={{
            marginLeft: 8,
            border: 'none',
            background: 'transparent',
            color: '#ef4444',
            cursor: 'pointer',
            fontSize: 16,
            fontWeight: 'bold'
          }}
          title="Remove from cart"
        >
          ×
        </button>
      </div>
    ))}

    <hr style={{margin: '15px 0', border: '0', borderTop: '1px solid #eee'}} />

    <div style={{display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginBottom: '15px'}}>
      <span>Total:</span>
      <span>₹{cart.reduce((sum, item) => sum + item.price * (item.quantity || 1), 0)}</span>
    </div>

    <button 
      onClick={handleMedicineCheckout}
      style={{
        width: '100%', padding: '12px', background: '#059669', 
        color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold'
      }}
    >
      Pay from Wallet
    </button>
  </div>
)}


{/* Accepted Bookings */}
{myBookings.length > 0 && (
  myBookings
    .filter(booking => booking.status === 'accepted')
    .map(booking => (
      <div
        key={booking.id}
        style={{
          background: 'white',
          padding: '20px',
          borderRadius: '12px',
          marginBottom: '16px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ margin: '0 0 4px 0', fontWeight: 600 }}>
              {booking.doctorName}
            </p>
            <p style={{ color: '#64748b', margin: 0, fontSize: '14px' }}>
              {new Date(booking.createdAt).toLocaleString()}
            </p>
          </div>

          <span
            style={{
              padding: '6px 12px',
              borderRadius: '20px',
              background: '#059669',
              color: 'white',
              fontSize: '12px',
              fontWeight: 500
            }}
          >
            ACCEPTED
          </span>
        </div>

        {booking.videoRoomId && (
          <CustomerJoinButton
            roomId={booking.videoRoomId}
            bookingId={booking.id}
          />
        )}
      </div>
    ))
)}


 {/* Online Doctors */}
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
                    ₹{doctor.rate || 100}
                  </p>
                </div>
                <button onClick={() => bookConsultation(doctor.id, doctor.name, doctor.rate)} style={{
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

      {/* ✅ RESPONSIVE MEDICINE SECTION */}
      <Card>
        <div onClick={() => setPharmacy(v => !v)} style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}>
          <h3 style={{color: '#1e293b'}}>💊 Pharmacy</h3>
          <span>{showPharmacy? '▲' : '＋'}</span>
        </div>

        {showPharmacy && (
          <>
         <div className="medicine-container" style={{ 
        display: 'flex', 
        gap: '20px', 
        flexDirection: window.innerWidth < 768 ? 'column' : 'row', // Basic responsive check
        alignItems: 'flex-start' 
      }}>
        
        {/* SIDEBAR CATEGORIES */}
        <div style={{ 
          width: window.innerWidth < 768 ? '100%' : '200px', 
          flexShrink: 0, 
          background: 'white', 
          padding: '15px', 
          borderRadius: '12px', 
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
          position: window.innerWidth < 768 ? 'relative' : 'sticky', 
          top: '20px',
          zIndex: 10,
          overflowX: 'auto', // Allows scrolling categories if they wrap
          display: window.innerWidth < 768 ? 'flex' : 'block', // Horizontal list on mobile
          gap: '10px'
        }}>
          <p style={{ 
            fontWeight: 'bold', 
            marginBottom: window.innerWidth < 768 ? '0' : '10px', 
            color: '#64748b', 
            fontSize: '12px', 
            textTransform: 'uppercase',
            alignSelf: 'center'
          }}>
            {window.innerWidth < 768 ? '' : 'Categories'}
          </p>
          
          <div style={{ 
            display: window.innerWidth < 768 ? 'flex' : 'block', 
            gap: '8px',
            width: '100%' 
          }}>
            {categories.map(cat => (
              <div 
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: '10px 15px', 
                  cursor: 'pointer', 
                  borderRadius: '8px', 
                  marginBottom: window.innerWidth < 768 ? '0' : '4px',
                  background: selectedCategory === cat ? '#2563eb' : '#f8fafc',
                  color: selectedCategory === cat ? 'white' : '#1e293b',
                  fontWeight: '600',
                  fontSize: '14px',
                  whiteSpace: 'nowrap', // Prevents text wrapping on mobile buttons
                  transition: '0.2s',
                  border: selectedCategory === cat ? 'none' : '1px solid #e2e8f0'
                }}
              >
                {cat}
              </div>
            ))}
          </div>
        </div>

        {/* MEDICINE GRID */}
        <div style={{ flexGrow: 1, width: '100%' }}>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', // Smaller min-width for mobile
            gap: '12px' 
          }}>
            {filteredMedicines.map(med => (
              <div key={med.id} style={{ 
                background: 'white', padding: '15px', borderRadius: '12px', 
                boxShadow: '0 4px 6px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
              }}>
                <div>
                  <h3 style={{margin: '0 0 5px 0', fontSize: '15px', color: '#1e293b'}}>{med.name}</h3>
                  <span style={{ fontSize: '10px', background: '#f1f5f9', padding: '2px 6px', borderRadius: '10px', color: '#64748b' }}>
                    {med.category || 'General'}
                  </span>
                </div>
                <div>
                  <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#059669', margin: '10px 0' }}>₹{med.price}</p>
                  <button 
                    onClick={() => addToCart(med)}
                    style={{ 
                      width: '100%', padding: '8px', background: '#2563eb', 
                      color: 'white', border: 'none', borderRadius: '6px', 
                      cursor: 'pointer', fontSize: '13px', fontWeight: '500' 
                    }}
                  >
                    Add
                  </button>
                </div>
              </div>
            ))}
          </div>
          {filteredMedicines.length === 0 && <p style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>No medicines found.</p>}
        </div>
      </div>

          </>
        )}
      </Card>
      
      {/* Orders Section */}
      <Card>
        <div onClick={() => setShowOrder(v => !v)} style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}>
          <h3>📦 My Medicine Orders ({myOrders.length})</h3>
          <span>{showOrder ? '▲' : '＋'}</span>
        </div>

        {showOrder && (
          <>
         <div style={{ marginBottom: '40px' }}>
        <h2 style={{ color: '#1e293b', marginBottom: '20px' }}></h2>
        {myOrders.length === 0 ? (
          <p style={{ color: '#64748b', background: 'white', padding: '20px', borderRadius: '12px', textAlign: 'center' }}>No orders found yet.</p>
        ) : (
          <div style={{ display: 'grid', gap: '15px' }}>
            {myOrders.map(order => (
              <div key={order.id} style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '5px solid #059669' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ fontWeight: 'bold', color: '#64748b' }}>Order #{order.id.slice(-6).toUpperCase()}</span>
<span style={{ fontSize: '12px', color: '#94a3b8' }}>
  {safeDate(order.createdAt)}
</span>
                </div>
                <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px' }}>
                  {order.items?.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span>{item.name} x{item.quantity}</span>
                      <span>₹{item.price * item.quantity}</span>
                    </div>
                  ))}
                </div>
                <p style={{ textAlign: 'right', fontWeight: 'bold', marginTop: '10px', margin: 0 }}>Total Paid: ₹{order.totalAmount}</p>
              </div>
            ))}
          </div>
        )}
      </div>

          </>
        )}
      </Card>
     
      {/* My Bookings */}
      <Card>
        <div onClick={() => setBookings(v => !v)} style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}>
          <h3>📋 My Bookings ({myBookings.length})</h3>
          <span>{showBookings ? '▲' : '＋'}</span>
        </div>

        {showBookings && (
          <>
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
              {booking.status === 'completed' && (
                <p style={{ color: '#059669', fontSize: '14px', marginTop: '10px', fontWeight: 500 }}>
                  ✅ Completed - Duration: {formatDuration(booking.callDurationSeconds)}
                </p>
              )}
              {booking.prescriptions && booking.prescriptions.length > 0 && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
                  {booking.prescriptions.map((file, idx) => (
                    <button 
                      key={idx}
                      onClick={() => downloadPrescription(file.url)}
                      style={{
                        padding: '6px 12px', background: '#eff6ff', color: '#2563eb',
                        border: '1px solid #bfdbfe', borderRadius: '6px', fontSize: '12px',
                        fontWeight: 'bold', cursor: 'pointer'
                      }}
                    >
                      📥 {file.name?.slice(0,20)}...
                    </button>
                  ))}
                </div>
              )}
              {booking.status === 'accepted' && booking.videoRoomId && (
                <CustomerJoinButton roomId={booking.videoRoomId} bookingId={booking.id} />
              )}
            </div>
          ))
        )}
          </>
        )}
      </Card>
      {/* Prescriptions (from bookings) */}
      <Card>
        <div onClick={() => setPrescriptionslist(v => !v)} style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}>
          <h3>💊 My Prescriptions ({prescriptions.length})</h3>
          <span>{showPrescriptionslist ? '▲' : '＋'}</span>
        </div>

        {showPrescriptionslist && (
          <>
        {prescriptions.length > 0 ? (
        <div>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px'}}>
            {prescriptions.map((p, index) => (
              <div key={index} style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '10px'}}>
                  <h4 style={{margin: 0}}>{p.doctorName}</h4>
                  <span style={{fontSize: '11px', color: '#64748b'}}>
                    {p.uploadedAt ? new Date(p.uploadedAt).toLocaleDateString() : 'Recent'}
                  </span>
                </div>
                <p style={{fontSize: '13px', color: '#475569', marginBottom: '15px'}}>
                  {p.name || 'Prescription'}
                </p>
                <button 
                  onClick={() => downloadPrescription(p.url)}
                  style={{
                    width: '100%', padding: '10px', background: '#059669',
                    color: 'white', border: 'none', borderRadius: '8px', fontWeight: 500, cursor: 'pointer'
                  }}
                >
                  📥 Download File
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{
            textAlign: 'center', padding: '60px 20px',
            background: 'white', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
          }}>
            <p style={{color: '#64748b'}}>No Prescriptions to Show</p>
          </div>
      )}
          </>
        )}
      </Card>
      
    </div>
  );
  
};

export default CustomerPortal;
