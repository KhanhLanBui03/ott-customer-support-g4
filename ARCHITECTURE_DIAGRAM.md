# Session Persistence Architecture - Visual Diagram

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT (Web/Mobile)                         │
├─────────────────────────────────────────────────────────────────────┤
│  • Stores: accessToken, refreshToken in SecureStore/localStorage    │
│  • On 401: Auto-refresh using refreshToken                          │
│  • On error: Retry with new tokens                                  │
└──────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
            ┌──────────────┐  ┌──────────────┐  ┌─────────────┐
            │   Login      │  │ API Request  │  │   Refresh   │
            │ POST /login  │  │ GET /api/... │  │ POST /token │
            └──────────────┘  └──────────────┘  └─────────────┘
                    │               │               │
                    └───────────────┼───────────────┘
                                    │
                    ┌───────────────▼───────────────┐
                    │      Spring Security         │
                    │  JwtAuthenticationFilter    │
                    └──────────────┬────────────────┘
                                   │
        ┌──────────────────────────┼──────────────────────────┐
        │                          │                          │
        ▼                          ▼                          ▼
   JWT Validation         Session Validation        Extract Claims
   (Signature Check)      (DB Check) ✨NEW            (userId, sessionId)
        │                          │                          │
        │ Signature OK             │ Session valid?           │
        │ & Not expired            │                          │
        │                          ▼                          │
        │                   ┌──────────────────┐             │
        │                   │  SessionService  │             │
        │                   │ .isValidSession()│             │
        │                   └────────┬─────────┘             │
        │                            │                       │
        │         ┌──────────────────┼──────────────────┐   │
        │         │                  │                  │   │
        │         ▼                  ▼                  ▼   │
        │    DB Query         Check: NOT       Check: User │
        │    Find session     Expired           owns session│
        │    by PK                 │                  │     │
        │         │                │                  │     │
        │         └────────┬───────┴──────────────────┘     │
        │                  │                                 │
        │                  ▼                                 │
        │         ┌─────────────────┐                       │
        │         │  Session Valid? │                       │
        │         └────┬─────────┬──┘                       │
        │              │         │                         │
        │         YES  │         │  NO                     │
        │              ▼         ▼                         │
        │         ✅ Allow   ❌ Return 401                │
        │         Request   Unauthorized                  │
        │              │         │                         │
        │              └─┬───────┴─────────────────────────┘
        │                │
        └────────────────┼─────────────────────────────────┐
                         │                                 │
                         ▼                                 ▼
                    Continue to    (Client interceptor
                    AuthService    auto-refreshes)
```

---

## 🔄 Request Flow with Session Validation

```
REQUEST INCOMING
    │
    ├─→ JwtAuthenticationFilter
    │   ├─→ Extract token from header
    │   ├─→ JwtUtil.validateToken()
    │   │   └─→ Check signature & expiration
    │   │
    │   └─→ JwtUtil.extractSessionId()
    │       └─→ Get sessionId from claims
    │
    └─→ SessionService.isValidSession(sessionId, userId) ✨
        │
        ├─→ SessionRepository.findById(sessionId)
        │   └─→ Query DynamoDB: sessionId (PK)
        │       DynamoDB returns: Session object
        │
        ├─→ Check: session.getUserId().equals(userId) ?
        │   ├─→ YES: Continue
        │   └─→ NO: Return false → 401
        │
        ├─→ Check: session.getIsValid() == true ?
        │   ├─→ YES: Continue
        │   └─→ NO: Return false → 401
        │
        ├─→ Check: !session.isExpired() ?
        │   ├─→ YES: Continue
        │   └─→ NO: Return false → 401
        │
        └─→ Update: session.updateLastAccess()
            └─→ SessionRepository.save(session)
                Return: true → Allow request ✅

```

---

## 📊 Before vs After Comparison

### BEFORE (In-Memory Only)

```
                    Backend Process Memory
        ┌───────────────────────────────────────────┐
        │                                           │
        │  sessionToUser                            │
        │  ├─ "session-123" → SessionEntry{...}    │
        │  ├─ "session-456" → SessionEntry{...}    │
        │  └─ ...                                   │
        │                                           │
        │  userToSessions                           │
        │  ├─ "user-A" → {"session-123"}           │
        │  └─ ...                                   │
        │                                           │
        └───────────────────────────────────────────┘
                            │
                            ▼
                    BACKEND RESTART
                            │
                            ▼
        ┌───────────────────────────────────────────┐
        │                                           │
        │  🔴 ALL DATA LOST!                       │
        │  sessionToUser = {}  (empty)             │
        │  userToSessions = {} (empty)             │
        │                                           │
        │  Result: User requests fail → 401 → Logout
        │                                           │
        └───────────────────────────────────────────┘

PROBLEM: ❌ No persistence, data lost on restart
```

### AFTER (DynamoDB Persistence) ✨

```
                    Backend Process Memory
        ┌───────────────────────────────────────────┐
        │                                           │
        │  SessionService                           │
        │  ├─ SessionRepository (injected)         │
        │  │   └─ queries from DynamoDB            │
        │  │                                        │
        │  └─ createSession(), isValidSession()    │
        │     (now uses DB, not in-memory)        │
        │                                           │
        └───────────────────────────────────────────┘
                            │
                            ▼
                        DynamoDB
        ┌───────────────────────────────────────────┐
        │  chat_sessions table (persistent)        │
        │                                           │
        │  ┌─ sessionId-123 ──┐                   │
        │  │ ├─ userId: A     │                   │
        │  │ ├─ deviceType: web                   │
        │  │ ├─ expiresAt: ...│                   │
        │  │ ├─ isValid: true │                   │
        │  │ └─ createdAt: ...|                   │
        │  │                  │                   │
        │  ├─ sessionId-456 ──┤                   │
        │  │ ├─ userId: B     │                   │
        │  │ ├─ deviceType: mobile               │
        │  │ ├─ expiresAt: ...│                   │
        │  │ ├─ isValid: true │                   │
        │  │ └─ ...           │                   │
        │  └──────────────────┘                   │
        │                                         │
        └─────────────────────────────────────────┘
                            │
                            ▼
                    BACKEND RESTART
                            │
                            ▼
                        DynamoDB
        ┌───────────────────────────────────────────┐
        │  chat_sessions table (still there!)      │
        │                                           │
        │  ✅ Data persisted!                      │
        │  ✅ Sessions intact!                     │
        │  ✅ Ready for validation!                │
        │                                           │
        └───────────────────────────────────────────┘

SOLUTION: ✅ Data persisted, survives restart!
```

---

## 🔄 Session Lifecycle Timeline

```
TIME: 9:00 AM
┌─────────────────────────────────────────────────────────────────────┐
│                         USER LOGIN                                   │
│  POST /auth/login with credentials                                  │
│                                                                      │
│  AuthService.login()                                                 │
│    ├─ Verify credentials ✅                                         │
│    ├─ SessionService.createSession("user-A", "web")                │
│    │   ├─ UUID.randomUUID() → "abc-123"                            │
│    │   ├─ Session.create("abc-123", "user-A", "web", null)         │
│    │   └─ SessionRepository.save(session) → DynamoDB ✅             │
│    │                                                                 │
│    ├─ JwtUtil.generateToken(userId, ..., "abc-123")                │
│    │   └─ accessToken = JWT{...sessionId: "abc-123"...}           │
│    │                                                                │
│    └─ Return: { accessToken, refreshToken, sessionId: "abc-123" } │
└─────────────────────────────────────────────────────────────────────┘


TIME: 9:30 AM
┌─────────────────────────────────────────────────────────────────────┐
│                    USER MAKES API REQUEST                            │
│  GET /api/conversations with Authorization: Bearer {accessToken}   │
│                                                                      │
│  JwtAuthenticationFilter                                            │
│    ├─ Extract token                                                 │
│    ├─ JwtUtil.validateToken() → ✅ Valid                          │
│    ├─ Extract claims: userId="user-A", sessionId="abc-123"        │
│    │                                                                 │
│    └─ SessionService.isValidSession("abc-123", "user-A")          │
│        ├─ SessionRepository.findById("abc-123")                    │
│        │   └─ DynamoDB query: sessionId = "abc-123" → Found ✅    │
│        ├─ Check: userId matches ✅                                 │
│        ├─ Check: isValid = true ✅                                 │
│        ├─ Check: not expired ✅                                    │
│        └─ Return: true → Allow request ✅                          │
│                                                                      │
│  Request proceeds to ConversationController                         │
└─────────────────────────────────────────────────────────────────────┘


TIME: 9:33 AM - BACKEND CRASH 💥
┌─────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  Backend process killed                                             │
│  All in-memory state lost (but that's OK!)                          │
│                                                                      │
│  DynamoDB still has:                                                │
│    • sessionId: "abc-123"                                           │
│    • userId: "user-A"                                               │
│    • isValid: true                                                  │
│    • expiresAt: TOMORROW 9:00 AM                                   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘


TIME: 9:35 AM - BACKEND RESTART
┌─────────────────────────────────────────────────────────────────────┐
│  Backend starts                                                      │
│  DynamoDBTableInitializer.onApplicationEvent()                      │
│    ├─ Scan for @DynamoDBTable entities                             │
│    ├─ Found: Session.class                                         │
│    └─ Check table "chat_sessions"                                  │
│        └─ Already exists ✅ (skip creation)                       │
│                                                                     │
│  SessionRepository bean created                                     │
│  SessionService bean created                                        │
│                                                                     │
│  Server ready! ✅                                                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘


TIME: 9:37 AM - USER CONTINUES WORKING 😊
┌─────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  User (still has accessToken in browser/app)                        │
│  GET /api/messages with same accessToken (from 9:00 AM)           │
│                                                                     │
│  JwtAuthenticationFilter                                           │
│    ├─ Token valid ✅ (hasn't expired yet)                         │
│    ├─ Extract sessionId: "abc-123"                                │
│    └─ SessionService.isValidSession("abc-123", "user-A")         │
│        ├─ DynamoDB query → Session found ✅                       │
│        ├─ Checks all pass ✅                                      │
│        └─ Allow request ✅                                        │
│                                                                    │
│  Result: Request succeeds!                                         │
│                                                                    │
│  🎉 USER NEVER LOGGED OUT! 🎉                                    │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘


TIME: 10:00 AM (next day)
┌─────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  User tries to make request with old token                         │
│                                                                     │
│  SessionService.isValidSession("abc-123", "user-A")              │
│    ├─ DynamoDB query → Found                                       │
│    ├─ Check: expiresAt <= System.currentTimeMillis() ?            │
│    │   └─ YES (24 hours passed)                                   │
│    └─ Session expired! Return false                               │
│                                                                    │
│  Result: 401 Unauthorized                                         │
│                                                                    │
│  Client interceptor:                                              │
│    ├─ Has refreshToken (7-day TTL, still valid)                  │
│    ├─ POST /auth/refresh-token { refreshToken }                 │
│    ├─ Backend: JwtUtil.validateToken(refreshToken) ✅           │
│    ├─ SessionService.createSession("user-A") [NEW SESSION!]     │
│    │   └─ "def-456" saved to DynamoDB ✅                        │
│    ├─ Return: new accessToken with sessionId: "def-456"        │
│    │                                                             │
│    └─ Retry original request with new token → Success ✅        │
│                                                                  │
│  User continues without manual login! ✨                        │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 📈 Single Session Per Device Type

```
SCENARIO: User logs in from multiple devices

TIME: 9:00 AM - FIRST WEB LOGIN (Device A)
┌──────────────────────────────────┐
│ POST /auth/login                 │
│ deviceType: "web"                │
│                                  │
│ SessionService.createSession()   │
│   └─ DynamoDB query: userId="A", │
│      deviceType="web"            │
│      → No active web sessions    │
│                                  │
│   ├─ Create: session-111         │
│   └─ Save to DB                  │
│                                  │
│ Token: JWT{sessionId: "111"}     │
└──────────────────────────────────┘
        │
        ▼
    DynamoDB
    ┌─────────────────────────────┐
    │ chat_sessions table         │
    │                             │
    │ session-111 ✅ ACTIVE      │
    │ ├─ userId: A               │
    │ ├─ deviceType: web         │
    │ └─ isValid: true            │
    │                             │
    └─────────────────────────────┘


TIME: 9:05 AM - SECOND WEB LOGIN (Device B - Same User!)
┌──────────────────────────────────┐
│ POST /auth/login                 │
│ deviceType: "web"                │
│                                  │
│ SessionService.createSession()   │
│   └─ DynamoDB query: userId="A",│
│      deviceType="web"            │
│      → Found: [session-111]      │
│                                  │
│   ├─ KICK OUT OLD SESSION       │
│   │   session-111.invalidate()  │
│   │   Save to DB                │
│   │                             │
│   ├─ Create: session-222 (new)  │
│   └─ Save to DB                 │
│                                  │
│ Token: JWT{sessionId: "222"}     │
└──────────────────────────────────┘
        │
        ▼
    DynamoDB
    ┌─────────────────────────────┐
    │ chat_sessions table         │
    │                             │
    │ session-111 ❌ INACTIVE    │
    │ ├─ userId: A               │
    │ ├─ deviceType: web         │
    │ └─ isValid: false ← KICKED  │
    │                             │
    │ session-222 ✅ ACTIVE      │
    │ ├─ userId: A               │
    │ ├─ deviceType: web         │
    │ └─ isValid: true            │
    │                             │
    └─────────────────────────────┘

RESULT: Only 1 web session active
        Device A (old): Request fails → 401 → Logout
        Device B (new): Request succeeds ✅


NOTE: Mobile sessions still work!
      Different deviceType = separate session slot
```

---

## 🛡️ Security Model

```
REQUEST WITH TOKEN
        │
        ▼
┌─────────────────────────────────────────────┐
│ LAYER 1: JWT Signature Validation           │
│                                             │
│ • Verify token is properly signed          │
│ • Verify token hasn't been tampered with   │
│ • Check expiration (24 hour limit)         │
│                                             │
│ If fails: ❌ REJECT                        │
│ If passes: Continue to Layer 2             │
└─────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────┐
│ LAYER 2: Session Database Validation ✨     │
│                                             │
│ • Extract sessionId from JWT claims       │
│ • Query DynamoDB for this sessionId       │
│ • Check: Session exists?                  │
│ • Check: Not expired (TTL check)?         │
│ • Check: Not invalidated (isValid)?       │
│ • Check: Belongs to user in JWT?          │
│                                             │
│ If fails: ❌ REJECT (401)                  │
│ If passes: Continue to Layer 3             │
└─────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────┐
│ LAYER 3: Authorization (Spring Security)   │
│                                             │
│ • Check user roles/permissions             │
│ • Check endpoint access rules              │
│                                             │
│ If fails: ❌ REJECT (403)                  │
│ If passes: ✅ ALLOW                        │
└─────────────────────────────────────────────┘
        │
        ▼
    REQUEST PROCESSED ✅


ATTACK SCENARIOS:
───────────────────────

1. Attacker has old, expired token:
   Layer 1: JWT expires after 24 hours → ❌ REJECT

2. Attacker has token but session was logged out:
   Layer 2: DynamoDB check → isValid=false → ❌ REJECT

3. Attacker has token for different user:
   Layer 2: userId mismatch → ❌ REJECT

4. Token manually modified/forged:
   Layer 1: Invalid signature → ❌ REJECT

CONCLUSION: ✅ Secure defense in depth!
```

---

## 🔧 DynamoDB Query Patterns

```
QUERY 1: Validate Session (Most Common)
─────────────────────────────────────────
Use: PrimaryKey lookup
Query: sessionId = "abc-123"
Response: Session{...}
Complexity: O(1) - Constant time
Speed: ~1-3ms

Code:
  sessionRepository.findById("abc-123")
  → dynamoDBMapper.load(Session.class, "abc-123", "active")
  → DynamoDB: Table scan by partition key
  → Return: Single session object


QUERY 2: Find User's Sessions
──────────────────────────────
Use: GSI lookup (Global Secondary Index)
Query: userId-index { userId = "user-A" }
Response: [session-111, session-222, ...]
Complexity: O(n) where n = sessions per user
Speed: ~2-5ms (typically n < 10)

Code:
  sessionRepository.findByUserId("user-A")
  → dynamoDBMapper.query(Session.class, {userId:"user-A"})
  → DynamoDB: GSI scan by partition key
  → Return: List of sessions for user


QUERY 3: Find Active Sessions of Type
──────────────────────────────────────
Use: GSI lookup + in-memory filtering
Query: userId-index { userId = "user-A" }
Filter: deviceType="web" AND isValid=true AND not expired
Response: [session-222]
Complexity: O(n) where n = sessions per user
Speed: ~2-5ms

Code:
  sessionRepository.findActiveSessionsByUserAndDeviceType()
  → Query GSI for all sessions
  → Filter in-memory: deviceType, isValid, expiration
  → Return: List of active sessions for device type


PERFORMANCE CHARACTERISTICS:
────────────────────────────
• Single session validation: < 5ms (P99)
• User has multiple sessions: ~5-10ms (P99)
• Batch operations: ~10-20ms (P99)

DynamoDB scaling:
• Automatic scaling with PAY_PER_REQUEST billing mode
• No provisioning needed
• Handles burst traffic seamlessly
```

---

## ✨ Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  BEFORE: Sessions in RAM                                        │
│  ├─ Fast queries                                               │
│ ├─ Lost on restart 😞                                          │
│ └─ Not suitable for load balancing                             │
│                                                                 │
│  AFTER: Sessions in DynamoDB                                    │
│ ├─ Persistent across restarts ✅                               │
│ ├─ Ready for load balancing ✅                                 │
│ ├─ Audit trail (soft deletes) ✅                               │
│ ├─ Slightly slower (but acceptable) ✅                         │
│ └─ Better security and reliability ✅                          │
│                                                                 │
│  RESULT: Users stay logged in! 🎉                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

