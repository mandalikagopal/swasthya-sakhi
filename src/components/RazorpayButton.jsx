import React, { useState } from 'react';

const RazorpayButton = ({ cart, setCart }) => {
  const total = cart.reduce((sum, item) => sum + item.price, 0);
  
  const handlePayment = () => {
    alert(`✅ Payment ₹${total} Success!\n90% Doctor | 10% Platform`);
    setCart([]); // CLEAR CART after payment
  };

  const removeItem = (index) => {
    const newCart = cart.filter((_, i) => i !== index);
    setCart(newCart);
  };

  return (
    <div className="cart">
      <h3>🛒 Cart ({cart.length})</h3>
      <div style={{maxHeight: '200px', overflowY: 'auto', marginBottom: '1rem'}}>
        {cart.map((item, index) => (
          <div key={index} style={{display: 'flex', justifyContent: 'space-between', padding: '0.5rem', borderBottom: '1px solid #eee'}}>
            <span>{item.name} - ₹{item.price}</span>
            <button onClick={() => removeItem(index)} style={{background: '#ff4444', color: 'white', border: 'none', padding: '0.3rem 0.8rem', borderRadius: '4px'}}>
              Remove
            </button>
          </div>
        ))}
      </div>
      <div style={{fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '1rem'}}>
        Total: ₹{total}
      </div>
      <button onClick={handlePayment} className="pay-button">
        Pay Now with Razorpay
      </button>
    </div>
  );
};

export default RazorpayButton;
