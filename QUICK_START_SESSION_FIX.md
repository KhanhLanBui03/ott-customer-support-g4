# Quick Start - Session Persistence Fix

## ✅ Thay Đổi Nào Được Thực Hiện?

### Files Tạo Mới:
1. **`backend/src/main/java/com/chatapp/modules/auth/domain/Session.java`**
   - DynamoDB entity cho sessions
   - Tự động tạo table `chat_sessions`

2. **`backend/src/main/java/com/chatapp/modules/auth/repository/SessionRepository.java`**
   - Repository để query sessions từ DynamoDB
   - Methods: findById, findByUserId, save, delete, etc.

### Files Sửa:
3. **`backend/src/main/java/com/chatapp/modules/auth/service/SessionService.java`**
   - Thay thế in-memory ConcurrentHashMap bằng DynamoDB
   - Inject SessionRepository
   - Core logic giữ nguyên (same method signatures)

---

## 🚀 Để Sử Dụng

### 1. Build Backend (Để tạo DynamoDB table)
```bash
cd backend
mvn clean compile
# or
mvn clean package
```

**Output**: BUILD SUCCESS ✅

### 2. Chạy Backend
```bash
# Đảm bảo DynamoDB local hoặc AWS credentials được setup
# Table `chat_sessions` sẽ tự động được tạo trên startup

java -jar target/chat-app-backend-1.0.0.jar
```

**Logs sẽ hiển thị**:
```
Creating DynamoDB Table: chat_sessions
Successfully requested creation of table: chat_sessions
Session created: {sessionId} (web/mobile) for user: {userId}
```

### 3. Test Login
```bash
# Login từ web/mobile
# ✅ User được authenticated

# ✅ Backend logs show:
# "Session created: abc-123 (web) for user: user-456 (expires: ...)"
# Session được lưu vào DynamoDB
```

### 4. Restart Backend (Main Test!)
```bash
# Kill backend (Ctrl+C)
# Tất cả in-memory sessions mất

# Start backend lại
java -jar target/chat-app-backend-1.0.0.jar

# ✅ Table `chat_sessions` still has sessions
```

### 5. Test User Stays Logged In
```bash
# Với token từ trước restart
# Make API call → SUCCESS ✅
# User không bị logout!

# Before fix: 401 Unauthorized → Logout
# After fix: Request successful → User continues
```

---

## 📝 Config (Không Cần Thay Đổi)

Already configured in `application.yml`:
```yaml
aws.dynamodb:
  endpoint: ${DYNAMODB_ENDPOINT:}  # local or AWS
  tables:
    sessions: chat_sessions  # ✅ Already there

# No additional config needed!
```

---

## ✨ What You'll Notice

1. ✅ Users stay logged in after backend restart
2. ✅ Same login/logout behavior
3. ✅ No changes to mobile/web code
4. ✅ No changes to API contracts
5. ✅ Sessions properly invalidated on logout

---

## 🔍 Verify It Works

### Check DynamoDB Table
```bash
# AWS CLI (if using AWS)
aws dynamodb scan --table-name chat_sessions --region ap-southeast-1

# DynamoDB Local (if using local)
aws dynamodb scan --table-name chat_sessions --endpoint-url http://localhost:8000
```

### Check Backend Logs
```bash
# Should see:
# 1. "DynamoDB Table chat_sessions already exists"
# 2. "Session created: {sessionId} for user: {userId}"
# 3. "Session validated for request: {endpoint}"
```

---

## 🐛 If Something's Wrong

### Error: "Table chat_sessions not found"
- ✅ Solution: Table auto-created on first run, check logs
- ✅ Make sure DynamoDB (local or AWS) is running

### Error: "Session not found in database"
- ✅ Solution: First login after backend restart, will create new session
- ✅ Or old session expired (24 hour TTL)

### Error: DynamoDB connection refused
- ✅ Solution: Check `aws.dynamodb.endpoint` config
- ✅ Check AWS credentials if using AWS

---

## 📊 Behavior Summary

| Scenario | Before | After |
|----------|--------|-------|
| Backend restart | ❌ User logs out | ✅ User stays logged in |
| Token expired | ❌ Manual login needed | ✅ Auto-refresh works |
| Refresh token valid | ❌ Needs re-login | ✅ Can refresh session |
| Multiple devices | ✅ Works | ✅ Works (same) |
| Logout endpoint | ✅ Works | ✅ Works (now uses DB) |
| Session TTL | ✅ 24 hours | ✅ 24 hours (same) |

---

## 🎯 Key Points

- **No Breaking Changes**: All APIs, client code, configs unchanged
- **Backward Compatible**: Smooth transition from in-memory to DB
- **Auto-Create**: DynamoDB table created automatically
- **Transparent**: Users notice improvement, not disruption
- **Performant**: DynamoDB queries optimized with GSI

---

## ✅ Done!

Chỉ cần rebuild backend, restart server, và test!

**Result**: Users không còn bị logout khi restart backend 🎉

---

For detailed information, see: `SESSION_PERSISTENCE_FIX.md`
