import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc, addDoc, writeBatch } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { useNavigate } from 'react-router-dom';
import RazorpayButton from '../components/RazorpayButton';

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
  const [cart, setCart] = useState([]); // ✅ NEW: Cart state
  const [selectedCategory, setSelectedCategory] = useState('All'); // ✅ NEW: Category state
  const [myBookings, setMyBookings] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [prescriptions, setPrescriptions] = useState([]);
  const navigate = useNavigate();

  const categories = ['All', ...new Set(medicines.map(m => m.category || 'General'))];
  const filteredMedicines = selectedCategory === 'All' 
    ? medicines 
    : medicines.filter(m => (m.category || 'General') === selectedCategory);

  const addToCart = (med) => {
    setCart((prevCart) => {
      // Check if item already exists based on Firestore ID
      const existingItem = prevCart.find(item => item.id === med.id);
      
      if (existingItem) {
        return prevCart.map(item =>
          item.id === med.id 
            ? { ...item, quantity: (item.quantity || 1) + 1 } 
            : item
        );
      }
      // Add new item with quantity 1
      return [...prevCart, { ...med, quantity: 1 }];
    });
  };
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
    
    loadProfile(currentUser.uid);

    return () => {
      unsubBookings();
      unsubDoctors();
    };
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

  const bookConsultation = async (doctorId, doctorName) => {
    try {
      await addDoc(collection(db, 'bookings'), {
        customerId: auth.currentUser.uid,
        doctorId,
        customerName: userProfile?.name || 'Customer',
        doctorName,
        createdAt: new Date().toISOString(),
        status: 'pending'
      });
      alert('✅ Booking request sent!');
    } catch (err) {
      console.error('Booking error:', err);
      alert(`Failed: ${err.message}`);
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
        <div style={{ marginBottom: '30px' }}>
          <RazorpayButton cart={cart} setCart={setCart} />
        </div>
      )}

      {/* ✅ RESPONSIVE MEDICINE SECTION */}
      <h2 style={{color: '#1e293b', marginBottom: '20px'}}>💊 Pharmacy</h2>
      
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
      <div style={{marginBottom: '40px'}}>
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
      </div>

      {/* Prescriptions (from bookings) */}
      {prescriptions.length > 0 && (
        <div>
          <h2 style={{color: '#1e293b', marginBottom: '20px'}}>
            💊 My Prescriptions ({prescriptions.length})
          </h2>
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
          {/* <button onClick={uploadMedicinesToDB}>Sync Medicines to DB</button> */}
        </div>
      )}
    </div>
  );
};

export default CustomerPortal;
