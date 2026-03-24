# 🔥 FIREBASE SETUP - DETAILED GUIDE

**Read this if stuck on Firebase setup**

---

## 📋 Table of Contents
1. Creating Firebase Project
2. Creating Firestore Database
3. Enabling Authentication
4. Getting Credentials
5. Updating environment.ts
6. Deploying Security Rules
7. Testing Connection
8. Troubleshooting

---

## PART 1: Create Firebase Project

### Step 1.1: Go to Firebase Console
- URL: [https://console.firebase.google.com](https://console.firebase.google.com)
- Sign in with Google account (create one if needed)

### Step 1.2: Create New Project
1. Click **"Create a project"** (big blue button)
2. Project name: **`library-app-prod`**
3. Click **Continue**
4. Choose: **Disable Google Analytics** (not needed for MVP)
5. Click **Create project**
6. Wait 1-2 minutes for Firebase to provision

### Step 1.3: Verify Project Created
- Should see "library-app-prod" in left sidebar
- You'll be in "Getting Started" page

---

## PART 2: Create Firestore Database

### Step 2.1: Go to Firestore
1. Left menu → **Firestore Database** (under "Build")
2. Click **Create database**

### Step 2.2: Configure Database
- **Security rules**: Choose **"Production mode"**
  - (We'll add proper rules later)
- **Location**: Choose **"asia-south1"** (India, lowest latency)
- Click **Create**

### Step 2.3: Verify Database Created
- Should show "Firestore Database is ready"
- Tab title shows "Data"
- Collections list is empty (that's fine)

---

## PART 3: Enable Authentication

### Step 3.1: Go to Authentication
1. Left menu → **Authentication** (under "Build")
2. Click **Get Started**

### Step 3.2: Enable Email/Password
1. Click **Email/Password** (first option)
2. Toggle **"Enable"** → ON
3. Leave password reset to default
4. **Save**

### Step 3.3: (Optional) Enable Google OAuth
1. Back to Authentication
2. Click **Google** (in settings tab below)
3. Toggle **"Enable"** → ON
4. Project support email: Your email
5. **Save**

---

## PART 4: Get Firebase Credentials

### Step 4.1: Go to Project Settings
1. Top menu → Settings icon (⚙️) 
2. Click **"Project settings"**

### Step 4.2: Get Web Credentials
1. Go to **"General"** tab
2. Scroll down to **"Your apps"** section
3. Click **</> (Web)** icon

### Step 4.3: Register Web App
1. App nickname: **LibraryPro** (or any name)
2. **"Also set up Firebase Hosting for this app"**: Leave OFF (we'll use Ionic/Capacitor)
3. Click **Register app**

### Step 4.4: Copy Configuration
You'll see a code block like:
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyDxxxxxxxxxxxxxxxxx",
  authDomain: "library-app-prod.firebaseapp.com",
  projectId: "library-app-prod",
  storageBucket: "library-app-prod.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdefg123456",
  measurementId: "G-XXXXXXX"
};
```

**Copy this entire config** (you'll need it next)

---

## PART 5: Update environment.ts

### Step 5.1: Open File
In VS Code:
- File path: `src/environments/environment.ts`
- Open this file

### Step 5.2: Replace Firebase Config
Find:
```typescript
firebase: {
  apiKey: "YOUR_API_KEY",
  authDomain: "library-app-prod.firebaseapp.com",
  projectId: "library-app-prod",
  storageBucket: "library-app-prod.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
}
```

Replace with YOUR actual config from Firebase:
```typescript
firebase: {
  apiKey: "AIzaSyDxxxxxxxxxxxxxxxxx",
  authDomain: "library-app-prod.firebaseapp.com",
  projectId: "library-app-prod",
  storageBucket: "library-app-prod.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdefg123456",
  measurementId: "G-XXXXXXX"
}
```

### Step 5.3: Also Update Production Config
Do the same for: `src/environments/environment.prod.ts`

### Step 5.4: Save Files
- Ctrl+S (Windows) or Cmd+S (Mac)
- Check no red squiggly lines

---

## PART 6: Deploy Security Rules

### Step 6.1: Login to Firebase CLI
```powershell
firebase login
```
- Opens browser to Google login
- Click account to approve
- Terminal shows "Success"

### Step 6.2: Deploy Rules
```powershell
firebase deploy --only firestore:rules,firestore:indexes --project library-app-prod
```

Expected output:
```
✔ Deploy complete!
✔ Rules were published to cloud.firestore
✔ Indexes were published to cloud.firestore
```

---

## PART 7: Test Connection

### Step 7.1: Run App
```powershell
npm start
```

### Step 7.2: Create Account
1. Go to http://localhost:4200 (opens automatically)
2. Click **"Sign Up"**
3. Fill form:
   - Library Name: `Test Library`
   - City: `Mumbai`
   - Email: `test@library.com`
   - Password: `test123456`
4. Click **Create Account**

### Step 7.3: Check Firestore
1. Go back to Firebase Console
2. **Firestore Database** → **Data** tab
3. You should see:
   - Collection: `libraries`
   - Collection: `users`
   - Data inside with your test library

**If you see data = Firebase is working! ✅**

### Step 7.4: Test Login
1. Click **Logout** (top menu)
2. Click **Login**
3. Use same email/password
4. Should see dashboard

**If login works = Auth is working! ✅**

---

## PART 8: Troubleshooting

### Issue: "Firebase initialization failed"
**Symptom**: Page shows blank, console has error

**Fix**:
1. Check Firebase credentials in `environment.ts`
2. Copy-paste from Firebase console again
3. All fields must match exactly
4. Save file + refresh browser (Ctrl+Shift+R)

### Issue: "Auth/invalid-api-key"
**Symptom**: Can't sign up, "Invalid API key" error

**Fix**:
1. Check apiKey is correctly copied from Firebase
2. Verify project exists in Firebase Console
3. Check Authentication is enabled (Part 3)

### Issue: "Permission denied" on Firestore
**Symptom**: Can sign up but data not saving

**Fix**:
1. Check security rules deployed: `firebase deploy --only firestore:rules`
2. Check Firestore database created in Production mode (Part 2)
3. Wait 30 seconds after rules deploy

### Issue: "Firebase CLI not working"
**Symptom**: `firebase login` command not found

**Fix**:
```powershell
npm install -g firebase-tools
firebase login
```

### Issue: "CORS error"
**Symptom**: Browser console shows CORS error to Firebase

**Fix**: Usually not an issue with Firebase, but:
1. Check authDomain is correct in environment.ts
2. Don't modify Firebase config in code
3. Can add custom domain in Firebase Console later

### Issue: I still can't sign up
**Checklist**:
- [ ] Node.js v18+ installed
- [ ] npm install completed
- [ ] All Firebase credentials copied to environment.ts
- [ ] Firebase rules deployed
- [ ] Browser cache cleared (Ctrl+Shift+Delete)
- [ ] Refresh page (Ctrl+Shift+R)
- Check browser console (F12) for specific error

---

## 🔄 Next After Firebase Setup

1. ✅ Firebase project created
2. ✅ Credentials in environment.ts
3. ✅ Rules deployed
4. ✅ App running locally

**Now**: Build Week 2 features (Students CRUD)

---

## 📞 Firebase Support

- **Docs**: [https://firebase.google.com/docs](https://firebase.google.com/docs)
- **Status**: [https://firebase.status.io](https://firebase.status.io)
- **Stack Overflow**: Tag with `firebase`

---

**Firebase setup complete! Ready to code. 🚀**
