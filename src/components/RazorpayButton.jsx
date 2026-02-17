import React from 'react';

const RazorpayButton = ({ cart, setCart }) => {
  // ✅ FIXED: Calculate total by multiplying price and quantity
  const total = cart.reduce((sum, item) => {
    const price = Number(item.price) || 0;
    const qty = Number(item.quantity) || 1;
    return sum + (price * qty);
  }, 0);

  const removeItem = (id) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const handlePayment = () => {
    alert(`✅ Order Placed! Total Amount: ₹${total}`);
    setCart([]); // Clear cart after "payment"
  };

  return (
    <div style={{ background: '#ecfdf5', padding: '20px', borderRadius: '12px', border: '2px solid #10b981' }}>
      <h3 style={{ marginTop: 0 }}>🛒 Your Cart</h3>
      <div style={{ marginBottom: '15px' }}>
        {cart.map((item) => (
          <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #d1fae5' }}>
            <span>
              <b>{item.name}</b> x {item.quantity}
            </span>
            <div>
              <span style={{ marginRight: '15px', fontWeight: 'bold' }}>₹{item.price * item.quantity}</span>
              <button 
                onClick={() => removeItem(item.id)}
                style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '12px' }}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '18px', fontWeight: 'bold' }}>Total: ₹{total}</span>
        <button 
          onClick={handlePayment}
          style={{ padding: '10px 20px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          Pay Now
        </button>
      </div>
    </div>
  );
};

export default RazorpayButton;