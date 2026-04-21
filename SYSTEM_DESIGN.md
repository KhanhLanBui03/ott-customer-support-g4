# Chat Application - Modular Monolith Architecture Design

## 📋 Table of Contents
1. [System Architecture](#system-architecture)
2. [Module Structure](#module-structure)
3. [Database Schema](#database-schema)
4. [API Endpoints](#api-endpoints)
5. [Security Implementation](#security-implementation)
6. [Scaling Strategy](#scaling-strategy)

---

## 🏗️ System Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENTS                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Web App    │  │ Mobile App   │  │  3rd Party   │          │
│  │  (React-TS)  │  │(React Native)│  │  (API)       │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└────────────────────┬───────────────────────┬────────────────────┘
                     │ HTTPS/WebSocket       │
                     ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│              Spring Boot Application (Port 8080)                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         Spring Security + JWT Auth                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─────────────┬────────────┬──────────┬───────────────────┐   │
│  │  Auth       │  User      │  Chat    │  Message          │   │
│  │  Module     │  Module    │  Module  │  Module (CQRS)    │   │
│  └─────────────┴────────────┴──────────┴───────────────────┘   │
│  ┌─────────────┬────────────┬──────────┬───────────────────┐   │
│  │  Notif      │  Media     │  AI      │  Story            │   │
│  │  Module     │  Module    │  Module  │  Module           │   │
│  └─────────────┴────────────┴──────────┴───────────────────┘   │
│  ┌─────────────┬────────────┬──────────┬───────────────────┐   │
│  │  Group      │  Contact   │  E2E     │  Event Bus        │   │
│  │  Module     │  Module    │  Encrypt │  (Spring Events)  │   │
│  └─────────────┴────────────┴──────────┴───────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         WebSocket Handler (STOMP)                        │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
    ┌─────────┐          ┌──────────┐       ┌──────────┐
    │DynamoDB │          │  Redis   │       │  AWS S3  │
    │(Primary)│          │ (Cache)  │       │(Storage) │
    └─────────┘          └──────────┘       └──────────┘
         │
         ▼
    ┌──────────┐
    │ Firebase │
    │   FCM    │
    │(Push)    │
    └──────────┘
```

### Technology Stack
| Layer | Technology | Version |
|-------|-----------|---------|
| Backend | Spring Boot | 3.2.0 |
| Language | Java | 17 |
| Database | DynamoDB | Latest |
| Cache | Redis | 7.x |
| WebSocket | Spring WebSocket + STOMP | 3.2.0 |
| Storage | AWS S3 | Latest |
| Notifications | Firebase FCM | Latest |
| Auth | JWT (jjwt) | 0.12.3 |
| frontend Web | React + TypeScript | 18+ |
| Frontend Mobile | React Native (Expo) | Latest |

---

## 📦 Module Structure

### Monolith Module Breakdown

d
src/main/java/com/chatapp/
├── ChatAppApplication.java
├── config/                          # Shared configurations
│   ├── DynamoDBConfig.java
│   ├── RedisConfig.java
│   ├── SecurityConfig.java
│   ├── WebSocketConfig.java
│   ├── S3Config.java
│   └── FirebaseConfig.java
│
├── common/                          # Shared utilities & constants
│   ├── exception/
│   │   ├── GlobalExceptionHandler.java
│   │   ├── BaseException.java
│   │   ├── NotFoundException.java
│   │   ├── UnauthorizedException.java
│   │   ├── ValidationException.java
│   │   └── ConflictException.java
│   ├── dto/
│   │   ├── ApiResponse.java
│   │   ├── PageDTO.java
│   │   └── ErrorDTO.java
│   ├── util/
│   │   ├── JwtUtil.java
│   │   ├── HashUtil.java
│   │   ├── FileUtil.java
│   │   ├── DateUtil.java
│   │   └── ValidationUtil.java
│   ├── constants/
│   │   ├── AppConstants.java
│   │   ├── MessageConstants.java
│   │   └── ErrorMessages.java
│   └── aspect/
│       ├── LoggingAspect.java
│       ├── PerformanceAspect.java
│       └── ValidationAspect.java
│
├── modules/
│   ├── auth/                      # AUTH MODULE
│   │   ├── controller/
│   │   │   └── AuthController.java
│   │   ├── service/
│   │   │   ├── AuthService.java
│   │   │   ├── JwtTokenService.java
│   │   │   └── OtpService.java
│   │   ├── repository/
│   │   │   ├── UserRepository.java
│   │   │   ├── OtpRepository.java
│   │   │   └── SessionRepository.java
│   │   ├── domain/
│   │   │   └── User.java
│   │   ├── dto/
│   │   │   ├── request/
│   │   │   │   ├── LoginRequest.java
│   │   │   │   ├── RegisterRequest.java
│   │   │   │   ├── RefreshTokenRequest.java
│   │   │   │   └── VerifyOtpRequest.java
│   │   │   └── response/
│   │   │       ├── LoginResponse.java
│   │   │       └── TokenResponse.java
│   │   ├── event/
│   │   │   └── UserLoginEvent.java
│   │   └── config/
│   │       └── AuthConfig.java
│   │
│   ├── user/                      # USER MODULE
│   │   ├── controller/
│   │   │   └── UserController.java
│   │   ├── service/
│   │   │   ├── UserService.java
│   │   │   └── UserProfileService.java
│   │   ├── repository/
│   │   │   └── UserProfileRepository.java
│   │   ├── domain/
│   │   │   ├── UserProfile.java
│   │   │   └── UserStatus.java
│   │   └── dto/
│   │       ├── request/
│   │       │   ├── UpdateProfileRequest.java
│   │       │   └── ChangePasswordRequest.java
│   │       └── response/
│   │           └── UserProfileResponse.java
│   │
│   ├── contact/                   # CONTACT MODULE
│   │   ├── controller/
│   │   │   └── ContactController.java
│   │   ├── service/
│   │   │   ├── ContactService.java
│   │   │   ├── ContactSyncService.java
│   │   │   └── FriendSuggestionService.java
│   │   ├── repository/
│   │   │   ├── ContactRepository.java
│   │   │   └── ContactHashRepository.java
│   │   ├── domain/
│   │   │   └── Contact.java
│   │   ├── dto/
│   │   │   ├── request/
│   │   │   │   ├── SyncContactRequest.java
│   │   │   │   └── AddContactRequest.java
│   │   │   └── response/
│   │   │       ├── SyncContactResponse.java
│   │   │       └── FriendSuggestionResponse.java
│   │   └── event/
│   │       └── ContactSyncedEvent.java
│   │
│   ├── conversation/              # CHAT & CONVERSATION MODULE
│   │   ├── controller/
│   │   │   └── ConversationController.java
│   │   ├── service/
│   │   │   ├── ConversationService.java
│   │   │   ├── GroupService.java
│   │   │   └── ConversationQueryService.java
│   │   ├── repository/
│   │   │   ├── ConversationRepository.java
│   │   │   └── ConversationMemberRepository.java
│   │   ├── domain/
│   │   │   ├── Conversation.java
│   │   │   ├── ConversationType.java
│   │   │   └── ConversationMember.java
│   │   ├── dto/
│   │   │   ├── request/
│   │   │   │   ├── CreateConversationRequest.java
│   │   │   │   ├── CreateGroupRequest.java
│   │   │   │   └── AddMemberRequest.java
│   │   │   └── response/
│   │   │       ├── ConversationResponse.java
│   │   │       └── ConversationListResponse.java
│   │   └── event/
│   │       ├── ConversationCreatedEvent.java
│   │       └── GroupMemberAddedEvent.java
│   │
│   ├── message/                   # MESSAGE MODULE (CQRS)
│   │   ├── command/
│   │   │   ├── SendMessageCommand.java
│   │   │   ├── RecallMessageCommand.java
│   │   │   ├── DeleteMessageCommand.java
│   │   │   └── ForwardMessageCommand.java
│   │   ├── query/
│   │   │   ├── MessageQueryService.java
│   │   │   ├── GetMessageHistoryQuery.java
│   │   │   └── SearchMessagesQuery.java
│   │   ├── controller/
│   │   │   └── MessageController.java
│   │   ├── service/
│   │   │   ├── MessageService.java
│   │   │   ├── MessageCommandHandler.java
│   │   │   ├── MessageQueryHandler.java
│   │   │   └── TypingIndicatorService.java
│   │   ├── repository/
│   │   │   ├── MessageRepository.java
│   │   │   └── MessageReadReceiptRepository.java
│   │   ├── domain/
│   │   │   ├── Message.java
│   │   │   ├── MessageType.java
│   │   │   ├── MessageStatus.java
│   │   │   └── ReadReceipt.java
│   │   ├── dto/
│   │   │   ├── request/
│   │   │   │   ├── SendMessageRequest.java
│   │   │   │   ├── RecallMessageRequest.java
│   │   │   │   └── MarkReadRequest.java
│   │   │   └── response/
│   │   │       ├── MessageResponse.java
│   │   │       └── MessageHistoryResponse.java
│   │   ├── event/
│   │   │   ├── MessageSentEvent.java
│   │   │   ├── MessageRecalledEvent.java
│   │   │   ├── MessageReadEvent.java
│   │   │   └── TypingEvent.java
│   │   └── handler/
│   │       └── MessageEventListener.java
│   │
│   ├── notification/              # NOTIFICATION MODULE
│   │   ├── controller/
│   │   │   └── NotificationController.java
│   │   ├── service/
│   │   │   ├── NotificationService.java
│   │   │   ├── FirebaseService.java
│   │   │   ├── DeviceTokenService.java
│   │   │   └── PushNotificationService.java
│   │   ├── repository/
│   │   │   ├── DeviceTokenRepository.java
│   │   │   └── NotificationRepository.java
│   │   ├── domain/
│   │   │   └── DeviceToken.java
│   │   ├── dto/
│   │   │   ├── request/
│   │   │   │   └── RegisterDeviceTokenRequest.java
│   │   │   └── response/
│   │   │       └── NotificationResponse.java
│   │   └── event/
│   │       └── NotificationEventListener.java
│   │
│   ├── media/                     # MEDIA MODULE (S3)
│   │   ├── controller/
│   │   │   └── MediaController.java
│   │   ├── service/
│   │   │   ├── MediaService.java
│   │   │   ├── S3Service.java
│   │   │   └── PresignedUrlService.java
│   │   ├── domain/
│   │   │   ├── Media.java
│   │   │   └── MediaType.java
│   │   ├── dto/
│   │   │   ├── request/
│   │   │   │   └── UploadMediaRequest.java
│   │   │   └── response/
│   │   │       ├── UploadMediaResponse.java
│   │   │       └── PresignedUrlResponse.java
│   │   └── config/
│   │       └── MediaConfig.java
│   │
│   ├── ai/                        # AI MODULE
│   │   ├── controller/
│   │   │   └── AiChatController.java
│   │   ├── service/
│   │   │   ├── AiChatService.java
│   │   │   ├── OpenAiService.java
│   │   │   ├── AiResponseCacheService.java
│   │   │   └── SuggestReplyService.java
│   │   ├── repository/
│   │   │   └── AiConversationRepository.java
│   │   ├── domain/
│   │   │   └── AiConversation.java
│   │   ├── dto/
│   │   │   ├── request/
│   │   │   │   └── AiChatRequest.java
│   │   │   └── response/
│   │   │       └── AiChatResponse.java
│   │   └── config/
│   │       └── AiConfig.java
│   │
│   ├── story/                     # STORY MODULE (TTL 24h)
│   │   ├── controller/
│   │   │   └── StoryController.java
│   │   ├── service/
│   │   │   ├── StoryService.java
│   │   │   ├── StoryViewService.java
│   │   │   └── StoryPrivacyService.java
│   │   ├── repository/
│   │   │   ├── StoryRepository.java
│   │   │   └── StoryViewerRepository.java
│   │   ├── domain/
│   │   │   ├── Story.java
│   │   │   ├── StoryViewer.java
│   │   │   └── StoryPrivacy.java
│   │   ├── dto/
│   │   │   ├── request/
│   │   │   │   └── CreateStoryRequest.java
│   │   │   └── response/
│   │   │       ├── StoryResponse.java
│   │   │       └── StoryViewerResponse.java
│   │   └── event/
│   │       └── StoryViewedEvent.java
│   │
│   ├── e2e-encryption/            # END-TO-END ENCRYPTION MODULE
│   │   ├── service/
│   │   │   ├── KeyPairService.java
│   │   │   ├── EncryptionService.java
│   │   │   ├── MessageEncryptionService.java
│   │   │   └── KeyExchangeService.java
│   │   ├── repository/
│   │   │   └── PublicKeyRepository.java
│   │   ├── domain/
│   │   │   └── KeyPair.java
│   │   ├── dto/
│   │   │   ├── request/
│   │   │   │   ├── EncryptMessageRequest.java
│   │   │   │   └── GetPublicKeyRequest.java
│   │   │   └── response/
│   │   │       ├── EncryptedMessageResponse.java
│   │   │       └── PublicKeyResponse.java
│   │   └── util/
│   │       ├── RsaUtil.java
│   │       └── AesUtil.java
│   │
│   └── group/                     # GROUP MODULE
│       ├── service/
│       │   ├── GroupService.java
│       │   └── GroupMemberService.java
│       ├── repository/
│       │   └── GroupRepository.java
│       └── domain/
│           └── Group.java
│
├── websocket/                       # WebSocket Handler
│   ├── config/
│   │   └── WebSocketMessageBrokerConfig.java
│   ├── handler/
│   │   ├── ChatWebSocketHandler.java
│   │   ├── TypingIndicatorHandler.java
│   │   └── UserStatusHandler.java
│   ├── message/
│   │   ├── ChatMessage.java
│   │   ├── TypingIndicator.java
│   │   └── UserStatusMessage.java
│   └── listener/
│       ├── ChatMessageListener.java
│       └── SystemEventListener.java
│
└── event/                           # Event Bus
    ├── event/
    │   └── ChatAppEvent.java
    ├── publisher/
    │   └── EventPublisher.java
    └── listener/
        └── EventListener.java
```

---

## 🗄️ Database Schema (DynamoDB)

### Table: Users
```
PK: userId (String)
SK: -
GSI1: PK: phoneNumber, SK: -

Attributes:
{
  userId: string (PK),
  phoneNumber: string (GSI),
  passwordHash: string,
  passwordSalt: string,
  firstName: string,
  lastName: string,
  email: string,
  avatarUrl: string,
  bio: string,
  status: ONLINE|OFFLINE|AWAY,
  lastSeenAt: timestamp,
  isVerified: boolean,
  isActive: boolean,
  createdAt: timestamp,
  updatedAt: timestamp,
  publicKeyRSA: string (E2E),
  loginFailCount: number (Redis backup),
  lockedUntil: timestamp (Redis backup),
  deviceIds: List<string>
}
```

### Table: Sessions
```
PK: sessionId (String)
SK: -
TTL: expirationTime

Attributes:
{
  sessionId: string (PK),
  userId: string (GSI),
  deviceId: string,
  ipAddress: string,
  userAgent: string,
  loginAt: timestamp,
  lastActivityAt: timestamp,
  expirationTime: timestamp (TTL),
  isActive: boolean
}
```

### Table: Conversations
```
PK: conversationId (String)
SK: -
GSI1: PK: ownerId, SK: createdAt (for owner's conversation list)
GSI2: PK: conversationId, SK: memberUserId (for member queries)

Attributes:
{
  conversationId: string (PK),
  type: DIRECT|GROUP,
  ownerId: string (creator),
  name: string (for groups),
  description: string,
  avatarUrl: string,
  members: List<{
    userId: string,
    joinedAt: timestamp,
    role: ADMIN|MEMBER
  }>,
  lastMessageId: string,
  lastMessageAt: timestamp,
  lastMessagePreview: string,
  createdAt: timestamp,
  updatedAt: timestamp,
  isArchived: boolean,
  muteNotification: Set<string> (user IDs)
}
```

### Table: Messages
```
PK: conversationId (String)
SK: messageId (String)
GSI1: PK: senderId, SK: createdAt (user's sent messages)
GSI2: PK: messageId, SK: - (search by messageId)

Attributes:
{
  conversationId: string (PK),
  messageId: string (SK),
  senderId: string,
  senderName: string (denormalized),
  content: string (encrypted if E2E enabled),
  type: TEXT|IMAGE|FILE|VIDEO|AUDIO|STICKER,
  mediaUrls: List<string>,
  status: SENDING|SENT|DELIVERED|READ,
  readBy: List<{
    userId: string,
    readAt: timestamp
  }>,
  editedAt: timestamp,
  editHistory: List<{
    content: string,
    editedAt: timestamp
  }>,
  recalledAt: timestamp,
  isRecalled: boolean,
  forwardedFrom: {
    messageId: string,
    conversationId: string,
    senderName: string
  },
  replyTo: {
    messageId: string,
    content: string,
    senderName: string
  },
  reactions: Map<string, Set<string>> (emoji -> Set of userIds),
  createdAt: timestamp (used for sorting),
  ttl: timestamp (optional, for auto-deletion),
  isEncrypted: boolean
}
```

### Table: OTP
```
PK: phoneNumber (String)
SK: -
TTL: expirationTime

Attributes:
{
  phoneNumber: string (PK),
  otpCode: string,
  attempts: number,
  expirationTime: timestamp (TTL),
  createdAt: timestamp,
  purpose: REGISTRATION|PASSWORD_RESET|ACCOUNT_RECOVERY
}
```

### Table: Contacts (for contact sync)
```
PK: userId (String)
SK: phoneNumberHash (String)
GSI1: PK: phoneNumberHash, SK: userId

Attributes:
{
  userId: string (PK),
  phoneNumberHash: string (SHA-256 hash),
  registeredUserId: string (if exists),
  isFriend: boolean,
  addedAt: timestamp,
  isBlocked: boolean
}
```

### Table: Stories
```
PK: storyId (String)
SK: -
GSI1: PK: userId, SK: createdAt (user's stories)
GSI2: PK: createdAt, SK: - (for timeline)
TTL: expirationTime (24h)

Attributes:
{
  storyId: string (PK),
  userId: string,
  userName: string,
  userAvatarUrl: string,
  mediaUrls: List<string>,
  mediaType: IMAGE|VIDEO,
  caption: string,
  privacy: PUBLIC|FRIENDS|PRIVATE,
  viewers: List<{
    userId: string,
    viewedAt: timestamp
  }>,
  createdAt: timestamp,
  expirationTime: timestamp (TTL - 24h),
  allowedUserIds: Set<string> (for PRIVATE),
  blockedUserIds: Set<string>
}
```

### Table: DeviceTokens
```
PK: deviceTokenId (String)
SK: -
GSI1: PK: userId, SK: -

Attributes:
{
  deviceTokenId: string (PK),
  userId: string,
  deviceToken: string (Firebase),
  deviceId: string,
  platform: ANDROID|IOS|WEB,
  appVersion: string,
  osVersion: string,
  createdAt: timestamp,
  updatedAt: timestamp,
  isActive: boolean
}
```

### Table: AiConversations
```
PK: conversationId (String)
SK: -
GSI1: PK: userId, SK: createdAt

Attributes:
{
  conversationId: string (PK),
  userId: string,
  botId: string (e.g., "openai-gpt4"),
  messages: List<{
    role: USER|ASSISTANT,
    content: string,
    timestamp: timestamp
  }>,
  context: string,
  purposes: List<string>,
  createdAt: timestamp,
  updatedAt: timestamp,
  ttl: timestamp (30 days)
}
```

### Redis Key Patterns
```
// Caching
cache:user:{userId} -> User object (TTL: 30min)
cache:conversation:{convId} -> Conversation (TTL: 15min)
cache:message:recent:{convId} -> Recent messages (TTL: 5min)

// Session Management
session:{sessionId} -> Session info (TTL: 24h)
user:sessions:{userId} -> List<sessionId> (TTL: 24h)
device:active:{deviceId} -> {userId, sessionId} (TTL: 24h)

// Rate Limiting & Security
ratelimit:login:{phoneNumber} -> {attempts, timestamp} (TTL: 15min)
ratelimit:otp:{phoneNumber} -> {attempts, timestamp} (TTL: 5min)
ratelimit:api:{userId} -> {count, timestamp} (TTL: 1min)

// Real-time
typing:{conversationId} -> Set<{userId, timestamp}> (TTL: 30s)
online:users -> Set<userId> (updates at login/logout)
user:status:{userId} -> {status, timestamp} (TTL: 1h)

// Message Queue
queue:notifications:{userId} -> List<notification>
queue:pending:messages -> {conversationId, messageId, data}

// Locks & Flags
lock:user:{userId} -> {locked_until} (distributed lck)
flag:read_receipt:{messageId}:{userId} -> true (TTL: 24h)
```

---

## 🔐 Security Implementation

### 1. Authentication Flow
```
User Login
    ↓
Verify Phone + Password
    ↓
Generate JWT (Access + Refresh)
    ↓
Create Session (Redis)
    ↓
Invalidate Old Sessions
    ↓
Return Tokens + Redirect
```

### 2. Authorization Levels
- **Public**: No auth required (Register, Login, Public story)
- **Authenticated**: JWT token required
- **Resource Owner**: Can modify own resources
- **Admin**: Group/System admin permissions

### 3. Password Security
```java
// PBKDF2 with salt
Algorithm: PBKDF2
Iterations: 100,000+
Hash: SHA-256
Salt: 32 bytes random
```

### 4. JWT Payload
```json
{
  "sub": "userId",
  "phoneNumber": "+84xxxxxxxxx",
  "firstName": "John",
  "roles": ["USER"],
  "sessionId": "session-uuid",
  "deviceId": "device-uuid",
  "iat": 1234567890,
  "exp": 1234571490,
  "aud": "chat-app"
}
```

### 5. OTP Mechanism
- **Generate**: 6-digit random code
- **Send**: Via SMS (Integration with Twilio/Nexmo)
- **Verify**: TTL 5min, max 3 attempts
- **Lock**: 5min lock after 3 failed attempts

---

## 📈 Scaling Strategy

### Phase 1: Monolith (Current - 10K-100K users)
- Single Spring Boot instance
- Horizontal scaling via load balancer
- DynamoDB scaling
- Redis cluster for cache

### Phase 2: Modular Monolith Optimization
- Event-driven communication between modules
- CQRS separation (read vs write)
- Caching layers with Redis
- Database sharding strategy

### Phase 3: Transition to Microservices
```
Monolith (Current) ────→ Modular Monolith ────→ Microservices
                           (Refactor)        (Split by module)

Services:
- auth-service
- user-service
- chat-service
- message-service
- notification-service
- media-service
- ai-service
- story-service
```

### Performance Optimization
1. **Caching Strategy**: Multi-layer caching
2. **Database Optimization**: Indexes, partitioning
3. **API Optimization**: Response compression, pagination
4. **WebSocket Optimization**: Connection pooling, message batching
5. **Message Queue**: Async processing (Spring Events → Kafka)

---

## 🚀 Deployment Strategy

### Local Development
```bash
docker-compose up  # DynamoDB, Redis, PostgreSQL locally
mvn spring-boot:run
```

### Containerization
```dockerfile
# Multi-stage build
FROM maven:3.8-eclipse-temurin-17 AS builder
FROM eclipse-temurin:17-jre
# Copy from builder and run
```

### Environment Configuration
```yaml
local: Local development settings
dev: Shared development environment
staging: UAT environment
prod: Production environment
```

---

## 📚 Next Steps
1. Implement module structure
2. Setup DynamoDB tables
3. Configure Redis
4. Implement auth module (JWT, OTP, Session)
5. Setup WebSocket communication
6. Implement message CQRS
7. Add notification service
8. Deploy container setup
