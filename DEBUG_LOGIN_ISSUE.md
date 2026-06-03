# Debug Guide - Login Issue (Đăng Nhập Rồi Lập Tức Văng)

## 🔍 Vấn đề
Bạn **đăng nhập thành công** nhưng **lập tức bị văng** (logout).

Điều này có nghĩa: **Session validation fail** ngay lần request đầu tiên sau login.

## 🔧 What I Did
Tôi đã thêm **debug logging** rất chi tiết để xem chuyên gì:

```java
// Trong createSession():
log.info("📌 New session object created:");
log.info("   sessionId: {sessionId}");
log.info("   userId: {userId}");
log.info("   expiresAt: {expiresAt}");
✅ Session saved to DynamoDB

// Trong isValidSession():
log.info("=== Validating session: {sessionId}");
log.error("❌ Session {sessionId} NOT FOUND");  // Nếu không tìm thấy
log.error("❌ Session expired: now={}, expiresAt={}");  // Nếu hết hạn
✅ Session validation SUCCESS
```

## 🚀 Để Test & Debug

### Step 1: Rebuild
```bash
cd backend
mvn clean compile
```

### Step 2: Run với spring-boot:run
```bash
mvn spring-boot:run
```

**Check logs khi server start:**
```
Creating DynamoDB Table: chat_sessions
Server started on port 8080
```

### Step 3: Đăng Nhập & Capture Logs

**Khi đăng nhập, tìm logs:**

```
🔵 Creating new session for userId: user-123, deviceType: web
📌 New session object created:
   sessionId: abc-123-xyz
   userId: user-123
   deviceType: web
   isValid: true
   expiresAt: 1717418400000 (timestamp)
   createdAt: 1717332000000
✅ Session saved to DynamoDB: abc-123-xyz (web) for user: user-123
```

**Expected**: Tất cả logs trên phải appear ✅

### Step 4: Làm API Request Đầu Tiên

**Sau khi login successful, mobile/web sẽ make API request (ví dụ: get conversations)**

**Tìm logs:**
```
=== Validating session: abc-123-xyz for userId: user-123
✅ Session found: userId=user-123, isValid=true, expiresAt=1717418400000
✅ Session validation SUCCESS for abc-123-xyz
```

**Expected**: Validation SUCCESS ✅

---

## ❌ Nếu Bạn Thấy Logs Này = PROBLEM!

### Problem 1: Session NOT saved to DB
```
🔵 Creating new session for userId: user-123
❌ Failed to create session: {error_message}
```

**Cause**: DynamoDB connection issue  
**Solution**: Check DynamoDB is running/accessible

---

### Problem 2: Session NOT found in DB
```
=== Validating session: abc-123-xyz for userId: user-123
❌ Session abc-123-xyz NOT FOUND in database
```

**Cause**: Session not saved, or using wrong table  
**Solution**: 
- Check if table `chat_sessions` exists
- Check if session was saved (see Problem 1)

---

### Problem 3: Session expiresAt is NULL
```
=== Validating session: abc-123-xyz
✅ Session found: userId=user-123, isValid=true, expiresAt=NULL
❌ Session expiresAt is NULL!
```

**Cause**: Corrupted data in DB  
**Solution**: Clear DynamoDB table and login again

---

### Problem 4: Session expired immediately
```
=== Validating session: abc-123-xyz
❌ Session expired: now=1717332001000, expiresAt=1717332000000, diff=1 ms
```

**Cause**: expiresAt set to past time  
**Solution**: 
- System time wrong?
- Session.create() has bug?

---

## 📋 Step-by-Step Testing

### Test Flow:

```
1. Start backend
   ✓ mvn spring-boot:run
   
2. Login from mobile/web
   ✓ See: "✅ Session saved to DynamoDB"
   
3. Make API request (browse conversations)
   ✓ See: "✅ Session validation SUCCESS"
   
4. If you see ❌ logs:
   ✓ Screenshot & share with me
   
5. Copy exact ❌ error message from logs
```

---

## 🎯 How to Get Logs

### Option 1: Console Output
```bash
# Run with mvn spring-boot:run
# Logs appear directly in terminal
# Copy/screenshot the logs
```

### Option 2: From File
```bash
# Logs are also saved to file
tail -100 logs/chat-app.log | grep -i "session\|validat\|🔵\|✅\|❌"

# Windows PowerShell
Get-Content logs/chat-app.log -Tail 100 | Select-String -Pattern "session|validat|blue|check|x"
```

---

## 💡 Common Issues & Quick Fixes

### Issue: "Session sessionId NOT FOUND"
→ **Solution**: Session not being saved to DB
→ **Check**: Is DynamoDB table `chat_sessions` existing?
→ **Action**: Restart backend, let it auto-create table

### Issue: "Session expired"
→ **Solution**: Timestamp issue
→ **Check**: Is system time correct?
→ **Action**: Set system time correctly

### Issue: "expiresAt is NULL"
→ **Solution**: Database corruption or bug
→ **Check**: Check Session.create() logic
→ **Action**: Clear DB and re-login

### Issue: "Session userId mismatch"
→ **Solution**: Wrong user ID in token vs DB
→ **Check**: Verify JWT token has correct userId
→ **Action**: Re-login fresh

---

## 📲 What You Need to Do RIGHT NOW

1. **Compile with new debug logging**
   ```bash
   mvn clean compile
   ```

2. **Run backend**
   ```bash
   mvn spring-boot:run
   ```

3. **Login and capture logs**
   - Keep terminal visible
   - Screenshot or copy logs

4. **Share with me**
   - What logs do you see after login?
   - Do you see "✅ Session saved"?
   - Do you see "❌ Session validation FAILED"?
   - What's the exact error message?

---

## 🔗 Files Modified

- `SessionService.java` - Added detailed debug logging

---

## 🎯 Expected Behavior

```
LOGIN FLOW:
─────────────

1. User clicks Login
   Backend: 🔵 Creating new session
   Backend: 📌 New session object created
   Backend: ✅ Session saved to DynamoDB
   
2. Frontend gets token
   Frontend: Stores accessToken, refreshToken

3. Frontend makes API request
   Backend: === Validating session: {id}
   Backend: ✅ Session found
   Backend: ✅ Session validation SUCCESS
   
4. Request succeeds
   Frontend: Shows data ✅
   
CURRENT BROKEN BEHAVIOR:
──────────────────────

1. User clicks Login
   Backend: ✅ Session saved ← SUCCESS
   
2. Frontend makes request
   Backend: ❌ Session NOT FOUND ← FAILURE
   Frontend: Gets 401 → Logout
   
GOAL: Make step 2 show SUCCESS ✅
```

---

## 🚀 Next Steps

1. **Compile**: `mvn clean compile`
2. **Run**: `mvn spring-boot:run`
3. **Test**: Login
4. **Check**: Logs for ✅ or ❌ messages
5. **Share**: The logs with me

I'll help you fix it once I see the exact error! 🔧
