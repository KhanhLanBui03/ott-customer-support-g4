# Frontend Architecture Guide - Web & Mobile

## 📱 Frontend Technologies

### Web Frontend (React + TypeScript)
- **Framework**: React 18+
- **Language**: TypeScript
- **Build Tool**: Vite
- **State Management**: Redux Toolkit
- **API Client**: Axios
- **Real-time**: Socket.io-client (WebSocket)
- **UI Library**: Material-UI / Tailwind CSS
- **Styling**: CSS Modules / styled-components

### Mobile Frontend (React Native + Expo)
- **Framework**: React Native
- **Build Tool**: Expo
- **Language**: JavaScript/TypeScript
- **State Management**: Redux Toolkit
- **API Client**: Axios
- **Navigation**: React Navigation
- **Notifications**: Expo Notifications (FCM)

---

## 🏗️ Web Frontend Structure

```
web/
├── public/
│   └── index.html
├── src/
│   ├── pages/
│   │   ├── Login/
│   │   │   ├── index.tsx
│   │   │   ├── LoginForm.tsx
│   │   │   └── styles.module.css
│   │   ├── Register/
│   │   │   ├── index.tsx
│   │   │   └── RegisterForm.tsx
│   │   ├── Chat/
│   │   │   ├── index.tsx
│   │   │   ├── ConversationList.tsx
│   │   │   ├── ChatWindow.tsx
│   │   │   ├── MessageInput.tsx
│   │   │   └── styles.module.css
│   │   ├── Profile/
│   │   │   ├── index.tsx
│   │   │   └── EditProfile.tsx
│   │   ├── Story/
│   │   │   ├── index.tsx
│   │   │   ├── StoryViewer.tsx
│   │   │   └── StoryCreator.tsx
│   │   └── Contacts/
│   │       ├── index.tsx
│   │       └── ContactSync.tsx
│   │
│   ├── components/
│   │   ├── ChatWindow/
│   │   │   ├── index.tsx
│   │   │   ├── MessageList.tsx
│   │   │   ├── MessageItem.tsx
│   │   │   └── styles.module.css
│   │   ├── Sidebar/
│   │   │   ├── index.tsx
│   │   │   ├── ConversationItem.tsx
│   │   │   └── styles.module.css
│   │   ├── common/
│   │   │   ├── Avatar.tsx
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Loader.tsx
│   │   │   └── Toast.tsx
│   │   └── MessageInput/
│   │       ├── index.tsx
│   │       ├── EmojiPicker.tsx
│   │       └── styles.module.css
│   │
│   ├── hooks/
│   │   ├── useAuth.ts         # Auth state, login, register
│   │   ├── useChat.ts         # Chat state, messages
│   │   ├── useWebSocket.ts    # WebSocket connection
│   │   ├── useConversations.ts # Load conversation list
│   │   ├── useContactSync.ts  # Contact sync
│   │   └── usePushNotifications.ts # FCM setup
│   │
│   ├── api/
│   │   ├── axiosClient.ts     # Configured axios instance
│   │   ├── authApi.ts         # /auth endpoints
│   │   ├── chatApi.ts         # /messages & /conversations
│   │   ├── userApi.ts         # /users endpoints
│   │   ├── storageApi.ts      # /media endpoints
│   │   └── aiApi.ts           # /ai endpoints
│   │
│   ├── store/
│   │   ├── store.ts           # Redux store setup
│   │   ├── authSlice.ts       # Auth reducer
│   │   ├── chatSlice.ts       # Messages & conversations
│   │   ├── uiSlice.ts         # UI state (modals, notifications)
│   │   └── types.ts           # Type definitions
│   │
│   ├── utils/
│   │   ├── socket.ts          # WebSocket initialization
│   │   ├── storage.ts         # LocalStorage helpers
│   │   ├── dateFormatter.ts
│   │   ├── validators.ts
│   │   └── constants.ts
│   │
│   ├── types/
│   │   ├── api.ts             # API response types
│   │   ├── models.ts          # Domain types
│   │   └── state.ts           # Redux state types
│   │
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
│
├── vite.config.ts
├── tsconfig.json
├── package.json
└── .env.example
```

---

## 📱 Mobile Frontend Structure (React Native)

```
mobile/
├── app.json
├── babel.config.js
├── package.json
├── expo-env.d.ts
│
├── app/
│   ├── _layout.jsx            # Root navigator layout
│   ├── (auth)/
│   │   ├── login.jsx
│   │   ├── register.jsx
│   │   ├── verifyOtp.jsx
│   │   └── _layout.jsx        # Auth stack navigator
│   │
│   ├── (main)/
│   │   ├── _layout.jsx        # Main tabs navigator
│   │   ├── index.jsx          # Chat list screen
│   │   ├── profile.jsx        # Profile screen
│   │   ├── story.jsx          # Stories screen
│   │   ├── chat/
│   │   │   ├── [id].jsx       # Individual chat screen
│   │   │   └── _layout.jsx
│   │   └── settings.jsx       # Settings screen
│   │
│   └── +not-found.jsx
│
├── assets/
│   ├── fonts/
│   ├── images/
│   └── icons/
│
├── src/
│   ├── components/
│   │   ├── ChatBubble.jsx
│   │   ├── ConversationItem.jsx
│   │   ├── MessageInput.jsx
│   │   ├── TypingIndicator.jsx
│   │   ├── common/
│   │   │   ├── Avatar.jsx
│   │   │   ├── Button.jsx
│   │   │   ├── Input.jsx
│   │   │   ├── Modal.jsx
│   │   │   └── Loader.jsx
│   │   └── Sidebar.jsx
│   │
│   ├── hooks/
│   │   ├── useAuth.js
│   │   ├── useChat.js
│   │   ├── useWebSocket.js
│   │   ├── useConversations.js
│   │   └── useContactSync.js
│   │
│   ├── api/
│   │   ├── axiosClient.js
│   │   ├── authApi.js
│   │   ├── chatApi.js
│   │   ├── userApi.js
│   │   └── storageApi.js
│   │
│   ├── store/
│   │   ├── store.js
│   │   ├── authSlice.js
│   │   ├── chatSlice.js
│   │   └── uiSlice.js
│   │
│   ├── utils/
│   │   ├── socket.js
│   │   ├── storage.js
│   │   ├── validators.js
│   │   └── constants.js
│   │
│   └── types/
│       ├── api.ts
│       └── models.ts
│
└── eas.json                   # Expo config
```

---

## 🔌 API Integration

### Axios Client Setup
```typescript
// src/api/axiosClient.ts (Web)
import axios from 'axios';
import { store } from '../store/store';

const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8080',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
axiosClient.interceptors.request.use((config) => {
  const auth = store.getState().auth;
  if (auth.accessToken) {
    config.headers.Authorization = `Bearer ${auth.accessToken}`;
  }
  return config;
});

// Handle token refresh
axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Refresh token or logout
      store.dispatch(logout());
    }
    return Promise.reject(error);
  }
);

export default axiosClient;
```

### Auth API
```typescript
// src/api/authApi.ts
import axiosClient from './axiosClient';

export const authApi = {
  register: (data) => axiosClient.post('/api/v1/auth/register', data),
  login: (data) => axiosClient.post('/api/v1/auth/login', data),
  verifyOtp: (data) => axiosClient.post('/api/v1/auth/verify-otp', data),
  refresh: (data) => axiosClient.post('/api/v1/auth/refresh', data),
  logout: () => axiosClient.post('/api/v1/auth/logout'),
  changePassword: (data) => axiosClient.post('/api/v1/auth/change-password', data),
};
```

---

## 🔗 WebSocket Integration

### Socket.io Client
```typescript
// src/utils/socket.ts (Web)
import io from 'socket.io-client';
import { store } from '../store/store';

let socket = null;

export const initializeSocket = (token) => {
  socket = io(import.meta.env.VITE_WS_URL || 'http://localhost:8080', {
    auth: { token },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
  });

  // Listen for messages
  socket.on('message', (data) => {
    store.dispatch(addMessage(data));
  });

  // Listen for typing indicators
  socket.on('typing', (data) => {
    store.dispatch(setTypingUsers(data));
  });

  // Listen for read receipts
  socket.on('read-receipt', (data) => {
    store.dispatch(updateMessageStatus(data));
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected');
  });

  return socket;
};

export const sendMessage = (messageData) => {
  socket?.emit('send-message', messageData);
};

export const sendTyping = (conversationId) => {
  socket?.emit('typing', { conversationId });
};

export const disconnectSocket = () => {
  socket?.disconnect();
};
```

---

## 🎯 Redux State Management

### Auth Slice
```typescript
// src/store/authSlice.ts
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { authApi } from '../api/authApi';

export const login = createAsyncThunk(
  'auth/login',
  async (credentials, { rejectWithValue }) => {
    try {
      const response = await authApi.login(credentials);
      localStorage.setItem('accessToken', response.data.accessToken);
      localStorage.setItem('refreshToken', response.data.refreshToken);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message);
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    accessToken: localStorage.getItem('accessToken'),
    refreshToken: localStorage.getItem('refreshToken'),
    isLoading: false,
    error: null,
  },
  reducers: {
    logout: (state) => {
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload;
        state.accessToken = action.payload.accessToken;
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

export const { logout } = auth Slice.actions;
export default authSlice.reducer;
```

### Chat Slice
```typescript
// src/store/chatSlice.ts
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { chatApi } from '../api/chatApi';

export const fetchConversations = createAsyncThunk(
  'chat/fetchConversations',
  async (_, { rejectWithValue }) => {
    try {
      const response = await chatApi.getConversations();
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data);
    }
  }
);

const chatSlice = createSlice({
  name: 'chat',
  initialState: {
    conversations: [],
    messages: {},
    selectedConversation: null,
    typingUsers: {},
    isLoading: false,
  },
  reducers: {
    addMessage: (state, action) => {
      const { conversationId, message } = action.payload;
      if (!state.messages[conversationId]) {
        state.messages[conversationId] = [];
      }
      state.messages[conversationId].push(message);
    },
    updateMessageStatus: (state, action) => {
      const { messageId, status } = action.payload;
      // Update message status in all conversations
      Object.keys(state.messages).forEach((convId) => {
        const msgIndex = state.messages[convId].findIndex((m) => m.messageId === messageId);
        if (msgIndex !== -1) {
          state.messages[convId][msgIndex].status = status;
        }
      });
    },
    setTypingUsers: (state, action) => {
      state.typingUsers = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchConversations.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchConversations.fulfilled, (state, action) => {
        state.isLoading = false;
        state.conversations = action.payload;
      });
  },
});

export const { addMessage, updateMessageStatus, setTypingUsers } = chatSlice.actions;
export default chatSlice.reducer;
```

---

## 🪝 Custom Hooks

### useAuth Hook
```typescript
// src/hooks/useAuth.ts
import { useDispatch, useSelector } from 'react-redux';
import { login, logout, register } from '../store/authSlice';
import { RootState } from '../store/store';

export const useAuth = () => {
  const dispatch = useDispatch();
  const auth = useSelector((state: RootState) => state.auth);

  return {
    user: auth.user,
    isLoading: auth.isLoading,
    error: auth.error,
    isAuthenticated: !!auth.accessToken,
    
    login: async (credentials) => {
      await dispatch(login(credentials));
    },
    
    logout: () => {
      dispatch(logout());
    },
  };
};
```

### useChat Hook
```typescript
// src/hooks/useChat.ts
import { useDispatch, useSelector } from 'react-redux';
import { useEffect } from 'react';
import { chatApi } from '../api/chatApi';
import { addMessage } from '../store/chatSlice';

export const useChat = (conversationId) => {
  const dispatch = useDispatch();
  const chat = useSelector((state) => state.chat);

  useEffect(() => {
    // Load initial messages
    if (conversationId) {
      chatApi.getMessages(conversationId).then((res) => {
        // Dispatch messages to store
      });
    }
  }, [conversationId]);

  const sendMessage = async (content) => {
    const response = await chatApi.sendMessage({
      conversationId,
      content,
    });
    dispatch(addMessage({ conversationId, message: response.data }));
  };

  return {
    messages: chat.messages[conversationId] || [],
    sendMessage,
  };
};
```

---

## 🚀 Running Frontend

### Web Development
```bash
cd web
npm install
npm run dev  # Runs on :5173
```

### Web Build
```bash
npm run build      # Build for production
npm run preview    # Preview production build
```

### Mobile Development
```bash
cd mobile
npm install
npx expo start
# Press 'w' for web, 'i' for iOS simulator, 'a' for Android emulator
```

### Mobile Build
```bash
eas build --platform ios
eas build --platform android
```

---

## 📊 Frontend Performance Optimization

### Code Splitting (Vite)
```typescript
// Use dynamic imports
const Chat = lazy(() => import('./pages/Chat'));
const Profile = lazy(() => import('./pages/Profile'));
```

### Virtual Scrolling (Message List)
```typescript
import { FixedSizeList as List } from 'react-window';

<List
  height={600}
  itemCount={messages.length}
  itemSize={80}
  width="100%"
>
  {({ index, style }) => (
    <MessageItem message={messages[index]} style={style} />
  )}
</List>
```

### Lazy Loading Images
```typescript
<img
  loading="lazy"
  src={avatarUrl}
  alt="User"
/>
```

---

## 🧪 Testing Frontend

### React Testing Library
```typescript
// Example test
import { render, screen } from '@testing-library/react';
import { LoginPage } from './LoginPage';

test('renders login form', () => {
  render(<LoginPage />);
  expect(screen.getByPlaceholderText(/phone number/i)).toBeInTheDocument();
});
```

### E2E Testing (Cypress)
```javascript
// cypress/e2e/chat.cy.js
describe('Chat Application', () => {
  it('should login and send message', () => {
    cy.visit('http://localhost:3000/login');
    cy.get('[data-testid="phone-input"]').type('+84912345678');
    cy.get('[data-testid="password-input"]').type('password123');
    cy.get('[data-testid="login-button"]').click();
    cy.url().should('include', '/chat');
  });
});
```

---

## 📦 Dependencies

### Web Frontend
```json
{
  "devDependencies": {
    "@types/react": "^18.0.0",
    "typescript": "^5.0.0",
    "vite": "^4.0.0"
  },
  "dependencies": {
    "react": "^18.0.0",
    "redux": "^4.2.0",
    "@reduxjs/toolkit": "^1.9.0",
    "axios": "^1.4.0",
    "socket.io-client": "^4.5.0"
  }
}
```

---

## 📚 Next Steps

1. Complete all module implementations
2. Add more UI components
3. Implement error handling & logging
4. Add analytics tracking
5. Optimize performance
6. Add comprehensive testing
7. Deploy to production

**Frontend development follows the backend core API structure completely, ensuring synchronization at all times.**
