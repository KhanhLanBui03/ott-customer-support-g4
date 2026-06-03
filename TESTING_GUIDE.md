# Testing Guide - Session Persistence Fix

## 📋 Pre-Testing Checklist

- [ ] Backend rebuilt with `mvn clean package`
- [ ] DynamoDB (local or AWS) is running
- [ ] AWS credentials configured (if using AWS DynamoDB)
- [ ] Backend application started successfully
- [ ] Check logs for: "DynamoDB Table chat_sessions already exists"
- [ ] Mobile/Web app connected to backend

---

## 🧪 Test Cases

### TEST 1: Session Persists in DynamoDB

**Objective**: Verify session is saved to DynamoDB after login

**Steps**:
1. Start backend server
2. Open frontend/mobile app
3. Login with any credentials
4. Check backend logs:
   ```
   Session created: abc-123 (web) for user: user-456 (expires: ...)
   ```
5. Query DynamoDB to verify session exists
   ```bash
   # AWS CLI
   aws dynamodb get-item \
     --table-name chat_sessions \
     --key '{"sessionId": {"S": "abc-123"}, "sk": {"S": "active"}}' \
     --region ap-southeast-1
   
   # Expected response: Session item with isValid=true
   ```

**Expected Result**: ✅ Session found in DynamoDB with all attributes

**Pass Criteria**: 
- [ ] Session appears in logs
- [ ] DynamoDB query returns session item
- [ ] Session attributes include userId, deviceType, expiresAt

---

### TEST 2: Backend Restart - User Stays Logged In (MAIN TEST!)

**Objective**: Verify users don't logout when backend restarts

**Steps**:
1. Start backend server
2. Login on web client (note the token)
   ```
   Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
3. Make an API request (e.g., get conversations)
   ```
   Status: 200 ✅
   ```
4. **KILL BACKEND** (Ctrl+C or docker kill)
   ```
   Backend stopped
   In-memory sessions lost (but DB sessions intact!)
   ```
5. **START BACKEND** again
   ```
   java -jar chat-app-backend-1.0.0.jar
   # Check logs for table initialization
   ```
6. **WITHOUT LOGGING IN AGAIN**, make API request with old token
   ```
   GET /api/conversations
   Authorization: Bearer {same token as step 2}
   
   Expected Status: 200 ✅ (NOT 401 ❌)
   ```
7. Verify response has data
   ```json
   {
     "success": true,
     "data": [/* conversations */],
     "message": "Success"
   }
   ```

**Expected Result**: ✅ Request succeeds, user NOT logged out

**Pass Criteria**:
- [ ] Request returns 200 (not 401)
- [ ] Response data is valid
- [ ] No logout/redirect
- [ ] Logs show: "Session valid for user-456"

**IMPORTANT**: This is the critical test for the fix!

---

### TEST 3: Token Expiration & Auto-Refresh

**Objective**: Verify that expired access tokens auto-refresh using refresh token

**Prerequisites**: User logged in, have both accessToken and refreshToken

**Steps**:
1. Get current accessToken and refreshToken from client storage
2. Wait for access token to expire (24 hours OR manually modify JWT to have expired `exp` claim)
3. Make API request with expired accessToken
   ```
   GET /api/conversations
   Authorization: Bearer {expired_token}
   
   Expected Status: 401 ❌
   ```
4. Check backend logs:
   ```
   JWT valid. UserId: user-456, SessionId: abc-123
   (JWT still valid cryptographically, not time-expired in this scenario)
   ```
5. Check client logs:
   ```
   axiosClient interceptor caught 401
   Attempting token refresh...
   ```
6. Client auto-calls refresh endpoint:
   ```
   POST /auth/refresh-token
   Body: { refreshToken: "..." }
   ```
7. Backend creates NEW session
   ```
   Session created: def-456 for user: user-456
   Session saved to DynamoDB ✅
   ```
8. Backend returns new tokens
   ```json
   {
     "accessToken": "new_jwt_with_sessionId:def-456",
     "refreshToken": "new_refresh_token",
     "sessionId": "def-456"
   }
   ```
9. Client retries original request with new token
   ```
   GET /api/conversations
   Authorization: Bearer {new_token}
   
   Expected Status: 200 ✅
   ```

**Expected Result**: ✅ Token refreshed, request retried successfully

**Pass Criteria**:
- [ ] 401 received on first attempt
- [ ] Refresh endpoint called automatically
- [ ] New session created in DynamoDB
- [ ] Retry with new token returns 200
- [ ] User data retrieved successfully

---

### TEST 4: Single Session Per Device Type

**Objective**: Verify only one session active per device type

**Scenario**: User logs in from web twice

**Steps**:
1. Open browser and login
   ```
   Session 1: web-session-111
   Token: JWT{sessionId: "web-session-111"}
   Stored in localStorage
   ```
2. Make API request
   ```
   GET /api/user
   Status: 200 ✅
   ```
3. Open different browser (or incognito) and login AGAIN
   ```
   Login credentials same as step 1
   Backend: createSession() called
   Query DB: Find active web sessions for this user
   Result: Found web-session-111
   Action: Invalidate web-session-111 (isValid = false)
   Create new: web-session-222
   Token: JWT{sessionId: "web-session-222"}
   Stored in NEW browser localStorage
   ```
4. **Go back to first browser**
5. Try to make API request
   ```
   GET /api/conversations
   Authorization: Bearer {JWT with web-session-111}
   
   Backend validation:
     • Find session-111 in DB
     • Check: isValid = false ❌
     • Result: 401 Unauthorized
   
   Expected Status: 401 ❌
   Expected Result: Force logout from first browser
   ```
6. **Go to second browser**
7. Make API request
   ```
   GET /api/conversations
   Authorization: Bearer {JWT with web-session-222}
   
   Backend validation:
     • Find session-222 in DB
     • Check: isValid = true ✅
     • Check: not expired ✅
     • Result: 200 OK
   
   Expected Status: 200 ✅
   ```

**Expected Result**: ✅ Only new session (web-session-222) valid, old session (web-session-111) invalid

**Pass Criteria**:
- [ ] First browser gets 401 after second login
- [ ] First browser logged out
- [ ] Second browser can continue
- [ ] Only 1 active web session in DB

**Alternative Test**: Login on web, then login on mobile
- Both should work (different deviceType)
- No session invalidation

---

### TEST 5: Logout Endpoint

**Objective**: Verify logout invalidates session in database

**Prerequisites**: User logged in

**Steps**:
1. User makes request (works)
   ```
   GET /api/conversations
   Status: 200 ✅
   Session: web-session-111
   ```
2. User clicks Logout button
   ```
   Client: POST /auth/logout
   Body: { sessionId: "web-session-111" }
   ```
3. Backend processes logout
   ```
   SessionService.invalidateSession("web-session-111")
   • Find session in DB
   • Set isValid = false
   • Save to DB
   ```
4. Check logs:
   ```
   Session invalidated: web-session-111 for user: user-456
   ```
5. Try to make API request with old token
   ```
   GET /api/conversations
   Authorization: Bearer {JWT with web-session-111}
   
   Backend:
   • SessionService.isValidSession()
   • Query DB: session-111
   • Check: isValid = false ❌
   • Result: 401 Unauthorized
   
   Expected Status: 401 ❌
   ```
6. Check DB:
   ```bash
   aws dynamodb get-item \
     --table-name chat_sessions \
     --key '{"sessionId": {"S": "web-session-111"}, "sk": {"S": "active"}}' \
     --region ap-southeast-1
   
   # Response should have: isValid = false
   ```

**Expected Result**: ✅ Session invalidated, subsequent requests fail

**Pass Criteria**:
- [ ] Logout request succeeds
- [ ] Session marked as invalid in DB
- [ ] Old token fails with 401
- [ ] No authorization errors on new login

---

### TEST 6: Multiple Devices (Web + Mobile)

**Objective**: Verify both web and mobile can have active sessions simultaneously

**Prerequisites**: Backend running

**Steps**:
1. Web login
   ```
   POST /auth/login from web browser
   SessionService.createSession(userId, "web")
   Web session-111 created
   Token: JWT{sessionId: "web-session-111"}
   ```
2. Web request succeeds
   ```
   GET /api/user
   Status: 200 ✅
   Session: web-session-111
   ```
3. Mobile login (same user)
   ```
   POST /auth/login from mobile app
   SessionService.createSession(userId, "mobile")
   Mobile session-222 created (web session NOT invalidated!)
   Token: JWT{sessionId: "mobile-session-222"}
   ```
4. Mobile request succeeds
   ```
   GET /api/user
   Status: 200 ✅
   Session: mobile-session-222
   ```
5. Web request STILL works
   ```
   GET /api/conversations
   Authorization: Bearer {JWT with web-session-111}
   
   Backend validation:
   • Find session-111
   • Check: deviceType = "web" ✅
   • Check: isValid = true ✅
   • Result: 200 OK
   
   Status: 200 ✅
   ```
6. Check DynamoDB
   ```bash
   # Query for user's sessions
   aws dynamodb query \
     --table-name chat_sessions \
     --index-name userId-index \
     --key-condition-expression "userId = :userId" \
     --expression-attribute-values '{":userId": {"S": "user-456"}}' \
     --region ap-southeast-1
   
   # Response should have BOTH:
   # • web-session-111 (isValid: true, deviceType: "web")
   # • mobile-session-222 (isValid: true, deviceType: "mobile")
   ```

**Expected Result**: ✅ Both web and mobile sessions active simultaneously

**Pass Criteria**:
- [ ] Web login succeeds
- [ ] Mobile login succeeds (no web invalidation)
- [ ] Web requests continue to work
- [ ] Mobile requests continue to work
- [ ] DynamoDB shows 2 active sessions (different deviceTypes)

---

### TEST 7: Backend Restart with Multiple Devices

**Objective**: Verify both web and mobile stay logged in after restart

**Prerequisites**: 
- Web logged in (session-111)
- Mobile logged in (session-222)
- Both have valid tokens

**Steps**:
1. Web makes request
   ```
   GET /api/conversations
   Status: 200 ✅
   ```
2. Mobile makes request
   ```
   GET /api/conversations
   Status: 200 ✅
   ```
3. **KILL BACKEND**
   ```
   All in-memory state lost
   DynamoDB sessions intact:
   • web-session-111 ✅
   • mobile-session-222 ✅
   ```
4. **START BACKEND**
5. Web makes request (WITHOUT RE-LOGIN)
   ```
   GET /api/conversations
   Authorization: Bearer {original JWT with session-111}
   
   Expected Status: 200 ✅
   ```
6. Mobile makes request (WITHOUT RE-LOGIN)
   ```
   GET /api/conversations
   Authorization: Bearer {original JWT with session-222}
   
   Expected Status: 200 ✅
   ```

**Expected Result**: ✅ Both devices stay logged in post-restart

**Pass Criteria**:
- [ ] Web continues to work after restart
- [ ] Mobile continues to work after restart
- [ ] No re-login required on either device
- [ ] Both sessions still in DynamoDB with isValid=true

---

## 🔍 Debugging Tips

### Check Backend Logs

```bash
# If using jar file
tail -f logs/chat-app.log | grep -i session

# Expected log lines:
Session created: abc-123 (web) for user: user-456
Session validated for request: GET /api/conversations
JWT valid. UserId: user-456, SessionId: abc-123
Session invalidated: abc-123 for user: user-456
```

### Query DynamoDB Directly

```bash
# List all sessions
aws dynamodb scan \
  --table-name chat_sessions \
  --region ap-southeast-1

# Get specific session
aws dynamodb get-item \
  --table-name chat_sessions \
  --key '{"sessionId": {"S": "abc-123"}, "sk": {"S": "active"}}' \
  --region ap-southeast-1

# Query user's sessions
aws dynamodb query \
  --table-name chat_sessions \
  --index-name userId-index \
  --key-condition-expression "userId = :uid" \
  --expression-attribute-values '{":uid": {"S": "user-456"}}' \
  --region ap-southeast-1
```

### Check Network Requests (Browser DevTools)

```
Network tab → Look for 401 responses
Should NOT see 401 after backend restart with valid token

If you see 401:
1. Check token expiration
2. Check DynamoDB table for session
3. Check backend logs for validation errors
```

### Verify JWT Token Contents

```javascript
// Paste this in browser console to decode JWT
function decodeJWT(token) {
  const parts = token.split('.');
  const payload = JSON.parse(atob(parts[1]));
  console.log('JWT Payload:', payload);
  console.log('sessionId:', payload.sessionId);
  console.log('userId:', payload.userId);
  console.log('exp:', new Date(payload.exp * 1000));
  return payload;
}

// Usage:
const token = localStorage.getItem('accessToken');
decodeJWT(token);
```

---

## 📊 Performance Testing

### Load Test

```bash
# Using Apache Bench or similar tool
# Test 100 concurrent users making requests

ab -n 1000 -c 100 -H "Authorization: Bearer {token}" \
  http://localhost:8080/api/conversations

# Check metrics:
# • Response time < 100ms (P99)
# • Error rate < 1%
# • Throughput: > 100 req/sec
```

### Session Validation Latency

```bash
# Measure time for session validation

# Look in logs for:
# 2026-06-03 17:27:35 Session validation took: 2.5ms

# Acceptable ranges:
# • Session exists (found in DB): < 5ms
# • Session query hits GSI: < 10ms
# • Write new session: < 10ms
```

---

## 📋 Test Summary Table

| Test | Scenario | Expected | Status |
|------|----------|----------|--------|
| 1 | Session persists in DB | Session in DynamoDB | ☐ |
| 2 | Backend restart | User stays logged in | ☐ |
| 3 | Token refresh | Auto-refresh works | ☐ |
| 4 | Single session per device | Old session invalidated | ☐ |
| 5 | Logout endpoint | Session marked invalid | ☐ |
| 6 | Multiple devices | Web + Mobile both work | ☐ |
| 7 | Restart with multiple devices | Both stay logged in | ☐ |

---

## ✅ Success Criteria

All of the following must pass:

- [ ] **Test 2 (Main)**: Backend restart doesn't logout users
- [ ] **Test 4**: Single session enforcement works
- [ ] **Test 6**: Multiple devices can login simultaneously
- [ ] **No compile errors**: `mvn clean compile` succeeds
- [ ] **No new 401 errors**: No unexpected unauthorized responses
- [ ] **Performance acceptable**: Session validation < 5ms

---

## 🚀 Sign-Off

Once all tests pass:
- [ ] Mark implementation as **VERIFIED**
- [ ] Deploy to production
- [ ] Monitor logs for any session validation errors
- [ ] Celebrate! 🎉

---

## 📞 Troubleshooting Issues

### Issue: Always getting 401 after restart

**Diagnosis**:
1. Check: Is DynamoDB table empty?
   ```
   aws dynamodb scan --table-name chat_sessions
   ```
2. Check: Did session expire?
   ```
   Check expiresAt timestamp in DynamoDB
   ```
3. Check: Is connection to DynamoDB working?
   ```
   Check backend logs for connection errors
   ```

**Solutions**:
- [ ] Verify DynamoDB is running
- [ ] Check aws.dynamodb.endpoint config
- [ ] Check AWS credentials
- [ ] Review backend startup logs

---

### Issue: Seeing duplicate sessions in DynamoDB

**Diagnosis**:
- Old sessions not being invalidated
- Check: Is invalidateSession() being called?

**Solutions**:
- [ ] Verify logout endpoint is called
- [ ] Check SessionService.invalidateSession() logs
- [ ] Manual cleanup: update isValid to false for old sessions

---

### Issue: Getting 401 on valid token (should be 200)

**Diagnosis**:
1. Check: Is token expired?
   ```
   Decode JWT and check exp claim
   ```
2. Check: Is session in DB?
   ```
   Query DynamoDB with sessionId from token
   ```
3. Check: Is session marked invalid?
   ```
   Check isValid field in DynamoDB
   ```

**Solutions**:
- [ ] If expired: Token needs refresh
- [ ] If not in DB: Session might have been cleaned
- [ ] If invalid: Re-login required

---

End of Testing Guide ✅
