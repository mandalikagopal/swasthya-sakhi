import React from 'react';
import { Link } from 'react-router-dom';

const LandingPage = () => {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #e8f5e8 0%, #c8e6c9 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      textAlign: 'center'
    }}>
      <div style={{ fontSize: '6rem', marginBottom: '1rem' }}>🩺</div>
      <h1 style={{ color: '#2E7D32', fontSize: '3.5rem', margin: '0.5rem 0' }}>
        Swasthya Sakhi
      </h1>
      <p style={{ fontSize: '1.5rem', color: '#444', maxWidth: '600px', margin: '1rem 0 2rem' }}>
        Affordable Healthcare for Everyone – Medicines, Consultations, Ambulance & More
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', maxWidth: '400px' }}>
        <Link to="/register" style={{ textDecoration: 'none' }}>
          <button style={{
            width: '100%',
            padding: '1.2rem',
            fontSize: '1.3rem',
            background: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
          }}>
            Register Now
          </button>
        </Link>

        <Link to="/login" style={{ textDecoration: 'none' }}>
          <button style={{
            width: '100%',
            padding: '1.2rem',
            fontSize: '1.3rem',
            background: 'white',
            color: '#2E7D32',
            border: '2px solid #4CAF50',
            borderRadius: '12px',
            cursor: 'pointer'
          }}>
            Already Registered? Login
          </button>
        </Link>
      </div>
    </div>
  );
};

export default LandingPage;