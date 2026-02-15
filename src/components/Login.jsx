import React, { useState, useEffect, useRef } from 'react';
import { RecaptchaVerifier, signInWithPhoneNumber, PhoneAuthProvider } from 'firebase/auth';
import { auth } from '../services/firebase';
import { useNavigate } from 'react-router-dom';
import { signInWithCredential } from 'firebase/auth';

const Login = () => {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('phone');
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const recaptchaRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    return () => {
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = null;
      }
    };
  }, []);

  const sendOTP = async () => {
    if (phone.length !== 10) {
      setError('Enter 10-digit phone number');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, recaptchaRef.current, {
          size: 'invisible',
        });
      }

      const fullPhone = `+91${phone}`;
      const result = await signInWithPhoneNumber(auth, fullPhone, window.recaptchaVerifier);
      setConfirmationResult(result);
      setStep('otp');
    } catch (err) {
      setError(err.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

 const verifyOTP = async () => {
  if (otp.length !== 6) {
    setError('Enter 6-digit OTP');
    return;
  }

  setLoading(true);
  setError('');

  try {
    const credential = PhoneAuthProvider.credential(confirmationResult.verificationId, otp);
    await signInWithCredential(auth, credential);    
    navigate("/", { replace: true });  

  } catch (err) {
    setError(err.message || 'Invalid OTP');
    console.error('OTP verification error:', err);
  } finally {
    setLoading(false);
  }
};

  const handleGoogleSignIn = async () => {
    // Placeholder – implement full popup if needed
    alert('Google Sign-In coming soon – currently using phone OTP');
  };

  return (
    <div style={{ maxWidth: 480, margin: '3rem auto', padding: '0 1rem' }}>
      <div ref={recaptchaRef} style={{ display: 'none' }} />

      <div style={{ background: 'white', padding: '2.5rem', borderRadius: 16, boxShadow: '0 10px 40px rgba(0,0,0,0.1)' }}>
        <h1 style={{ color: '#2E7D32', textAlign: 'center', marginBottom: '1.5rem' }}>Login</h1>

        {error && <div style={{ color: 'red', marginBottom: '1rem', textAlign: 'center' }}>{error}</div>}

        {step === 'phone' ? (
          <>
            <input
              placeholder="Phone (10 digits)"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
              maxLength={10}
              style={{ width: '100%', padding: '12px', margin: '8px 0', borderRadius: 8, border: '1px solid #ddd' }}
            />
            <button
              onClick={sendOTP}
              disabled={loading}
              style={{ width: '100%', padding: '14px', marginTop: '1rem', background: loading ? '#ccc' : '#4CAF50', color: 'white', border: 'none', borderRadius: 12 }}
            >
              {loading ? 'Sending...' : 'Send OTP'}
            </button>

            <button
              onClick={handleGoogleSignIn}
              style={{ width: '100%', padding: '14px', marginTop: '1.5rem', background: '#4285F4', color: 'white', border: 'none', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
            >
              <img src="https://www.google.com/favicon.ico" alt="Google" style={{ width: '20px' }} />
              Continue with Google
            </button>
          </>
        ) : (
          <>
            <p>OTP sent to +91{phone}</p>
            <input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} maxLength={6} placeholder="Enter OTP" style={{ width: '100%', padding: '14px', marginBottom: '1rem', textAlign: 'center', borderRadius: 8, border: '1px solid #ddd' }} />
            <button onClick={verifyOTP} disabled={loading} style={{ width: '100%', padding: '14px', background: loading ? '#ccc' : '#4CAF50', color: 'white', border: 'none', borderRadius: 12 }}>
              {loading ? 'Verifying...' : 'Verify & Login'}
            </button>
            <button onClick={() => setStep('phone')} style={{ width: '100%', marginTop: '1rem', background: 'none', border: 'none', color: '#2E7D32' }}>
              Back
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default Login;