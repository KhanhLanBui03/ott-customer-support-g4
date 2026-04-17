# Frontend-Backend API Integration Contract

## Overview
This document defines the API contract between the Frontend (Web & Mobile) and Backend (Spring Boot) services for the Chat Application.

---

## Base Configuration

### Backend Server
```
Protocol: HTTP/HTTPS
Host: localhost (dev) | api.chatapp.com (prod)
Port: 8080
Base Path: /api/v1
```

### WebSocket Server
```
Protocol: WS/WSS
Host: localhost (dev) | api.chatapp.com (prod)
Port: 8080
Base Path: /ws
```

### CORS Configuration
- Origins: `http://localhost:5173` (web dev), `http://localhost:3000` (web prod)
- Methods: GET, POST, PUT, DELETE, OPTIONS
- Headers: Authorization, Content-Type
- Credentials: true (for cookies if applicable)

---

## Authentication APIs

### 1. Register User
**Endpoint**: `POST /auth/register`

**Request**:
```json
{
  "phoneNumber": "+1234567890",
  "password": "SecurePassword123!",
  "confirmPassword": "SecurePassword123!"
}
```

**Response (201 Created)**:
```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "userId": "uuid-here",
    "phoneNumber": "+1234567890",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

**Error Response (400 Bad Request)**:
```json
{
  "success": false,
  "message": "Phone number already registered",
  "error": "PHONE_NUMBER_EXIST"
}
```

### 2. Login User
**Endpoint**: `POST /auth/login`

**Request**:
```json
{
  "phoneNumber": "+1234567890",
  "password": "SecurePassword123!",
  "deviceId": "device-uuid-or-identifier"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "userId": "uuid-here",
      "phoneNumber": "+1234567890",
      "name": "John Doe",
      "avatar": "https://cdn.example.com/avatars/uuid.jpg",
      "status": "online",
      "lastSeen": "2024-01-15T10:30:00Z"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": 3600
    }
  }
}
```

**Error Response**:
```json
{
  "success": false,
  "message": "Invalid credentials",
  "error": "INVALID_CREDENTIALS"
}
```

### 3. Verify OTP (Post-Registration)
**Endpoint**: `POST /auth/verify-otp`

**Request**:
```json
{
  "phoneNumber": "+1234567890",
  "otp": "123456"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "message": "OTP verified",
  "data": {
    "user": {
      "userId": "uuid-here",
      "phoneNumber": "+1234567890",
      "name": null,
      "avatar": null,
      "status": "offline"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": 3600
    }
  }
}
```

**Error Response**:
```json
{
  "success": false,
  "message": "Invalid or expired OTP",
  "error": "INVALID_OTP"
}
```

### 4. Refresh Token
**Endpoint**: `POST /auth/refresh-token`

**Headers**:
```
Authorization: Bearer {refreshToken}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "message": "Token refreshed",
  "data": {
    "accessToken": "new-jwt-token...",
    "refreshToken": "new-refresh-token...",
    "expiresIn": 3600
  }
}
```

### 5. Logout
**Endpoint**: `POST /auth/logout`

**Headers**:
```
Authorization: Bearer {accessToken}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### 6. Change Password
**Endpoint**: `PUT /auth/change-password`

**Headers**:
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Request**:
```json
{
  "oldPassword": "CurrentPassword123!",
  "newPassword": "NewPassword456!",
  "confirmPassword": "NewPassword456!"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

---

## User APIs

### 1. Get Current User
**Endpoint**: `GET /users/me`

**Headers**:
```
Authorization: Bearer {accessToken}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "userId": "uuid-here",
    "phoneNumber": "+1234567890",
    "name": "John Doe",
    "email": "john@example.com",
    "avatar": "https://cdn.example.com/avatars/uuid.jpg",
    "bio": "Passionate developer",
    "status": "online",
    "lastSeen": "2024-01-15T10:30:00Z",
    "publicKey": "-----BEGIN PUBLIC KEY-----...",
    "createdAt": "2024-01-10T08:00:00Z"
  }
}
```

### 2. Update Profile
**Endpoint**: `PUT /users/me`

**Headers**:
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Request**:
```json
{
  "name": "John Updated",
  "bio": "Updated bio",
  "email": "newemail@example.com"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "message": "Profile updated",
  "data": {
    "userId": "uuid-here",
    "name": "John Updated",
    "bio": "Updated bio",
    "email": "newemail@example.com"
  }
}
```

### 3. Upload Avatar
**Endpoint**: `PUT /users/me/avatar`

**Headers**:
```
Authorization: Bearer {accessToken}
Content-Type: multipart/form-data
```

**Request**:
```
Body: FormData with 'avatar' file
```

**Response (200 OK)**:
```json
{
  "success": true,
  "message": "Avatar uploaded",
  "data": {
    "avatar": "https://cdn.example.com/avatars/new-uuid.jpg"
  }
}
```

### 4. Search Users
**Endpoint**: `GET /users/search?q={query}`

**Headers**:
```
Authorization: Bearer {accessToken}
```

**Query Parameters**:
- `q` (required): Search query (min 2 chars)
- `limit` (optional): Max results (default 20)
- `offset` (optional): Pagination offset (default 0)

**Response (200 OK)**:
```json
{
  "success": true,
  "data": [
    {
      "userId": "uuid-1",
      "phoneNumber": "+1111111111",
      "name": "John Smith",
      "avatar": "https://cdn.example.com/avatars/uuid-1.jpg",
      "status": "online"
    },
    {
      "userId": "uuid-2",
      "phoneNumber": "+2222222222",
      "name": "John Doe",
      "avatar": "https://cdn.example.com/avatars/uuid-2.jpg",
      "status": "offline"
    }
  ],
  "pagination": {
    "total": 2,
    "limit": 20,
    "offset": 0
  }
}
```

### 5. Get User Profile
**Endpoint**: `GET /users/{userId}`

**Headers**:
```
Authorization: Bearer {accessToken}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "userId": "uuid-here",
    "phoneNumber": "+1234567890",
    "name": "John Doe",
    "avatar": "https://cdn.example.com/avatars/uuid.jpg",
    "bio": "Passionate developer",
    "status": "online",
    "lastSeen": "2024-01-15T10:30:00Z",
    "createdAt": "2024-01-10T08:00:00Z"
  }
}
```

### 6. Get User Status
**Endpoint**: `GET /users/{userId}/status`

**Headers**:
```
Authorization: Bearer {accessToken}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "userId": "uuid-here",
    "status": "online",
    "lastSeen": "2024-01-15T10:30:00Z"
  }
}
```

### 7. Set User Status
**Endpoint**: `PUT /users/me/status`

**Headers**:
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Request**:
```json
{
  "status": "online" // or "offline" | "away" | "busy"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "message": "Status updated",
  "data": {
    "status": "online"
  }
}
```

---

## Conversation APIs

### 1. Get All Conversations
**Endpoint**: `GET /conversations?limit=50&offset=0`

**Headers**:
```
Authorization: Bearer {accessToken}
```

**Query Parameters**:
- `limit`: Number of conversations (default 50)
- `offset`: Pagination offset (default 0)
- `search`: Optional search query

**Response (200 OK)**:
```json
{
  "success": true,
  "data": [
    {
      "conversationId": "conv-uuid-1",
      "name": "John Doe",
      "avatar": "https://cdn.example.com/avatars/uuid.jpg",
      "isGroup": false,
      "participantIds": ["uuid-user-2"],
      "participantCount": 2,
      "lastMessage": "Hey, how are you?",
      "lastMessageAt": "2024-01-15T10:30:00Z",
      "lastMessageSenderId": "uuid-user-2",
      "unreadCount": 2,
      "createdAt": "2024-01-10T08:00:00Z"
    },
    {
      "conversationId": "conv-uuid-2",
      "name": "Friends Group",
      "avatar": null,
      "isGroup": true,
      "participantIds": ["uuid-user-2", "uuid-user-3", "uuid-user-4"],
      "participantCount": 4,
      "lastMessage": "See you tomorrow!",
      "lastMessageAt": "2024-01-15T09:15:00Z",
      "lastMessageSenderId": "uuid-user-3",
      "unreadCount": 0,
      "createdAt": "2024-01-05T12:00:00Z"
    }
  ],
  "pagination": {
    "total": 15,
    "limit": 50,
    "offset": 0
  }
}
```

### 2. Create Conversation
**Endpoint**: `POST /conversations`

**Headers**:
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Request**:
```json
{
  "participantIds": ["uuid-user-2", "uuid-user-3"],
  "name": "Friends Group",
  "isGroup": true
}
```

**For 1-on-1 Conversation**:
```json
{
  "participantIds": ["uuid-user-2"],
  "isGroup": false
}
```

**Response (201 Created)**:
```json
{
  "success": true,
  "message": "Conversation created",
  "data": {
    "conversationId": "new-conv-uuid",
    "name": "Friends Group",
    "avatar": null,
    "isGroup": true,
    "participantIds": ["uuid-current-user", "uuid-user-2", "uuid-user-3"],
    "participantCount": 3,
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

### 3. Update Conversation
**Endpoint**: `PUT /conversations/{conversationId}`

**Headers**:
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Request**:
```json
{
  "name": "Updated Group Name",
  "avatar": "https://cdn.example.com/avatars/new-avatar.jpg"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "message": "Conversation updated",
  "data": {
    "conversationId": "conv-uuid",
    "name": "Updated Group Name",
    "avatar": "https://cdn.example.com/avatars/new-avatar.jpg"
  }
}
```

### 4. Delete Conversation
**Endpoint**: `DELETE /conversations/{conversationId}`

**Headers**:
```
Authorization: Bearer {accessToken}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "message": "Conversation deleted"
}
```

### 5. Add Participant to Group
**Endpoint**: `POST /conversations/{conversationId}/participants`

**Headers**:
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Request**:
```json
{
  "participantIds": ["uuid-user-5", "uuid-user-6"]
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "message": "Participants added",
  "data": {
    "participantIds": ["uuid-user-1", "uuid-user-2", "uuid-user-3", "uuid-user-5", "uuid-user-6"],
    "participantCount": 5
  }
}
```

### 6. Remove Participant from Group
**Endpoint**: `DELETE /conversations/{conversationId}/participants/{participantId}`

**Headers**:
```
Authorization: Bearer {accessToken}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "message": "Participant removed",
  "data": {
    "participantIds": ["uuid-user-1", "uuid-user-2", "uuid-user-3"],
    "participantCount": 3
  }
}
```

---

## Message APIs

### 1. Get Messages
**Endpoint**: `GET /conversations/{conversationId}/messages?limit=50&fromMessageId={messageId}`

**Headers**:
```
Authorization: Bearer {accessToken}
```

**Query Parameters**:
- `limit`: Number of messages (default 50)
- `fromMessageId`: Message ID to fetch from (for pagination)
- `direction`: "before" or "after" (default "before")

**Response (200 OK)**:
```json
{
  "success": true,
  "data": [
    {
      "messageId": "msg-uuid-1",
      "conversationId": "conv-uuid",
      "senderId": "uuid-user-2",
      "senderName": "John Doe",
      "senderAvatar": "https://cdn.example.com/avatars/uuid-user-2.jpg",
      "content": "Hey, how are you?",
      "type": "TEXT",
      "mediaUrls": [],
      "reactions": {
        "😀": ["uuid-user-1", "uuid-user-3"],
        "👍": ["uuid-user-1"]
      },
      "readReceipts": [
        {
          "userId": "uuid-user-1",
          "readAt": "2024-01-15T10:31:00Z"
        }
      ],
      "editedAt": null,
      "deletedAt": null,
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 250,
    "hasMore": true
  }
}
```

### 2. Send Message
**Endpoint**: `POST /messages/send`

**Headers**:
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Request**:
```json
{
  "conversationId": "conv-uuid",
  "content": "Hello everyone!",
  "type": "TEXT",
  "mediaUrls": []
}
```

**With Media**:
```json
{
  "conversationId": "conv-uuid",
  "content": "Check out this photo",
  "type": "IMAGE",
  "mediaUrls": ["https://cdn.example.com/media/image-uuid.jpg"]
}
```

**Response (201 Created)**:
```json
{
  "success": true,
  "message": "Message sent",
  "data": {
    "messageId": "msg-new-uuid",
    "conversationId": "conv-uuid",
    "senderId": "current-user-uuid",
    "content": "Hello everyone!",
    "type": "TEXT",
    "mediaUrls": [],
    "reactions": {},
    "readReceipts": [],
    "createdAt": "2024-01-15T10:35:00Z"
  }
}
```

### 3. Edit Message
**Endpoint**: `PUT /messages/{messageId}`

**Headers**:
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Request**:
```json
{
  "content": "Updated message content"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "message": "Message updated",
  "data": {
    "messageId": "msg-uuid",
    "content": "Updated message content",
    "editedAt": "2024-01-15T10:36:00Z"
  }
}
```

### 4. Delete Message
**Endpoint**: `DELETE /messages/{messageId}`

**Headers**:
```
Authorization: Bearer {accessToken}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "message": "Message deleted"
}
```

### 5. Recall Message (Replace with "This message was recalled")
**Endpoint**: `POST /messages/{messageId}/recall`

**Headers**:
```
Authorization: Bearer {accessToken}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "message": "Message recalled",
  "data": {
    "messageId": "msg-uuid",
    "content": "This message was recalled",
    "recalledAt": "2024-01-15T10:37:00Z"
  }
}
```

### 6. Add Reaction
**Endpoint**: `POST /messages/{messageId}/reactions`

**Headers**:
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Request**:
```json
{
  "emoji": "😀"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "message": "Reaction added",
  "data": {
    "messageId": "msg-uuid",
    "reactions": {
      "😀": ["uuid-user-1", "uuid-current-user"],
      "👍": ["uuid-user-2"]
    }
  }
}
```

### 7. Remove Reaction
**Endpoint**: `DELETE /messages/{messageId}/reactions?emoji={emoji}`

**Headers**:
```
Authorization: Bearer {accessToken}
```

**Query Parameters**:
- `emoji`: Emoji to remove

**Response (200 OK)**:
```json
{
  "success": true,
  "message": "Reaction removed",
  "data": {
    "messageId": "msg-uuid",
    "reactions": {
      "😀": ["uuid-user-1"],
      "👍": ["uuid-user-2"]
    }
  }
}
```

### 8. Mark Messages as Read
**Endpoint**: `POST /messages/read-receipt`

**Headers**:
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Request**:
```json
{
  "conversationId": "conv-uuid",
  "messageIds": ["msg-uuid-1", "msg-uuid-2"]
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "message": "Read receipts recorded"
}
```

---

## Media APIs

### 1. Upload File/Media
**Endpoint**: `POST /media/upload`

**Headers**:
```
Authorization: Bearer {accessToken}
Content-Type: multipart/form-data
```

**Request**:
```
Body: FormData with 'file' field
Optional fields:
- conversationId: To associate with conversation
- isPublic: boolean (default false)
```

**Response (201 Created)**:
```json
{
  "success": true,
  "message": "File uploaded",
  "data": {
    "mediaId": "media-uuid",
    "url": "https://s3.example.com/media/media-uuid.jpg",
    "type": "IMAGE",
    "fileName": "photo.jpg",
    "size": 1024000,
    "uploadedAt": "2024-01-15T10:40:00Z"
  }
}
```

### 2. Get Presigned URL
**Endpoint**: `GET /media/{mediaId}/presigned-url`

**Headers**:
```
Authorization: Bearer {accessToken}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "url": "https://s3.example.com/media/media-uuid.jpg?Expires=...",
    "expiresIn": 3600
  }
}
```

### 3. Download Media
**Endpoint**: `GET /media/{mediaId}/download`

**Headers**:
```
Authorization: Bearer {accessToken}
```

**Response**: File download

### 4. Delete Media
**Endpoint**: `DELETE /media/{mediaId}`

**Headers**:
```
Authorization: Bearer {accessToken}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "message": "Media deleted"
}
```

---

## WebSocket Events

### Connection
```
URL: ws://localhost:8080/ws
Headers: Authorization: Bearer {accessToken}
```

### Server-to-Client Events

#### Message Received
```javascript
socket.on('message:received', (data) => {
  // {
  //   messageId: string,
  //   conversationId: string,
  //   senderId: string,
  //   senderName: string,
  //   content: string,
  //   type: string,
  //   mediaUrls: string[],
  //   createdAt: timestamp,
  //   readReceipts: []
  // }
});
```

#### Message Edited
```javascript
socket.on('message:edited', (data) => {
  // {
  //   messageId: string,
  //   content: string,
  //   editedAt: timestamp
  // }
});
```

#### Message Deleted
```javascript
socket.on('message:deleted', (data) => {
  // {
  //   messageId: string,
  //   conversationId: string
  // }
});
```

#### Reaction Added
```javascript
socket.on('message:reaction', (data) => {
  // {
  //   messageId: string,
  //   emoji: string,
  //   userId: string,
  //   action: "add" | "remove"
  // }
});
```

#### Typing Indicator
```javascript
socket.on('typing:indicator', (data) => {
  // {
  //   conversationId: string,
  //   userId: string,
  //   isTyping: boolean
  // }
});
```

#### Read Receipt
```javascript
socket.on('message:read', (data) => {
  // {
  //   conversationId: string,
  //   messageId: string,
  //   userId: string,
  //   readAt: timestamp
  // }
});
```

#### User Online Status
```javascript
socket.on('user:status', (data) => {
  // {
  //   userId: string,
  //   status: "online" | "offline" | "away" | "busy",
  //   lastSeen: timestamp
  // }
});
```

### Client-to-Server Events

#### Subscribe to Conversation
```javascript
socket.emit('conversation:subscribe', {
  conversationId: string
});
```

#### Typing Start
```javascript
socket.emit('typing:start', {
  conversationId: string
});
```

#### Typing Stop
```javascript
socket.emit('typing:stop', {
  conversationId: string
});
```

#### Mark as Read
```javascript
socket.emit('message:read', {
  conversationId: string,
  messageIds: string[]
});
```

---

## Error Handling

### Common Error Codes

| Status | Error Code | Message |
|--------|-----------|---------|
| 400 | INVALID_REQUEST | Invalid request parameters |
| 400 | VALIDATION_ERROR | Validation failed |
| 401 | UNAUTHORIZED | No/invalid authentication |
| 401 | TOKEN_EXPIRED | Access token expired |
| 403 | FORBIDDEN | No permission for this action |
| 404 | NOT_FOUND | Resource not found |
| 409 | CONFLICT | Resource already exists |
| 429 | RATE_LIMITED | Too many requests |
| 500 | SERVER_ERROR | Internal server error |

### Error Response Format
```json
{
  "success": false,
  "message": "User-friendly error message",
  "error": "ERROR_CODE",
  "timestamp": "2024-01-15T10:30:00Z",
  "path": "/api/v1/auth/login"
}
```

---

## Frontend Request/Response Handling

### Request Interceptor (axiosClient)
1. Add Authorization header with access token
2. Set Content-Type based on data type
3. Log request (dev only)

### Response Interceptor
1. Check response status
2. If 401: Refresh token and retry
3. If error: Format error message
4. Extract `data` from response wrapper
5. Return data or throw error

### WebSocket Connection
1. Connect with auth token
2. Subscribe to conversation on selection
3. Listen to events and dispatch Redux actions
4. Emit typing status
5. Clean up on unmount

---

## Rate Limiting

- **Requests**: 100 requests/minute per user
- **WebSocket**: 10 events/second per connection
- **File Upload**: 5 files/minute, 100MB max per file

---

## Monitoring & Logging

### Frontend Logs
- API requests/responses (dev only)
- Redux state changes (dev only)
- WebSocket events
- Errors and exceptions

### Backend Logs
- All API calls
- Authentication attempts
- Database queries
- WebSocket connections/disconnections
- Errors with stack traces

---

## Versioning & Migration

**API Version**: v1 (Current)  
**Breaking Changes**: Will increment version (v2, etc.)  
**Deprecation Policy**: Version will be supported for 6 months before removal

---

**Last Updated**: Current session  
**Status**: Ready for Implementation  
**Maintainer**: Development Team
