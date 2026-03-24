# 🎯 LOCAL SETUP INSTRUCTIONS - LIBRARRYPRO

Follow these step-by-step to get LibraryPro running on your machine.

## ⏱️ Time Required: ~30 minutes

---

## STEP 1: Install Prerequisites (5 min)

### Check Node.js
```powershell
node --version    # Should be v18+ (14+, v18 lts recommended)
npm --version     # Should be v8+
```

If not installed:
- Download from [nodejs.org](https://nodejs.org) (LTS version)
- Install + restart terminal

### Install Global Tools
```powershell
npm install -g @ionic/cli
npm install -g firebase-tools
```

---

## STEP 2: Navigate to Project
```powershell
cd "d:\Library App"
```

---

## STEP 3: Install Dependencies (10 min)
```powershell
npm install
```

⏳ This downloads ~1000 packages. Takes 5-10 min, be patient.

---

## STEP 4: Setup Firebase (5 min)

### Create Firebase Project
1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **"Create Project"**
   - Project name: `library-app-prod`
   - Uncheck "Enable Google Analytics" (optional)
   - Click **Create**
3. Wait for project to be ready (~1 min)

### Create Firestore Database
1. Left menu → **Firestore Database**
2. Click **Create Database**
3. Choose **Production mode**
4. Location: **asia-south1** (India)
5. Click **Create**

### Get Firebase Credentials
1. Left menu → **Project Settings** (gear icon)
2. Tab: **General**
3. Scroll down → **Your apps** section
4. Click **Web app** (</> icon)
5. Copy the config object that appears

**Example config:**
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyD1234...",
  authDomain: "library-app-prod.firebaseapp.com",
  projectId: "library-app-prod",
  storageBucket: "library-app-prod.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123..."
};
```

### Update Environment File

Open `src/environments/environment.ts` in VS Code and replace the `firebase` object with your credentials:

```typescript
export const environment = {
  production: false,
  firebase: {
    apiKey: "YOUR_API_KEY",
    authDomain: "library-app-prod.firebaseapp.com",
    projectId: "library-app-prod",
    storageBucket: "library-app-prod.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID",
    measurementId: "YOUR_MEASUREMENT_ID"
  },
  razorpay: {
    keyId: "YOUR_RAZORPAY_KEY_ID"  // Add later, keep as is for now
  }
};
```

### Enable Authentication
1. Left menu → **Authentication**
2. Click **Get Started**
3. Enable **Email/Password**
4. Save

---

## STEP 5: Deploy Firestore Rules

```powershell
firebase login  # Login with your Google account

firebase deploy --only firestore:rules --project library-app-prod
```

---

## STEP 6: Run the App (2 min)

```powershell
npm start
```

Or:
```powershell
ionic serve
```

**What happens:**
- Compiles Angular code
- Opens browser automatically to `http://localhost:4200`
- Hot-reload enabled (changes auto-refresh)

---

## STEP 7: Test the App (3 min)

### Sign Up
1. Click **"Sign Up"** button
2. Fill form:
   - Library Name: `Test Library`
   - City: `Mumbai`
   - Email: `test2025@test.com`
   - Password: `test123456`
3. Click **Create Account**

**Expected**: Redirects to Dashboard

### Dashboard
- Should show: "Test Library"
- Stats cards (all zeros - no data)
- Quick action buttons

### Logout
- Click menu (top right)
- Click **Logout**
- Should redirect to Login page

---

## 🎉 SUCCESS!

Your app is running locally. Now what?

### Continue Development
```powershell
# Terminal stays open, auto-refresh on save
# Edit files in VS Code → changes appear in browser instantly
```

### Common Next Steps

**1. Add More Features**
- See `src/app/modules/` for page structure
- Work on Students, Fees pages (stubbed out)

**2. Test on Real Phone (Android)**
```powershell
# Install Android Studio + SDK first
npm run build:prod
npx cap add android
npx cap copy android
npx cap open android
# Then build in Android Studio
```

**3. Build for Production**
```powershell
npm run build:prod
# Output: www/ folder with optimized code
```

---

## ⚠️ Troubleshooting

### "Port 4200 already in use"
```powershell
npm start -- --port 4300  # Use different port
```

### "Firebase credentials error"
- Double-check Firebase config in `environment.ts`
- All fields must match exactly
- No quotes around values (only strings in JS already quoted)

### "Module not found"
```powershell
rm -r node_modules   # Delete or use File Explorer
npm install          # Reinstall
```

### "Cannot find firebase-admin"
- Some errors are warnings, ignore if app loads
- Upgrade: `npm install --save firebase@latest`

### "Ionic not recognized"
```powershell
npm install -g @ionic/cli --force
```

### "Build fails with TypeScript error"
- Check `src/environments/environment.ts` syntax
- Missing/extra curly braces?
- Check VSCode Problems panel

---

## 📁 Key Files to Know

| File | Purpose |
|------|---------|
| `src/app/core/auth/auth.service.ts` | Login/signup logic |
| `src/app/core/firestore/firestore.service.ts` | Database operations |
| `src/app/modules/auth/login.page.ts` | Login page |
| `src/app/modules/dashboard/dashboard.page.ts` | Main dashboard |
| `src/environments/environment.ts` | Firebase config (EDIT THIS) |
| `package.json` | Dependencies |

---

## 📝 Next Steps After Setup

1. **Week 1 Progress**:
   - ✅ Auth (login/signup) - DONE
   - ✅ Dashboard - BASIC VERSION DONE
   - ⏳ Students CRUD - Next to build
   - ⏳ Fees management - Next to build

2. **Build Students Page** (Week 2)
   - See `src/app/modules/students/`
   - Implement add/search/list students
   - Call `StudentService` methods

3. **Build Fees Page** (Week 3)
   - See `src/app/modules/fees/`
   - Create bulk fees
   - Mark as paid
   - Show analytics

4. **Razorpay Integration** (Week 4)
   - Add Razorpay key to environment
   - Integrate payment checkout
   - Handle payment webhook

5. **Play Store** (Week 5-6)
   - Generate signed APK
   - Create Google Play account
   - Submit for review

---

## 🆘 Still Stuck?

**Check these in order:**
1. Browser console (F12 → Console tab) - any red errors?
2. Terminal output - compilation errors?
3. Firebase credentials - exactly match?
4. Network tab - Firebase calls happening?

**Quick fixes:**
```powershell
# Clear Angular cache
npm run build --configuration development
```

---

**You're all set! 🚀 Happy coding!**

Questions? Check README.md or message me.
