# VEGA Mobile - Production React Native Application

A cross-platform (iOS & Android) mobile client for the VEGA SaaS recruitment, AI mock interview, and talent analytics platform.

---

## 📱 Features & Modules

### 1. **Authentication & Multi-Role Support**
- **JWT & Refresh Tokens**: Secure token rotation with interceptors for seamless session renewal.
- **Biometric Enclave Integration**: Quick biometric authentication (Face ID / Fingerprint).
- **Role-Based Routing**: Dynamic navigation hierarchies for `STUDENT`, `COMPANY` (Recruiter), `TPO` (Placement Officer), and `ADMIN`.

### 2. **AI Mock Interview Studio**
- Live speech-to-text simulation and answer recording.
- Real-time conversational prompts and dynamic feedback.
- Automated AI Diagnostic scorecard with multi-dimensional ratings (Technical Accuracy, Communication, System Architecture, Concurrency, and Confidence).

### 3. **Career & Application Tracker**
- 1-Click job discovery, salary benchmarks, and skill tag matching.
- Visual stage tracker (Applied → Test → Technical Round → HR Round → Offer).
- Real-time milestone updates.

### 4. **Skill Assessment & Coding Arena**
- Proctored aptitude, DSA, and technical core assessments.
- Gamified XP rewards (`+150 XP`) that credit directly to the student talent wallet.
- LeetCode-style code runner with test-case pass/fail indicators.

### 5. **ATS Resume Builder & Optimizer**
- Live keyword matching score against target roles.
- Missing high-frequency ATS keyword suggestions.
- Formatted resume document exporter.

### 6. **Recruiter & TPO Management Hubs**
- Candidate search with minimum talent score filtering.
- 1-Click interview scheduler and candidate advancement pipeline.
- Campus-wide batch placement rates, CTC averages, and drive scheduler.

### 7. **Offline-First Resilience (Outbox Pattern)**
- Automatic buffering of interview responses and job applications when disconnected.
- Seamless synchronization with backend API upon network restoration.

---

## 📂 Project Architecture

```
/vega-mobile
├── App.tsx                      # Root component with Redux Provider & SafeArea
├── index.js                     # Entry point
├── package.json                 # Native dependencies & scripts
└── src/
    ├── components/              # Reusable atomic UI components (Badge, MetricCard, etc.)
    ├── navigation/              # Type-safe React Navigation Stacks & Bottom Tabs
    ├── screens/                 # All role-specific mobile screens
    │   ├── LoginScreen.tsx
    │   ├── DashboardScreen.tsx
    │   ├── JobsScreen.tsx
    │   ├── ApplicationTrackerScreen.tsx
    │   ├── InterviewScreen.tsx
    │   ├── InterviewReportScreen.tsx
    │   ├── AssessmentCenterScreen.tsx
    │   ├── CodingArenaScreen.tsx
    │   ├── ResumeBuilderScreen.tsx
    │   ├── CommunityScreen.tsx
    │   ├── ProfileScreen.tsx
    │   ├── SettingsScreen.tsx
    │   ├── RecruiterDashboardScreen.tsx
    │   ├── RecruiterCandidatesScreen.tsx
    │   ├── RecruiterJobsScreen.tsx
    │   ├── TpoDashboardScreen.tsx
    │   └── AdminDashboardScreen.tsx
    ├── services/                # Axios API client with offline outbox & Socket.IO
    ├── store/                   # Redux Toolkit slices (auth, student, config)
    └── types/                   # TypeScript interfaces & domain models
```

---

## 🚀 How to Run with Expo Go (On Your Phone)

### Step 1: Install Expo Go on your Phone
- **Android**: Download **Expo Go** from Google Play Store.
- **iPhone / iOS**: Download **Expo Go** from the Apple App Store.

### Step 2: Start the Expo Development Server on your Computer
1. Open your terminal and navigate to the mobile project directory:
   ```bash
   cd vega-mobile
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Launch the Expo bundler:
   ```bash
   npx expo start
   ```
   *(Or `npx expo start --tunnel` if your phone and computer are on different Wi-Fi networks / mobile data).*

### Step 3: Open on Your Phone
- **Android**: Open the **Expo Go** app and tap **"Scan QR code"**, then scan the QR code displayed in your terminal.
- **iOS**: Open your iPhone's default **Camera app**, point it at the QR code, and tap the **"Open in Expo Go"** banner.

---

## ⚡ Quick Troubleshooting for Expo Go
- **Same Wi-Fi Network**: Ensure your computer and phone are connected to the same Wi-Fi network.
- **Tunnel Mode**: If your college/office Wi-Fi blocks local network communication between devices, start Expo with tunnel mode:
  ```bash
  npx expo start --tunnel
  ```
