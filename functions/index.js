const functions = require("firebase-functions");
const admin = require("firebase-admin");
const crypto = require("crypto");

if (admin.apps.length === 0) {
  admin.initializeApp();
}

exports.razorpayWebhook = functions.https.onRequest(async (req, res) => {
  // 1. YOUR SECRET KEY (Must match Razorpay Dashboard)
  const secret = "sakhi_secure_999"; 

  // 2. VERIFY THE SIGNATURE
  const shasum = crypto.createHmac("sha256", secret);
  shasum.update(JSON.stringify(req.body));
  const digest = shasum.digest("hex");

  if (digest !== req.headers["x-razorpay-signature"]) {
    console.error("Invalid Signature - This request is fake!");
    return res.status(400).send("Invalid signature");
  }

  // 3. GET DATA FROM THE WEBHOOK
  const event = req.body.event;
  const payment = req.body.payload.payment.entity;

  if (event === "payment.captured") {
    const uid = payment.notes.userId; // We sent this in the 'notes' field in WalletManager
    const amount = payment.amount / 100; // Convert paise to rupees

    try {
      const userRef = admin.firestore().collection("users").doc(uid);
      
      // 4. ATOMIC UPDATE (Server-side)
      await userRef.update({
        walletBalance: admin.firestore.FieldValue.increment(amount)
      });

      // 5. LOG TRANSACTION
      await admin.firestore().collection("transactions").add({
        userId: uid,
        amount: amount,
        type: "credit",
        description: "Wallet Top-up (Verified)",
        paymentId: payment.id,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`Successfully topped up ₹${amount} for user ${uid}`);
    } catch (error) {
      console.error("Database update failed:", error);
    }
  }

  res.json({ status: "ok" });
});