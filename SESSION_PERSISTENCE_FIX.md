# Session Persistence Fix - Giải pháp Logout khi Backend Restart

## 🎯 Vấn đề

Trước đây, mỗi khi restart backend:
- Tất cả sessions của users bị xóa khỏi bộ nhớ (in-memory ConcurrentHashMap)
- Tokens của users vẫn hợp lệ nhưng kiểm tra `isValidSession()` fail
- Users nhận lỗi 401 → cố refresh token → logout

**Root cause**: Sessions chỉ được lưu trong RAM, không persistence.

---

## ✅ Giải pháp

Đã implement **DynamoDB persistence** cho sessions, giúp:
- ✅ Sessions survive backend restarts
- ✅ Users vẫn logged in bình thường
- ✅ Single session per device type enforcement vẫn hoạt động
- ✅ Logout/invalidate sessions vẫn hoạt động đúng

---

## 📁 Files Được Thêm/Thay Đổi

### 1. **NEW: Session Entity** 
📄 `backend/src/main/java/com/chatapp/modules/auth/domain/Session.java`
- Domain entity cho DynamoDB
- Stores: sessionId, userId, deviceType, expiresAt, isValid
- Auto-create DynamoDB table `chat_sessions` on startup

### 2. **NEW: SessionRepository**
📄 `backend/src/main/java/com/chatapp/modules/auth/repository/SessionRepository.java`
- Repository pattern cho DynamoDB queries
- Methods:
  - `save()` - Lưu/update session
  - `findById()` - Tìm session by ID
  - `findByUserId()` - Tìm tất cả sessions của user
  - `findActiveSessionsByUserAndDeviceType()` - Tìm active sessions theo device type
  - `deleteById()` - Xóa session (hard delete)
  - `countActiveSessionsForUser()` - Đếm active sessions

### 3. **UPDATED: SessionService**
📄 `backend/src/main/java/com/chatapp/modules/auth/service/SessionService.java`
- Thay thế in-memory storage bằng DynamoDB
- Inject `SessionRepository` thay vì `ConcurrentHashMap`
- Core logic vẫn giữ nguyên:
  - `createSession()` - Tạo session mới, kick out old session của device type
  - `isValidSession()` - Validate session (now queries from DB)
  - `invalidateSession()` - Soft delete (set isValid=false)
  - `invalidateAllUserSessions()` - Logout all devices

---

## 🔄 Authentication Flow (Không Thay Đổi)

```
1. User Login
   → AuthService.login()
   → SessionService.createSession() [NOW: saves to DynamoDB]
   → Generate JWT with sessionId
   → Return tokens

2. User Makes API Request
   → Include: Authorization: Bearer {accessToken}
   → JwtAuthenticationFilter validates JWT
   → Check: sessionService.isValidSession() [NOW: queries DynamoDB]
   → If valid → Allow request
   → If invalid → Return 401

3. Access Token Expires
   → Client gets 401
   → axiosClient interceptor calls /auth/refresh-token
   → Backend generates NEW session [NEW SESSION PERSISTED TO DB]
   → Generate new token pair
   → Client continues

4. Backend Restart
   → ALL sessions still in DynamoDB ✅
   → Users retry requests with old token
   → If valid → Continue without interrupt
   → If expired but refresh token valid → Auto-refresh works ✅
```

---

## 🗄️ DynamoDB Table Schema

**Table Name**: `chat_sessions`

| Attribute | Type | Index | Purpose |
|-----------|------|-------|---------|
| sessionId | String | **Primary Key (Hash)** | Unique session identifier |
| sk | String | **Range Key** | Always "active" for consistency |
| userId | String | **GSI (userId-index)** | User identifier |
| deviceType | String | Normal | "web" or "mobile" |
| expiresAt | Long | **GSI (Range)** | Timestamp when session expires |
| createdAt | Long | Normal | When session was created |
| lastAccessedAt | Long | Normal | Last access time (updated on each validation) |
| isValid | Boolean | Normal | true = active, false = invalidated (soft delete) |
| deviceId | String | Normal | Optional device identifier |
| ipAddress | String | Normal | Optional IP for audit |
| userAgent | String | Normal | Optional client info for audit |

**Global Secondary Index**: `userId-index`
- Hash Key: `userId`
- Range Key: `expiresAt`
- Enables efficient lookup of all sessions for a user

---

## 🚀 Backend Restart Scenario (WITH FIX)

```
BEFORE RESTART:
- User A has web session: session-123 (expires in 20 hours)
- User A has mobile session: session-456 (expires in 24 hours)
- Both stored in DynamoDB ✅

BACKEND RESTART:
1. DynamoDB TableInitializer scans for @DynamoDBTable entities
2. chat_sessions table already exists (or gets created)
3. Sessions are still there!

AFTER RESTART:
4. User A makes API request with token containing session-123
5. JwtAuthenticationFilter calls isValidSession("session-123", "userA")
6. SessionService queries DynamoDB:
   - Session found ✅
   - Not expired ✅
   - Belongs to user ✅
   - isValid = true ✅
7. Request allowed, user continues normally! 🎉

NO LOGOUT! 🎉
```

---

## 🔐 Security Benefits

1. **Persistent Sessions** - Survives restarts
2. **Soft Delete** - Invalidate without data loss (audit trail)
3. **TTL Management** - Sessions auto-expire after 24 hours
4. **Multi-device Support** - One session per device type
5. **Logout All Devices** - Can invalidate all user sessions immediately

---

## 📝 Configuration

No additional configuration needed! Already configured in `application.yml`:

```yaml
aws.dynamodb:
  endpoint: ${DYNAMODB_ENDPOINT:}  # Empty = use AWS
  tables:
    sessions: chat_sessions

app:
  security:
    session-ttl-hours: 24  # Default expiry
```

---

## ✨ What's NOT Changed

- ✅ JWT token generation/validation - same
- ✅ Refresh token logic - same
- ✅ Frontend/Mobile client code - same (auto-retry still works)
- ✅ Logout endpoint - same (just now uses DB)
- ✅ Single session per device type - same behavior
- ✅ API authentication flow - same

---

## 🧪 How to Test

### Test 1: Session Survives Restart
```bash
1. Login with web client (get token)
2. Make an API call - should work ✅
3. Restart backend server
4. Make another API call with same token - should work ✅ (before: got 401 and logged out)
```

### Test 2: Old Token Still Works
```bash
1. Login at 9:00 AM
2. Stop using for 1 hour
3. Restart backend at 10:00 AM
4. Make API call at 10:05 AM with token from 9:00 AM
5. Should work ✅ (session still valid, TTL = 24 hours)
```

### Test 3: Expired Token Refreshes
```bash
1. Login with refresh token
2. Wait for access token to expire (24 hours)
3. Make API call → get 401
4. Client auto-refreshes using refresh token
5. New session created (persisted to DB) ✅
6. Request retried with new token → works ✅
```

### Test 4: Logout Works
```bash
1. Login on web and mobile
2. Call POST /auth/logout on web device
3. Web session invalidated in DB (isValid = false) ✅
4. Web requests now fail with 401
5. Mobile session still valid → mobile works ✅
```

### Test 5: Single Session Per Device Type
```bash
1. Login on web (session-123 created)
2. Login again on web (session-456 created)
3. session-123 invalidated in DB (old web session kicked out) ✅
4. session-456 active ✅
5. Mobile login still works (different device type) ✅
```

---

## 🔍 Monitoring

### Check Active Sessions (for admin)
```sql
-- Query DynamoDB chat_sessions table
-- Filter: isValid = true AND expiresAt > current_timestamp
```

### Clean Up Expired Sessions (optional maintenance)
```java
sessionRepository.deleteExpiredSessions(); // Removes expired records
```

---

## 📋 Migration Notes

- ✅ No data migration needed
- ✅ New DynamoDB table auto-created on first startup
- ✅ Old in-memory sessions discarded (user logs back in automatically)
- ✅ Backward compatible - no breaking changes to APIs

---

## 🐛 Troubleshooting

### Issue: Users still getting logged out after restart
**Solution**: 
- Check DynamoDB table `chat_sessions` exists
- Verify `aws.dynamodb.endpoint` config is correct
- Check DynamoDB is accessible (check logs for DynamoDB errors)

### Issue: Session not being created
**Solution**:
- Check `SessionService` is being injected (via `@Autowired` or constructor)
- Check `SessionRepository` is a `@Repository` component
- Look for NPE in logs

### Issue: Performance concerns with DynamoDB queries
**Solution**:
- Queries use GSI `userId-index` with proper hash/range keys - O(1) complexity
- `isValidSession()` queries by PK - very fast
- Add CloudWatch monitoring if needed

---

## 📞 Support

For questions about this implementation:
1. Check `Session.java` for schema
2. Check `SessionRepository.java` for query methods
3. Check `SessionService.java` for business logic
4. Check logs for DynamoDB connection issues

---

## ✅ Summary

**Before Fix:**
- Sessions in-memory only
- Restart = all logged out
- Frustrating UX

**After Fix:**
- Sessions persisted to DynamoDB
- Restart = users stay logged in
- Better UX ✨
- No API changes
- No frontend changes
