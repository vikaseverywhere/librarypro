# LibraryPro - Library Management App

A comprehensive mobile application for managing library students, fees, and analytics built with Angular + Ionic + Firebase.

## 📦 Project Structure

```
library-app/
├── src/
│   ├── app/
│   │   ├── core/              # Core services (Auth, Firestore, Payment)
│   │   ├── shared/            # Shared components, pipes, utilities
│   │   ├── modules/           # Feature modules (Dashboard, Students, Fees, Settings)
│   │   ├── app.module.ts      # Root module
│   │   ├── app-routing.module.ts
│   │   ├── app.component.*
│   ├── environments/          # Environment configs
│   ├── styles.scss            # Global styles
│   ├── main.ts               # Application entry point
│   └── index.html
├── firebase/
│   ├── functions/            # Cloud Functions (placeholder)
│   ├── firestore.rules       # Security rules
│   └── firestore.indexes.json # Firestore indexes
├── angular.json
├── ionic.config.json
├── capacitor.config.json
└── package.json
```

## 🚀 Quick Start

### 1. **Prerequisites**
- Node.js v18+ installed
- npm or yarn
- Firebase account (free tier works)
- Android SDK (for mobile build)

### 2. **Installation**

```bash
# Navigate to project directory
cd "d:\Library App"

# Install dependencies
npm install

# Install Ionic CLI (if not already installed)
npm install -g @ionic/cli
```

### 3. **Setup Firebase**

Create a Firebase project:
1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create new project "library-app-prod"
3. Enable Firestore Database (Start in Production mode)
4. Enable Firebase Auth (Email/Password + Google OAuth)
5. Copy credentials to `src/environments/environment.ts`:

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

### 4. **Deploy Firebase Security Rules**

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Deploy rules
firebase deploy --only firestore:rules,firestore:indexes --project library-app-prod
```

### 5. **Run Locally**

```bash
# Development server
npm start

# Or use Ionic serve
ionic serve

# Opens http://localhost:4200
```

Test credentials (after signup):
- Email: test@library.com
- Password: test123456

## 📱 Build for Mobile

### Android APK

```bash
# Install Capacitor
npm install @capacitor/core @capacitor/cli

# Add Android platform
npx cap add android

# Build Angular project
npm run build:prod

# Copy to Android
npx cap copy android

# Build APK
npx cap build android

# Or open in Android Studio
npx cap open android
```

**Output**: `android/app/build/outputs/apk/release/app-release.apk`

### iOS (Mac only)

```bash
npx cap add ios
npm run build:prod
npx cap copy ios
npx cap build ios
npx cap open ios
```

## 🔧 Configuration

### Update App Name & Package ID

1. **angular.json**: Change project name
2. **ionic.config.json**: Update app name
3. **capacitor.config.json**: Update `appId` to `com.vikas.librarypro`
4. **package.json**: Update name

### Add Razorpay Key

In `src/environments/environment.ts`:
```typescript
razorpay: {
  keyId: "YOUR_RAZORPAY_KEY_ID"
}
```

## 📝 Available Services

### AuthService
- `signup(email, password, libraryName, city)`
- `login(email, password)`
- `logout()`
- Observable: `userProfile`, `isAuthenticated`

### FirestoreService
- `create(collectionName, data)`
- `read(collectionName, docId)`
- `update(collectionName, docId, data)`
- `delete(collectionName, docId)`
- `list(collectionName)`
- `search(collectionName, field, value)`

### StudentService
- `addStudent(data)`
- `updateStudent(studentId, data)`
- `deleteStudent(studentId)`
- `getAllStudents()`
- `searchStudents(searchTerm)`
- `getStudentStats()`

### FeeService
- `createFee(data)`
- `createBulkFees(studentIds, month, amount, dueDate)`
- `markAsPaid(feeId, paymentMethod)`
- `getFeesByStatus(status)`
- `getFeeStats()`

## 🔐 Security

- All data scoped to `libraryId` via Firestore security rules
- Auth guard on all protected routes
- Custom claims can be added via Cloud Function (production)

## 📊 Database Schema

**Collections**:
- `users/{uid}` - User profiles
- `libraries/{libraryId}` - Library data
- `libraries/{libraryId}/students/{studentId}` - Students
- `libraries/{libraryId}/fees/{feeId}` - Fees
- `libraries/{libraryId}/transactions/{txnId}` - Transactions

See `docs/ARCHITECTURE.md` for detailed schema.

## 🎨 Styling

- **Framework**: Ionic UI components
- **Styles**: SCSS (global + component scoped)
- **Theme**: Primary color #3399cc
- **Responsive**: Mobile-first design

## 🧪 Testing

```bash
# Run unit tests
npm test

# Run with coverage
ng test --code-coverage
```

## 📦 Deployment

### Firebase Hosting (Frontend)
```bash
firebase deploy --only hosting
```

### Android - Google Play
1. Generate signed APK
2. Create developer account (₹25)
3. Upload to Play Console
4. Fill app details + screenshots
5. Submit for review (24-72 hours)

See `docs/DEPLOYMENT.md` for detailed steps.

## 🐛 Troubleshooting

**Issue**: "Firebase initialization failed"
- Check Firebase credentials in `environment.ts`
- Verify project exists in Firebase Console

**Issue**: "Authentication module not found"
- Run `npm install @angular/fire firebase`

**Issue**: "Styles not loading"
- Clear `node_modules/.cache` and rebuild

**Issue**: "Cordova not found"
- Run `npm install -g @ionic/cli`

## 📚 Documentation

- [Architecture Guide](docs/ARCHITECTURE.md)
- [API Design](docs/API.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [Monetization Strategy](docs/MONETIZATION.md)

## 🤝 Contributing

This is a personal project. Fork and modify as needed.

## 📄 License

MIT License - See LICENSE file

## 👤 Author

Vikas - LibraryPro Creator

---

**Ready to ship? 🚀**
1. Add Firebase credentials
2. Run `npm install && npm start`
3. Create account and test
4. Build APK for Play Store

Questions? Check the docs folder or review the services!
