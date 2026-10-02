# TimeTracker App - Performance Optimized v2.2

A comprehensive time tracking application with Supabase integration, featuring performance optimizations, offline support, and enhanced user experience.

## 🚀 Latest Features & Optimizations

### 1. **Performance & Sync Optimization (v2.2)**
- **Delta Sync Implementation**: Single-entry saves instead of bulk arrays, eliminating 50+ concurrent requests
- **PWA Caching Strategy**: Updated to `StaleWhileRevalidate` for instant iOS PWA startup
- **Startup Performance**: Heavy calculations deferred with `requestIdleCallback` for faster app loading
- **Background Sync**: Complete offline-first architecture with queue management
- **Multi-tab Synchronization**: Real-time data sync across browser tabs

### 2. **Employee Type System**
- **Flexible employee configuration** with Full-Time and Part-Time support
- **Configurable work hours** for part-time employees (6-9 hours daily, 3-5 days/week)
- **Automatic monthly hours calculation** based on employee settings
- **Employee-specific overtime calculations** using individual standards

### 3. **Enhanced Authentication System**
- **Supabase Password Reset**: Email-based recovery with secure token verification
- **React Router Integration**: Route-based navigation with protected routes
- **Data Recovery Options**: Legacy local data recovery for existing users
- **Session Management**: Automatic timeout and secure token handling

### 4. **Data Privacy & Security**
- **Salary Privacy**: Local encryption, never stored in cloud
- **Row Level Security (RLS)**: Users only access their own data
- **Encrypted Storage**: Sensitive data protected locally
- **Cross-device Privacy**: Maintained across all platforms

### 5. **Offline-First Architecture**
- **Background Sync**: Automatic sync when connection restored
- **Offline Queue**: Pending operations queued locally
- **Conflict Resolution**: Smart merge strategies
- **Multi-tab Sync**: Real-time synchronization across tabs

## 📁 Project Structure

### Core Components
```
src/
├── components/
│   ├── LoginScreen.jsx              # Enhanced login with password reset
│   ├── PasswordResetPage.jsx        # Dedicated password reset page
│   ├── BackupReminderModal.jsx      # Data backup reminders (z-index fixed)
│   ├── ModalShell.jsx               # Enhanced modal with overlayClassName
│   └── RecoveryModal.jsx            # Data recovery for legacy users
├── context/
│   ├── TimeEntryContext.jsx         # Delta sync implementation
│   ├── TimeTrackerContext-optimized.jsx # Performance optimized
│   └── SupabaseAuthContext.jsx      # Auth with resetPassword function
├── utils/
│   ├── backgroundSync.js            # Complete background sync system
│   ├── offlineQueue.js              # Offline operation queue
│   ├── simple-encryption.js         # Local data encryption
│   └── supabaseData.js              # Single-entry delta saves
└── styles/
    ├── backup-reminder.css         # Fixed z-index issues
    └── performance-optimizations.css # Startup performance
```

### Configuration Files
```
├── vite.config.js                   # PWA caching strategy updated
├── package.json                     # Dependencies and scripts
└── .env                            # Supabase configuration
```

## 🔧 Configuration

### Environment Variables
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
VITE_SUPABASE_DISABLED=false
```

Service role keys must not use the `VITE_` prefix or be exposed to browser builds. Use them only in trusted server-side or local CLI environments.

### PWA Configuration
- **Caching Strategy**: `StaleWhileRevalidate` for instant UI loading
- **Service Worker**: Automatic background sync
- **Offline Support**: Complete offline-first experience
- **iOS PWA**: Optimized startup performance

### Check-in Reminder Push Notifications
- **Reliable iOS reminders require server-side Web Push** through the Supabase `checkin-reminders` Edge Function.
- **Setup guide**: see `docs/checkin-reminders-ios-web-push.md`.
- **Cron SQL**: see `supabase/sql/schedule_checkin_reminders.sql`.

## 🚀 Getting Started

### Installation
```bash
npm install
```

### Development
```bash
npm run dev
```

### Build & Deploy
```bash
npm run build
npm run deploy
```

## 🛡️ Safe Development (read before running the app)

The live database is the same one your real timesheet uses, so day-to-day development never touches it.

| Command | Data | Use it for |
|---|---|---|
| `npm run dev` | **Fake local data** in the browser (port 5199). No request ever reaches Supabase. Log in as `devuser`. | Everything: building, testing, trying imports and deletes |
| `npm run dev:real` | **Your real Supabase data.** Asks for confirmation each tab and shows a red banner. | Only when you must check something against real data |

Rules the app enforces for you:
- A bare `vite` (no named mode) refuses to start, so you cannot reach the real database by accident.
- The two modes remember which one used a browser address and refuse to start in the other, because browser storage is shared per address.
- The local cache is stored per user, and entries owned by another account are never loaded or uploaded.
- Saving an entry that belongs to a different account is blocked at the lowest layer.
- Import never writes outside the period you pick and never creates two entries for one date. Prefer **Merge**; **Replace** deletes the period's entries from the database.

If you ever need to reset the fake data: run `__resetLocalDev()` in the browser console on the `npm run dev` tab and reload.

Backups: turn on Supabase daily backups (Dashboard, Database, Backups) and export your data regularly from Settings, Data, Export.

## 🔐 Security Features

### Authentication Flow
1. **Login Screen**: Email/username with password reset option
2. **Password Reset**: Secure email-based recovery
3. **Session Management**: Automatic timeout and token handling
4. **Protected Routes**: Authentication-based navigation

### Data Privacy
- **Salary Encryption**: Never stored in Supabase
- **RLS Policies**: Database-level access control
- **Local Storage**: Encrypted sensitive data
- **Cross-device**: Privacy maintained everywhere

### Offline Security
- **Encrypted Queue**: Offline operations protected
- **Data Validation**: Before sync operations
- **Conflict Resolution**: Smart merge strategies
- **Integrity Checks**: Data corruption prevention

## � Performance Optimizations

### Sync Performance
- **Delta Sync**: Single-entry saves (1 request vs 50+)
- **Background Processing**: Non-blocking operations
- **Retry Logic**: Navigator Lock Manager timeout handling
- **Queue Management**: Efficient offline operation handling

### Startup Performance
- **Deferred Calculations**: `requestIdleCallback` for heavy processing
- **PWA Caching**: Instant UI loading from cache
- **Code Splitting**: Lazy-loaded components
- **Resource Optimization**: Minimized bundle size

### Data Loading
- **Parallel Requests**: Efficient data fetching
- **Smart Caching**: Local storage optimization
- **Incremental Loading**: Pagination for large datasets
- **Conflict Resolution**: Minimal data transfer

## 🔄 Recent Fixes (v2.2)

### Modal Z-Index Issues
- **Backup Reminder Modal**: Fixed overlay positioning above header
- **ModalShell Enhancement**: Added `overlayClassName` prop
- **CSS Hierarchy**: Proper z-index stacking (10002 for modals)
- **Responsive Design**: Better mobile modal positioning

### Sync Reliability
- **Delta Implementation**: Eliminated bulk array requests
- **Error Handling**: Improved retry mechanisms
- **Background Sync**: More reliable offline queue processing
- **Multi-tab**: Better synchronization across tabs

## 📱 User Experience

### Enhanced Interface
- **Smooth Transitions**: Optimized animations
- **Pull-to-Refresh**: Mobile-friendly data refresh
- **Auto-save Indicators**: Real-time save status
- **Offline Status**: Clear connection indicators

### Modal Improvements
- **Proper Layering**: Modals appear above header navigation
- **Responsive Design**: Better mobile modal positioning
- **Accessibility**: Improved keyboard navigation
- **Visual Feedback**: Enhanced loading states

## 🛠️ Troubleshooting

### Common Issues

#### Sync Problems
- **Check Network**: Verify internet connectivity
- **Clear Cache**: Refresh browser cache if needed
- **Background Sync**: Ensure service worker is active
- **Queue Status**: Check offline queue in console

#### Modal Issues
- **Z-Index Conflicts**: Fixed in v2.2
- **Overlay Positioning**: Proper header clearance
- **Mobile Display**: Responsive improvements applied
- **Touch Events**: Enhanced mobile interaction

#### Performance Issues
- **Startup Speed**: Optimized with deferred calculations
- **Memory Usage**: Reduced with better caching
- **Network Requests**: Minimized with delta sync
- **Bundle Size**: Optimized with code splitting

### Debug Tools
- **Browser Console**: Auth state and sync status
- **Network Tab**: Supabase request monitoring
- **Application Tab**: Local storage inspection
- **Performance Tab**: Startup optimization analysis

## � Architecture Overview

### Data Flow
1. **Local Storage**: Immediate data access
2. **Background Sync**: Automatic cloud synchronization
3. **Delta Updates**: Single-entry change propagation
4. **Conflict Resolution**: Smart data merging

### Component Hierarchy
- **App Level**: Router and authentication
- **Context Level**: State management and sync
- **Component Level**: UI and user interactions
- **Utility Level**: Data processing and encryption

### Performance Strategy
- **Lazy Loading**: Non-critical components
- **Code Splitting**: Optimized bundle sizes
- **Background Processing**: Non-blocking operations
- **Smart Caching**: Local and cloud optimization

---

**Version**: 2.2  
**Last Updated**: 2026-03-05  
**Dependencies**: React 18+, Supabase, React Router DOM, Vite PWA  
**Performance**: Delta sync, PWA optimization, offline-first architecture
