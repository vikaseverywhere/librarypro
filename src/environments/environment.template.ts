// ============================================================
// ENVIRONMENT TEMPLATE — DO NOT put real keys here.
// This file is committed to the repo as a reference only.
//
// HOW TO SET UP:
//   1. Copy this file: cp environment.template.ts environment.ts
//   2. Fill in every placeholder value below.
//   3. Never commit environment.ts — it is in .gitignore.
// ============================================================

export const environment = {
    production: false,
    firebase: {
        apiKey: "YOUR_FIREBASE_API_KEY",
        authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
        projectId: "YOUR_PROJECT_ID",
        storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
        messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
        appId: "YOUR_APP_ID",
        measurementId: "YOUR_MEASUREMENT_ID"
    },
    razorpay: {
        keyId: "YOUR_RAZORPAY_KEY_ID"
    }
};
