import React, { useState } from 'react';
import { auth } from '../services/firebase';

const WalletManager = ({ balance }) => {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const handleTopUp = () => {
    if (!amount || amount < 10) return alert("Minimum amount is ₹10");

    setLoading(true);

    const options = {
      key: "rzp_test_SHC6eokXMSzjRW", 
      amount: Number(amount) * 100, 
      currency: "INR",
      name: "Swasthya Sakhi",
      description: "Wallet Top-up",
      handler: function (response) {
        setLoading(false);
        setAmount('');
        alert("Payment successful! Updating your balance...");
      },
      prefill: {
        contact: auth.currentUser.phoneNumber || ""
      },
      notes: {
        userId: auth.currentUser.uid,
        type: "wallet_recharge"
      },
      theme: { color: "#2563eb" }
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
    
    // Safety: If the user closes the modal without paying
    rzp.on('payment.failed', () => setLoading(false));
  };

  return (
    <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', marginBottom: '20px' }}>
      <h3 style={{ margin: '0 0 10px 0' }}>💰 Your Wallet</h3>
      <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b' }}>₹{balance || 0}</p>
      
      <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
        <input 
          type="number" 
          value={amount} 
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Enter amount" 
          style={{ flexGrow: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}
        />
        <button 
          onClick={handleTopUp}
          disabled={loading}
          style={{ padding: '10px 20px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
        >
          {loading ? 'Processing...' : 'Add Money'}
        </button>
      </div>
    </div>
  );
};

export default WalletManager;