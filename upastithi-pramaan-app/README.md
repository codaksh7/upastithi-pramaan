# Upastithi-Pramaan — React Native Expo Mobile App

**100% feature-parity** with the web frontend and FastAPI backend.  
Dual-layer biometric attendance: **Face Recognition + Wi-Fi MAC Address + 2FA Code**  
Fr. Conceicao Rodrigues College of Engineering, Mumbai — TE Computer Engineering, Division B

---

## ✅ Complete Feature Matrix

| Feature | Web Frontend | Mobile App |
|---------|-------------|------------|
| Auth (all 3 roles) | ✅ | ✅ |
| Student: Attendance overview + CSV export | ✅ | ✅ |
| Student: Mark attendance (2FA + Face + MAC) | ✅ | ✅ |
| Student: Calendar view | ✅ | ✅ |
| Student: Profile + device info | ✅ | ✅ |
| Student: Submit disputes | ✅ | ✅ |
| Student: Notifications (list, mark read, delete) | ✅ | ✅ |
| Faculty: Live session + 2FA code display | ✅ | ✅ |
| Faculty: Real-time student list + override | ✅ | ✅ |
| Faculty: Analytics + 30-day chart | ✅ | ✅ |
| Faculty: Export reports with date range | ✅ | ✅ |
| Admin: Overview + system config | ✅ | ✅ |
| Admin: Enroll students (single + CSV bulk) | ✅ | ✅ |
| Admin: Update student details | ✅ | ✅ |
| Admin: Add faculty (single + CSV bulk) | ✅ | ✅ |
| Admin: Update faculty details | ✅ | ✅ |
| Admin: Device registry (approve/flag) | ✅ | ✅ |
| Admin: Dispute management (resolve/reject) | ✅ | ✅ |
| Admin: Audit logs with filter + CSV export | ✅ | ✅ |
| Admin: Face model status + retrain trigger | ✅ | ✅ |
| Generic notifications API (list/read/delete) | ✅ | ✅ |

---

## 🚀 Quick Start

### 1. Prerequisites
```bash
npm install -g expo-cli
# Install Expo Go on your phone (iOS/Android)
```

### 2. Install dependencies
```bash
cd upastithi-pramaan-app
npm install
```

### 3. Configure backend URL
```bash
cp .env.example .env
```
Edit `.env`:
```
EXPO_PUBLIC_API_URL=http://YOUR_MACHINE_IP:8000
```
> Find your IP: `ipconfig` (Windows) or `ifconfig` (Mac/Linux)  
> Your phone and dev machine must be on the **same Wi-Fi network**

### 4. Start
```bash
npx expo start
```
Scan the QR code with Expo Go on your phone.

---

## 🔑 Default Credentials

| Role    | ID         | Password    |
|---------|-----------|-------------|
| Admin   | `ADM-001`  | `admin@123` |
| Faculty | (add via admin panel) | `frcrce@123` |
| Student | (enroll via admin panel) | `frcrce@123` |

---

## 📁 Project Structure

```
upastithi-pramaan-app/
├── App.js                          # Root: GestureHandler + SafeArea + AuthProvider
├── app.json                        # Expo config (permissions, plugins, icons)
├── babel.config.js
├── .env.example                    # API URL config template
├── src/
│   ├── api/
│   │   └── index.js                # All API calls — 100% parity with web api.js
│   │                               # Includes: exportCSV, exportReport(date range),
│   │                               # exportLogs, massEnrollStudents, massAddFaculty,
│   │                               # updateFaculty, getFaceModel, retrain, notifApi
│   ├── context/
│   │   └── AuthContext.js          # JWT stored in expo-secure-store (encrypted)
│   ├── utils/
│   │   └── theme.js                # Design tokens (colors, spacing, helpers)
│   ├── components/
│   │   ├── UI.js                   # GlowCard, Badge, CyberButton, OutlineButton,
│   │   │                           # PulseDot, ProgressBar, SectionLabel, InfoRow,
│   │   │                           # ModalSheet, LoadingScreen, EmptyState, Divider
│   │   └── Background.js           # Atmospheric cyberpunk grid background
│   ├── navigation/
│   │   └── index.js                # All navigators:
│   │                               # Student: 3 tabs + MarkAttendance stack
│   │                               # Faculty: 3 tabs
│   │                               # Admin: 7 tabs (including AI Model tab)
│   └── screens/
│       ├── auth/
│       │   └── LoginScreen.js      # Role selector + animated login
│       ├── student/
│       │   ├── StudentHomeScreen.js       # Attendance overview + CSV export
│       │   ├── MarkAttendanceScreen.js    # 3-step: 2FA numpad → face scan → submit
│       │   ├── StudentCalendarScreen.js   # Monthly calendar with day status
│       │   └── StudentProfileScreen.js   # Profile + device + disputes + notifications
│       ├── faculty/
│       │   ├── FacultySessionScreen.js    # Live session + 2FA code + student override
│       │   ├── FacultyAnalyticsScreen.js  # Bar chart + defaulters + export modal
│       │   └── FacultyProfileScreen.js   # Profile + assigned subjects + system info
│       └── admin/
│           ├── AdminOverviewScreen.js    # System stats + analytics + config
│           ├── AdminStudentsScreen.js    # Enroll + update + delete + CSV bulk upload
│           ├── AdminFacultyScreen.js     # Add + update + delete + CSV bulk upload
│           ├── AdminDevicesScreen.js     # Approve / flag device registrations
│           ├── AdminDisputesScreen.js    # Resolve / reject disputes with filter
│           ├── AdminLogsScreen.js        # Timeline audit log + CSV export
│           └── AdminFaceModelScreen.js   # AI model status + accuracy + retrain
└── assets/
    ├── icon.png
    ├── splash.png
    ├── adaptive-icon.png
    └── favicon.png
```

---

## 🎨 Design System

Cyberpunk / dark terminal aesthetic — consistent with the web frontend.

| Token         | Value      | Usage                    |
|--------------|-----------|--------------------------|
| `void`        | `#020408`  | App background           |
| `deep`        | `#040c14`  | Modal / bottom sheet     |
| `cardBg`      | `#0a1a2e`  | Card background          |
| `cyan`        | `#00c8ff`  | Faculty accent, primary  |
| `green`       | `#00ff9d`  | Student accent, success  |
| `amber`       | `#ffb800`  | Warning, admin secondary |
| `red`         | `#ff3366`  | Admin accent, errors     |
| Font          | `monospace` | All text                |

---

## 📱 Screen Inventory

### Student App (3 tabs + modal)
1. **Overview** — Attendance %, subject breakdown with progress bars, live session banner, CSV export, notifications
2. **Calendar** — Month navigator, color-coded day grid, monthly stats
3. **Profile** — 4 sub-tabs: Profile info / Device / Disputes / Notifications
4. **Mark Attendance** (modal from Overview) — Numpad 2FA → front camera face scan with corner overlay → confirm & submit

### Faculty App (3 tabs)
1. **Session** — Subject picker → Start/End session, giant rotating 2FA code display with countdown timer, live student list with toggle overrides
2. **Analytics** — 30-day bar chart with 75% threshold line, defaulters ranked list, today summary, export modal with 6 report types + date range picker
3. **Profile** — Faculty info, assigned subjects, system technical info

### Admin App (7 tabs)
1. **Overview** — System health tiles, subject attendance averages, configuration panel
2. **Students** — Search, enroll (form), update, delete, bulk CSV upload
3. **Faculty** — Add (form), update, delete, bulk CSV upload
4. **Devices** — Filter by status, approve/flag pending MACs
5. **Disputes** — Filter by status, resolve/reject with one tap, message preview
6. **Logs** — Timeline view, filter by event type, export full CSV
7. **AI Model** — Model status, accuracy bar, configuration, how-it-works, failure cases, retrain trigger

---

## 🔧 Building for Production

```bash
npm install -g eas-cli
eas login
eas build:configure

# Android APK (for direct install)
eas build --platform android --profile preview

# Android AAB (for Play Store)
eas build --platform android --profile production

# iOS
eas build --platform ios
```

---

## ⚙️ API Endpoints Used

All endpoints are in `src/api/index.js`:

```
POST /auth/login                           ← All roles
POST /auth/logout

GET  /students/me                          ← Student profile
GET  /students/me/attendance               ← Attendance summary
GET  /students/me/active-session           ← Check for live session
POST /students/me/attendance               ← Mark (2FA + face + MAC)
GET  /students/me/calendar                 ← Monthly calendar
GET  /students/me/device                   ← Registered device
GET  /students/me/notifications            ← Student notifications
PATCH /students/me/notifications/:id/read
POST /students/me/disputes                 ← Submit dispute
GET  /students/me/disputes
GET  /students/me/export                   ← CSV download

GET  /faculty/me
GET  /faculty/subjects
GET  /faculty/sessions/active
POST /faculty/sessions/start
POST /faculty/sessions/:id/end
GET  /faculty/sessions/:id/students
PATCH /faculty/sessions/:id/override
POST /faculty/sessions/:id/refresh-code
GET  /faculty/analytics
GET  /faculty/reports/:type                ← CSV with date range

GET  /admin/overview
GET  /admin/analytics
GET  /admin/students
POST /admin/students
PUT  /admin/students/:id
DELETE /admin/students/:id
POST /admin/students/upload                ← CSV bulk
GET  /admin/faculty
POST /admin/faculty
PUT  /admin/faculty/:id
DELETE /admin/faculty/:id
POST /admin/faculty/upload                 ← CSV bulk
GET  /admin/devices
PATCH /admin/devices/:mac/approve
PATCH /admin/devices/:mac/flag
GET  /admin/disputes
PATCH /admin/disputes/:id/resolve
PATCH /admin/disputes/:id/reject
GET  /admin/logs
GET  /admin/logs/export                    ← CSV download
GET  /admin/face-model
POST /admin/face-model/retrain

GET  /notifications/                       ← Generic notif API
PATCH /notifications/:id/read
DELETE /notifications/:id
```

---

## 🔒 Security

- JWT stored in **Expo SecureStore** (iOS Keychain / Android Keystore — hardware encrypted)
- Bearer token attached to every API request automatically
- Camera permission prompt before face scan
- 2FA codes rotate every 5 minutes (server-side via APScheduler)
- All actions server-side audit-logged
- MAC verification via ARP scan (Layer 2 — not spoofable over internet)

---

*Fr. Conceicao Rodrigues College of Engineering, Bandra (W), Mumbai — 400 050*  
*Department of Computer Engineering — Division B — Mini Project 2025–26*  
*Team: Devansh Nayak (10268), Blaise Rodrigues (10275), Daksh Thakkar (10283), Aryan Verma (10287)*
