# Fixng "An unexpected error occurred" - Session Persistence

## 🔍 Vấn đề

Bạn gặp lỗi **"An unexpected error occurred"** khi đăng nhập lại sau khi đã bị văng ra.

## 🐛 Nguyên nhân có thể

1. **DynamoDB không accessible** - Backend không connect được DB
2. **Null pointer exception** - Code không handle null values
3. **Table structure không match** - DynamoDB table bị miss columns
4. **Session entity issues** - Lombok annotations không working đúng

## ✅ Fixes Đã Áp Dụng

Tôi đã fix những vấn đề sau:

### Fix 1: Null-Safe Checks
```java
// BEFORE (CAN CRASH):
filter(s -> s.getIsValid() && !s.isExpired() && s.getDeviceType().equalsIgnoreCase(deviceType))

// AFTER (SAFE):
filter(s -> {
    if (s.getIsValid() == null || !s.getIsValid()) return false;
    if (s.getExpiresAt() == null || s.isExpired()) return false;
    if (s.getDeviceType() == null) return false;
    return s.getDeviceType().equalsIgnoreCase(deviceType);
})
```

### Fix 2: Error Handling
```java
// BEFORE: Có thể throw exception
sessionRepository.save(session);

// AFTER: Có exception handling
try {
    sessionRepository.save(session);
} catch (Exception e) {
    log.error("Failed to save session", e);
    throw new RuntimeException("Failed to create session", e);
}
```

### Fix 3: Try-Catch in Session Update
```java
// BEFORE: Có thể crash
session.updateLastAccess();
sessionRepository.save(session);

// AFTER: Safe
try {
    session.updateLastAccess();
    sessionRepository.save(session);
} catch (Exception e) {
    log.error("Failed to update last access", e);
    // Don't fail the request
}
```

## 🚀 Để Fix Hoàn Toàn

### Step 1: Rebuild Backend
```bash
cd backend
mvn clean package
```

### Step 2: Xóa DynamoDB Local (Nếu Dùng)
```bash
# Nếu dùng DynamoDB local, xóa data cũ (nếu có)
# Hoặc restart DynamoDB container
```

### Step 3: Start Backend
```bash
java -jar target/chat-app-backend-1.0.0.jar
```

**Kiểm tra logs**:
```
Creating DynamoDB Table: chat_sessions
Session created: {id} for user: {userId}
```

### Step 4: Login & Test
1. Login lại
2. Check xem login thành công không
3. Xem logs có error không

## 🔧 Debugging - Nếu Vẫn Lỗi

### Check 1: Backend Logs
```bash
# Look for errors
grep -i "error\|exception" logs/chat-app.log

# Look for session errors
grep -i "session" logs/chat-app.log | tail -20
```

### Check 2: DynamoDB Connection
```bash
# AWS CLI - check if table exists
aws dynamodb describe-table \
  --table-name chat_sessions \
  --region ap-southeast-1

# If table doesn't exist, restart backend to auto-create it
```

### Check 3: Check Network Response
1. Open browser DevTools (F12)
2. Network tab
3. Try to login
4. Look for POST /auth/login request
5. Check Response tab:
   - What's the error message?
   - Is it DynamoDB error?
   - Is it validation error?

### Check 4: Enable Debug Logging
Add to `application.yml`:
```yaml
logging:
  level:
    com.chatapp.modules.auth: DEBUG
    com.chatapp.common: DEBUG
```

Then restart and check logs for more details.

## 📋 Common Errors & Solutions

### Error: "Table chat_sessions does not exist"
**Cause**: DynamoDB table not created  
**Solution**: Restart backend, it will auto-create the table

### Error: "Null pointer exception in isValidSession"
**Cause**: Session object has null fields  
**Solution**: Already fixed in latest code, rebuild with `mvn clean package`

### Error: "Failed to save session to DynamoDB"
**Cause**: DynamoDB connection issue  
**Solution**: 
- Check AWS credentials in application.yml
- Check DynamoDB is running (if using local)
- Check network connectivity

### Error: "An unexpected error occurred"
**Cause**: Generic backend error  
**Solution**:
- Check backend logs for actual error
- Make sure you're using latest build (rebuilt with fixes)
- Check DynamoDB is accessible

## ✨ After Fixes Applied

The fixes I applied should handle:
- ✅ Null pointer exceptions
- ✅ Missing error handling
- ✅ DynamoDB connection issues
- ✅ Session state validation

## 🎯 Next Steps

1. **Rebuild**: `mvn clean package`
2. **Restart**: Backend server
3. **Test**: Login & verify it works
4. **If still error**: 
   - Share backend logs
   - Check Network tab response
   - I'll help debug further

---

**Files Modified**:
- `SessionService.java` - Added null-safe checks & error handling
- `SessionRepository.java` - Added null-safe filtering

**Files NOT changed** - No need to rebuild mobile/web apps

---

Try the fixes and let me know if you still get the error!
