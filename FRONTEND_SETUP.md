# Frontend Setup & Installation Guide

## Prerequisites

### System Requirements
- **Node.js** 16.x or higher
- **npm** 7.x or higher (comes with Node.js)
- **Git** for version control

### For Web Development
- Modern web browser (Chrome, Firefox, Safari, Edge)
- VS Code or preferred code editor

### For Mobile Development
- **Expo CLI**: `npm install -g expo-cli`
- **Xcode** (macOS) - for iOS simulator
- **Android Studio** - for Android emulator
- **Expo Go app** - on physical device

---

## Installation & Setup

### 1. Clone the Repository
```bash
git clone <repository-url>
cd chat-app
```

### 2. Web Frontend Setup

#### Install Dependencies
```bash
cd web
npm install
```

#### Environment Configuration
Create `.env` file in `web/` directory:
```env
REACT_APP_API_URL=http://localhost:8080/api/v1
REACT_APP_SOCKET_URL=ws://localhost:8080/ws
REACT_APP_ENV=development
```

For production:
```env
REACT_APP_API_URL=https://api.chatapp.com/api/v1
REACT_APP_SOCKET_URL=wss://api.chatapp.com/ws
REACT_APP_ENV=production
```

#### Start Development Server
```bash
npm run dev
```
Server runs on `http://localhost:5173` (Vite default)

#### Build for Production
```bash
npm run build
```
Output in `dist/` directory

### 3. Mobile Frontend Setup

#### Install Dependencies
```bash
cd mobile
npm install
```

#### Environment Configuration
Create `.env` file in `mobile/` directory:
```env
EXPO_PUBLIC_API_URL=http://localhost:8080/api/v1
EXPO_PUBLIC_SOCKET_URL=ws://localhost:8080/ws
EXPO_PUBLIC_ENV=development
```

For production:
```env
EXPO_PUBLIC_API_URL=https://api.chatapp.com/api/v1
EXPO_PUBLIC_SOCKET_URL=wss://api.chatapp.com/ws
EXPO_PUBLIC_ENV=production
```

Note: Expo uses `EXPO_PUBLIC_*` prefix for environment variables that are accessible in JavaScript code.

#### Start Expo Development Server
```bash
expo start
```

This will give you options:
- Press `i` to launch iOS simulator
- Press `a` to launch Android emulator
- Press `w` to open in web browser
- Scan QR code with Expo Go app on physical device

#### Build for Production

**iOS**
```bash
expo build:ios
```

**Android**
```bash
expo build:android
```

**EAS Build** (Recommended)
```bash
eas build --platform ios
eas build --platform android
```

---

## API Integration & Configuration

### Backend URL Configuration

#### Web (`web/src/api/axiosClient.js`)
```javascript
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080/api/v1';
```

#### Mobile (`mobile/src/api/axiosClient.js`)
```javascript
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
```

### Token Storage

#### Web (localStorage)
Tokens automatically stored in localStorage by authSlice

#### Mobile (Expo Secure Store)
```javascript
import * as SecureStore from 'expo-secure-store';

// Automatically handled by axiosClient with platform detection
```

### WebSocket Configuration

**Web & Mobile** (`src/utils/socket.js`)
```javascript
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'ws://localhost:8080/ws';

const socket = io(SOCKET_URL, {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5,
});
```

---

## Running Both Platforms

### Terminal Setup (Option 1: Multiple Terminals)

**Terminal 1 - Backend Server**
```bash
cd backend
./mvnw spring-boot:run
# or
mvn spring-boot:run
```

**Terminal 2 - Web Frontend**
```bash
cd web
npm run dev
```

**Terminal 3 - Mobile Frontend**
```bash
cd mobile
expo start
```

### Using npm-run-all (Option 2: Single Terminal)

From root directory, install concurrently:
```bash
npm install concurrently --save-dev
```

Create `package.json` in root with scripts:
```json
{
  "scripts": {
    "dev:all": "concurrently \"npm run dev:backend\" \"npm run dev:web\" \"npm run dev:mobile\"",
    "dev:backend": "cd backend && ./mvnw spring-boot:run",
    "dev:web": "cd web && npm run dev",
    "dev:mobile": "cd mobile && expo start"
  }
}
```

Then run:
```bash
npm run dev:all
```

---

## Development Workflow

### Making Changes

#### Web Frontend
1. Edit files in `web/src/`
2. Vite hot-reloads automatically
3. Check browser console for errors

#### Mobile Frontend
1. Edit files in `mobile/src/` or `mobile/app/`
2. Changes refresh on device (Ctrl+R or Cmd+R)
3. Check Expo console for errors

#### Testing Changes
1. **Login**: Username `+1234567890` / Password `password123`
2. **Create Conversation**: Click "+" button
3. **Send Message**: Type and press Send
4. **Check Real-time**: Open same conversation in another device/browser

### Debugging

#### Web
- Press `F12` to open DevTools
- Redux DevTools extension recommended: [Install here](https://redux-devtools.xyz/)
- Use Redux state inspection to verify store updates

#### Mobile
- Use Expo DevTools (shake device or press `d` in Expo CLI)
- View logs with Expo CLI
- Use React DevTools for component inspection

---

## Testing

### Web Frontend Testing

#### Unit Tests (Jest)
```bash
cd web
npm test
```

#### E2E Tests (Cypress) - *To be setup*
```bash
npm run test:e2e
```

### Mobile Frontend Testing

#### Unit Tests (Jest)
```bash
cd mobile
npm test
```

#### E2E Tests (Detox) - *To be setup*
```bash
npm run test:e2e
```

---

## Troubleshooting

### Web Frontend

#### Port 5173 already in use
```bash
# Use different port
npm run dev -- --port 3000
```

#### Module not found errors
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### Redux state not updating
- Check Redux DevTools
- Verify async thunks are dispatched correctly
- Check Redux Thunk middleware is configured

### Mobile Frontend

#### Expo connection issues
```bash
# Clear Expo cache
expo start -c
```

#### Module resolution errors
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json .expo
npm install
```

#### Simulator issues
- Restart simulator: Xcode → Simulator → Reset Contents and Settings
- Or uninstall app from emulator and reinstall

#### Token storage issues (Mobile)
- Ensure `expo-secure-store` is installed: `expo install expo-secure-store`
- Check device has secure storage capability
- On Android, ensure permissions are set in app.json

### Both Platforms

#### Cannot connect to backend
1. Verify backend is running on correct port
2. Check API URL in environment variables
3. Verify CORS is enabled on backend
4. Check network connectivity

#### WebSocket connection fails
1. Verify WebSocket URL is correct
2. Check backend WebSocket endpoint
3. Verify firewall allows WebSocket traffic
4. Check browser console for connection errors

#### Login fails with network error
1. Verify backend API is accessible: `curl http://localhost:8080/api/v1/health`
2. Check token endpoints: `/auth/login`, `/auth/register`
3. Verify response format matches API client expectations
4. Check database connectivity on backend

---

## Project Structure Reference

### Web
```
web/
├── src/
│   ├── pages/          # Full-page components
│   ├── components/     # Reusable components
│   ├── store/          # Redux state management
│   ├── api/            # API client functions
│   ├── hooks/          # Custom React hooks
│   ├── styles/         # CSS modules
│   ├── utils/          # Utility functions
│   ├── App.jsx         # Main app component
│   └── main.jsx        # Entry point
├── public/             # Static assets
├── .env                # Environment variables
├── package.json        # Dependencies
└── vite.config.js      # Vite configuration
```

### Mobile
```
mobile/
├── app/               # File-based routing (Expo Router)
│   ├── (auth)/       # Auth screens
│   └── (main)/       # Main screens
├── src/
│   ├── api/          # API client functions
│   ├── components/   # Reusable components
│   ├── hooks/        # Custom React hooks
│   ├── store/        # Redux state management
│   └── utils/        # Utility functions
├── assets/           # Images, fonts, etc.
├── .env              # Environment variables
├── package.json      # Dependencies
├── app.json          # Expo configuration
└── babel.config.js   # Babel configuration
```

---

## Performance Tips

### Web
- Use React DevTools Profiler to identify slow renders
- Enable code splitting in Vite config
- Use lazy loading for pages
- Implement virtual scrolling for large lists

### Mobile
- Monitor app bundle size with `expo build --release`
- Use React Native DevTools for performance monitoring
- Implement FlatList virtualization
- Avoid unnecessary re-renders with React.memo

---

## Deployment

### Web to Vercel
```bash
# Connect GitHub repository to Vercel
# Add environment variables in Vercel dashboard
# Automatic deployment on push to main branch
```

### Mobile to Stores
```bash
# iOS App Store
eas submit --platform ios

# Google Play
eas submit --platform android
```

---

## Additional Resources

- [Vite Documentation](https://vitejs.dev/)
- [React Redux Documentation](https://react-redux.js.org/)
- [Expo Documentation](https://docs.expo.dev/)
- [React Router Documentation](https://reactrouter.com/)
- [Socket.io Client Documentation](https://socket.io/docs/v4/client-api/)

---

## Support & Contribution

For issues or contributions, please refer to the main project repository's CONTRIBUTING.md file.

**Last Updated**: Current session  
**Status**: Ready for Development
