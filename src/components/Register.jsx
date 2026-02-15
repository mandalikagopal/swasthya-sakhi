import React, { useState, useEffect, useRef } from 'react';
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  PhoneAuthProvider,
  signInWithCredential,
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { useNavigate } from 'react-router-dom';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'customer',
    location: '',
    state: '',
    city: '',
    pincode: '',
    licenseNumber: '',
  });

  const [step, setStep] = useState('form');
  const [otp, setOtp] = useState('');
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const recaptchaRef = useRef(null);
  const verifierRef = useRef(null);
  const navigate = useNavigate();

  // Initialize reCAPTCHA once
  useEffect(() => {
    if (!verifierRef.current) {
      verifierRef.current = new RecaptchaVerifier(auth, recaptchaRef.current, {
        size: 'invisible',
      });
    }

    return () => {
      if (verifierRef.current) {
        verifierRef.current.clear();
        verifierRef.current = null;
      }
    };
  }, []);

  // Auto-fetch location when role is customer and location is empty
  useEffect(() => {
    if (formData.role === 'customer' && !formData.location) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            setFormData(prev => ({
              ...prev,
              location: `Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)} (auto-detected)`,
            }));
          },
          (err) => {
            console.warn('Geolocation denied or unavailable:', err);
            // No error message to user - let them enter manually
          }
        );
      }
    }
  }, [formData.role]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const validateForm = () => {
    if (!formData.name.trim()) return 'Name is required';
    if (formData.phone.length !== 10) return 'Enter valid 10-digit phone';
    if (!formData.email.includes('@')) return 'Valid email is required';
    if (formData.password.length < 6) return 'Password must be at least 6 characters';
    if (formData.password !== formData.confirmPassword) return 'Passwords do not match';

    if (formData.role === 'customer' && !formData.location.trim()) {
      return 'Location is required for customers';
    }

    if (formData.role !== 'customer') {
      if (!formData.state.trim() || !formData.city.trim() || !formData.pincode.trim() || !formData.licenseNumber.trim()) {
        return 'All role-specific fields are required';
      }
    }
    return null;
  };

  const sendOTP = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const fullPhone = `+91${formData.phone}`;
      const result = await signInWithPhoneNumber(auth, fullPhone, verifierRef.current);
      setConfirmationResult(result);
      setStep('otp');
    } catch (err) {
      setError(err.message || 'Failed to send OTP. Try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const verifyOTPAndRegister = async () => {
    if (otp.length !== 6) {
      setError('Please enter 6-digit OTP');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const credential = PhoneAuthProvider.credential(confirmationResult.verificationId, otp);
      const userCredential = await signInWithCredential(auth, credential);

      const user = userCredential.user;

      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        name: formData.name.trim(),
        phoneNumber: user.phoneNumber,
        email: formData.email.trim(),
        role: formData.role,
        createdAt: new Date().toISOString(),
        ...(formData.role === 'customer' ? { location: formData.location.trim() } : {}),
        ...(formData.role !== 'customer' ? {
          state: formData.state.trim(),
          city: formData.city.trim(),
          pincode: formData.pincode.trim(),
          licenseNumber: formData.licenseNumber.trim(),
          verificationStatus: 'pending',
        } : {}),
      });

      navigate(`/${formData.role}-portal`, { replace: true });
    } catch (err) {
      setError(err.message || 'Registration failed');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 500, margin: '2.5rem auto', padding: '0 1rem' }}>
      <div ref={recaptchaRef} style={{ position: 'absolute', left: '-9999px', top: '-9999px' }} />

      <div style={{
        background: 'white',
        padding: '2rem 2.5rem',
        borderRadius: 16,
        boxShadow: '0 10px 40px rgba(0,0,0,0.12)'
      }}>
        <h1 style={{ color: '#2E7D32', textAlign: 'center', marginBottom: '1.8rem', fontSize: '2rem' }}>
          Create Account
        </h1>

        {error && (
          <div style={{
            color: '#c62828',
            background: '#ffebee',
            padding: '0.9rem',
            borderRadius: 8,
            marginBottom: '1.5rem',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        {step === 'form' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            {/* Common fields - ALWAYS shown */}
            <input name="name" placeholder="Full Name *" value={formData.name} onChange={handleChange} required style={{ padding: '12px', borderRadius: 8, border: '1px solid #ddd' }} />
            <input name="phone" placeholder="Phone (10 digits) *" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') })} maxLength={10} required style={{ padding: '12px', borderRadius: 8, border: '1px solid #ddd' }} />
            <input name="email" type="email" placeholder="Email *" value={formData.email} onChange={handleChange} required style={{ padding: '12px', borderRadius: 8, border: '1px solid #ddd' }} />
            <input name="password" type="password" placeholder="Password (min 6 chars) *" value={formData.password} onChange={handleChange} required style={{ padding: '12px', borderRadius: 8, border: '1px solid #ddd' }} />
            <input name="confirmPassword" type="password" placeholder="Confirm Password *" value={formData.confirmPassword} onChange={handleChange} required style={{ padding: '12px', borderRadius: 8, border: '1px solid #ddd' }} />

            {/* Role selector - ALWAYS shown */}
            <select name="role" value={formData.role} onChange={handleChange} required style={{ padding: '12px', borderRadius: 8, border: '1px solid #ddd' }}>
              <option value="customer">Customer</option>
              <option value="doctor">Doctor</option>
              <option value="delivery">Delivery Partner</option>
              <option value="medical">Medical Business</option>
            </select>

            {/* Conditional fields */}
            {formData.role === 'customer' && (
              <div>
                <input
                  name="location"
                  placeholder="Your Location / Area *"
                  value={formData.location}
                  onChange={handleChange}
                  required
                  style={{ padding: '12px', borderRadius: 8, border: '1px solid #ddd' }}
                />
                <small style={{ color: '#666', display: 'block', marginTop: '0.4rem' }}>
                  Allow browser location permission for auto-detection (optional)
                </small>
              </div>
            )}

            {formData.role !== 'customer' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                <input name="state" placeholder="State *" value={formData.state} onChange={handleChange} required style={{ padding: '12px', borderRadius: 8, border: '1px solid #ddd' }} />
                <input name="city" placeholder="City *" value={formData.city} onChange={handleChange} required style={{ padding: '12px', borderRadius: 8, border: '1px solid #ddd' }} />
                <input name="pincode" placeholder="Pincode *" value={formData.pincode} onChange={handleChange} required style={{ padding: '12px', borderRadius: 8, border: '1px solid #ddd' }} />
                <input
                  name="licenseNumber"
                  placeholder={
                    formData.role === 'doctor' ? 'Medical License Number *' :
                    formData.role === 'delivery' ? 'Driving License Number *' :
                    'Trade License / GST Number *'
                  }
                  value={formData.licenseNumber}
                  onChange={handleChange}
                  required
                  style={{ padding: '12px', borderRadius: 8, border: '1px solid #ddd' }}
                />
              </div>
            )}

            <button
              onClick={sendOTP}
              disabled={loading}
              style={{
                marginTop: '1.5rem',
                padding: '14px',
                background: loading ? '#ccc' : '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: 12,
                fontSize: '1.1rem',
                fontWeight: 'bold',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Sending OTP...' : 'Verify Phone & Register'}
            </button>
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <p style={{ marginBottom: '1.2rem', fontSize: '1.1rem' }}>
              OTP sent to <strong>+91 {formData.phone}</strong>
            </p>
            <input
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              maxLength={6}
              placeholder="Enter 6-digit OTP"
              style={{ width: '100%', padding: '14px', fontSize: '1.3rem', textAlign: 'center', marginBottom: '1.2rem', borderRadius: 8, border: '1px solid #ddd' }}
            />
            <button
              onClick={verifyOTPAndRegister}
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px',
                background: loading ? '#ccc' : '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: 12,
                fontSize: '1.1rem',
                fontWeight: 'bold',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Verifying...' : 'Complete Registration'}
            </button>
            <button
              onClick={() => setStep('form')}
              style={{ marginTop: '1rem', background: 'none', border: 'none', color: '#2E7D32', cursor: 'pointer' }}
            >
              ← Back to Form
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Register;