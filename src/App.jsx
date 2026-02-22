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
import VideoCall from './components/VideoCall';
import CartProvider from './context/CartContext'
import { useCart } from './context/CartContext';

import './App.css';
import './index.css';

const GenericPage = ({ title }) => (
  <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', lineHeight: '1.6' }}>
    <h2>{title}</h2>
    <p>This is a placeholder for the {title} page.</p>
  </div>
);

function AuthWrapper() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  /* ================== STYLES ================== */
  const headerStyle = {
    background: 'linear-gradient(135deg, #22c55e, #16a34a)',
    color: 'white',
    position: 'sticky',
    top: 0,
    zIndex: 1000,
    padding: '12px 20px'
  };

  const containerStyle = {
    flexWrap: 'wrap',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    maxWidth: '1200px',
    margin: '0 auto'
  };

  const hamburgerButtonStyle = {
    width: '45px',
    height: '45px',
    borderRadius: '50%',
    border: '1px solid rgba(255,255,255,0.4)',
    background: 'transparent',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '4px',
    cursor: 'pointer'
  };

  const barStyle = {
    width: '20px',
    height: '2px',
    background: 'white',
    borderRadius: '2px'
  };

  const portalButtonStyle = {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.6)',
    padding: '8px 16px',
    borderRadius: '8px',
    fontWeight: 'bold',
    cursor: 'pointer',
    color: 'white',
    textTransform: 'capitalize',
    fontSize: '1rem'
  };

  const logoStyle = {
    margin: 0,
    fontSize: '1.9rem',
    fontWeight: 'bold',
    color: 'white',
    cursor: 'pointer'
  };

  const taglineStyle = {
    margin: 0,
    fontSize: '1.0rem',
    opacity: 0.9,
    color: 'white'
  };

  const logoutButtonStyle = {
    padding: '8px 15px',
    background: 'transparent',
    color: 'white',
    border: '1px solid rgba(255,255,255,0.6)',
    borderRadius: '8px',
    fontSize: '1rem',
    cursor: 'pointer'
  };

  const drawerStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    height: '100%',
    width: '300px',
    background: '#fff',
    zIndex: 1001,
    boxShadow: '5px 0 15px rgba(0,0,0,0.1)'
  };

  const overlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: 'rgba(0,0,0,0.4)',
    zIndex: 1000
  };

  const menuLinkStyle = {
    padding: '15px 20px',
    borderBottom: '1px solid #f1f5f9',
    cursor: 'pointer',
    fontWeight: 500
  };
  const { cartTotalItems } = useCart(); 

  /* ================== AUTH ================== */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
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
    return () => unsub();
  }, []);

  if (loading) {
    return <div style={{ padding: '4rem', textAlign: 'center' }}>Loading...</div>;
  }

  const isVideoCall = window.location.pathname.startsWith('/video-call');

  return (
    <>
      {user && !isVideoCall && (
        <header style={headerStyle}>
          <div style={containerStyle}>
            {/* LEFT */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button onClick={() => setIsMenuOpen(true)} style={hamburgerButtonStyle}>
                <div style={barStyle}></div>
                <div style={barStyle}></div>
                <div style={barStyle}></div>
              </button>

              <div>
                <h1 
                  style={logoStyle} 
                  onClick={() => {
                    if (user && userRole) {
                      navigate(`/${userRole}-portal`);
                    } else {
                      navigate('/');
                    }
                  }}
                >
                  🩺 Swasthya Sakhi
                </h1>
                <p style={taglineStyle}>Affordable Healthcare for Everyone</p>
              </div>
            </div>

            {/* RIGHT */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => navigate(`/${userRole}-portal`)}
                style={portalButtonStyle}
              >
                {userRole?.charAt(0).toUpperCase() + userRole?.slice(1)} Portal
              </button>
              
              {/* Cart Icon - Customer Only */}
{userRole === 'customer' && (
  <button
    onClick={() => {
      navigate('/customer-portal');
      setTimeout(() => {
        const cartSection = document.querySelector('.cart-section');
        if (cartSection) {
          // ✅ DYNAMIC: Get actual header height (works on all devices)
          const header = document.querySelector('header');
          const headerHeight = header ? header.offsetHeight + 20 : 100; // +20px buffer
          
          const cartTop = cartSection.getBoundingClientRect().top + window.scrollY;
          window.scrollTo({
            top: cartTop - headerHeight,
            behavior: 'smooth'
          });
        }
      }, 500); // Longer timeout for navigation + scroll
    }}
    style={{
      ...portalButtonStyle,
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      gap: '4px'
    }}
  >
    🛒 Cart
    {cartTotalItems > 0 && (
      <span style={{
        position: 'absolute',
        top: -4,
        right: -4,
        background: '#ef4444',
        color: 'white',
        borderRadius: '50%',
        width: 20,
        height: 20,
        fontSize: 12,
        fontWeight: 'bold',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {cartTotalItems}
      </span>
    )}
  </button>
)}


              <button onClick={() => auth.signOut()} style={logoutButtonStyle}>
                Logout
              </button>
            </div>
          </div>
        </header>
      )}

      {/* SIDE MENU (NOT REMOVED) */}
      {isMenuOpen && (
        <>
          <div style={overlayStyle} onClick={() => setIsMenuOpen(false)} />
          <div style={drawerStyle}>
            <button onClick={() => setIsMenuOpen(false)} style={{ border: 'none', background: 'none', fontSize: '1.2rem', cursor: 'pointer', color:'red', textAlign:'right', width: '-webkit-fill-available' }}>✕</button>
            {['About Us', 'Contact Us', 'FAQs', 'Privacy', 'Terms', 'Security'].map(item => (
              <div
                key={item}
                style={menuLinkStyle}
                onClick={() => {
                  navigate(`/${item.toLowerCase().replace(' ', '')}`);
                  setIsMenuOpen(false);
                }}
              >
                {item}
              </div>
            ))}
          </div>
        </>
      )}

    
<Routes>
  <Route path="/" element={<LandingPage />} />
  <Route path="/login" element={<Login />} />
  <Route path="/register" element={<Register />} />

  {/* ✅ Added these so the menu clicks work */}
  <Route path="/aboutus" element={<GenericPage title="About Us" />} />
  <Route path="/contactus" element={<GenericPage title="Contact Us" />} />
  <Route path="/faqs" element={<GenericPage title="FAQs" />} />
  <Route path="/privacy" element={<GenericPage title="Privacy Policy" />} />
  <Route path="/terms" element={<GenericPage title="Terms of Service" />} />
  <Route path="/security" element={<GenericPage title="Security & Data Preservation" />} />

  <Route path="/customer-portal" element={user ? <CustomerPortal /> : <Navigate to="/" replace />} />
  <Route path="/doctor-portal" element={user ? <DoctorPortal /> : <Navigate to="/" replace />} />
  <Route path="/video-call/:roomId" element={user ? <VideoCall isDoctor={userRole === 'doctor'} userId={user.uid} /> : <Navigate to="/" replace />} />

  <Route path="*" element={<Navigate to="/" replace />} />
</Routes>
    </>
  );
}

export default function App() {
  return (
    <Router>
      <CartProvider>
        <AuthWrapper />
      </CartProvider>
    </Router>
  );
}
