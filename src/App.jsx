import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './services/firebase';
import LandingPage from './components/LandingPage';
import Login from './components/Login';
import Register from './components/Register';
import CustomerPortal from './portals/CustomerPortal';
import DoctorPortal from './portals/DoctorPortal';
import VideoCall from './components/VideoCall'; // Add this import

import './App.css';
import './index.css';

function AuthWrapper() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

 useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
    setLoading(true);

    if (firebaseUser) {
      const userRef = doc(db, 'users', firebaseUser.uid);
      const docSnap = await getDoc(userRef);

      if (docSnap.exists()) {
        const userData = docSnap.data();
        setUser(firebaseUser);
        setUserRole(userData.role);

        // Only redirect if profile is complete AND user is NOT already on correct portal OR video call page
        const currentPath = window.location.pathname;
        const isOnCorrectPortal = currentPath.startsWith(`/${userData.role}-portal`);
        const isOnVideoCall = currentPath.startsWith('/video-call');
        const isOnAuthPage = currentPath === '/login' || currentPath === '/register';

        if (userData.role && userData.phoneNumber && !isOnCorrectPortal && !isOnVideoCall && !isOnAuthPage) {
          if (userData.role === "customer") {
            // Regular customers can always access their portal
            navigate(`/customer-portal`, { replace: true });
          } else if (userData.verificationStatus === "approved") {
            // Doctors/Medical/Delivery can only enter if APPROVED
            navigate(`/${userData.role}-portal`, { replace: true });
          } else {
            // If a doctor is pending or rejected, keep them on landing page
            console.log('USER NOT VERIFIED - REDIRECTING TO HOME PAGE');
            navigate(`/`, { replace: true });
            alert("Your account is currently under verification. Please wait for admin approval.");
          }
        }
      } else {
        setUser(firebaseUser);
      }
    } else {
      setUser(null);
      setUserRole(null);
    }

    setLoading(false);
  });

  return () => unsubscribe();
}, [navigate]);

  if (loading) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem' }}>🩺</div>
        <h2>Loading Swasthya Sakhi...</h2>
      </div>
    );
  }

  return (
    <>
      {user && (
        <header className="app-header" style={{
          background: 'linear-gradient(135deg, #4CAF50, #45a049)',
          color: 'white',
          padding: '1rem 1.5rem',
          position: 'sticky',
          top: 0,
          zIndex: 1000,
          boxShadow: '0 2px 10px rgba(0,0,0,0.15)'
        }}>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            maxWidth: '1400px',
            margin: '0 auto',
            gap: '1rem'
          }}>
            {/* Left: Title + Tagline */}
            <div style={{ flex: '1 1 auto', minWidth: '200px' }}>
              <h1 style={{ margin: 0, fontSize: 'clamp(1.4rem, 4vw, 1.8rem)' }}>
                🩺 Swasthya Sakhi
              </h1>
              <p className="tagline" style={{
                margin: '0.25rem 0 0',
                fontSize: 'clamp(0.85rem, 3vw, 1rem)',
                opacity: 0.9
              }}>
                Affordable Healthcare for Everyone
              </p>
            </div>

            {/* Right: Role + Logout */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              flex: '0 0 auto',
              flexWrap: 'wrap',
              justifyContent: 'flex-end'
            }}>
              <span style={{
                fontSize: 'clamp(0.9rem, 3.5vw, 1.1rem)',
                fontWeight: 500,
                whiteSpace: 'nowrap'
              }}>
                {userRole ? `${userRole.charAt(0).toUpperCase() + userRole.slice(1)} Portal` : 'Portal'}
              </span>

              <button
                onClick={async () => {
                  await auth.signOut();
                  navigate('/', { replace: true });
                }}
                style={{
                  padding: '0.6rem 1.2rem',
                  background: 'rgba(255,255,255,0.2)',
                  color: 'white',
                  border: '1px solid rgba(255,255,255,0.4)',
                  borderRadius: '8px',
                  fontSize: 'clamp(0.9rem, 3.5vw, 1rem)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap'
                }}
              >
                Logout
              </button>
            </div>
          </div>
        </header>
      )}

      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route path="/customer-portal" element={user ? <CustomerPortal /> : <Navigate to="/" replace />} />
        <Route path="/doctor-portal" element={user ? <DoctorPortal /> : <Navigate to="/" replace />} />
        <Route path="/video-call/:roomId" element={user ? <VideoCall isDoctor={userRole === 'doctor'} userId={user.uid} /> : <Navigate to="/" replace />} />
        {/* Add delivery-portal, medical-portal when ready */}

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <Router>
      <div className="App">
        <AuthWrapper />
      </div>
    </Router>
  );
}

export default App;