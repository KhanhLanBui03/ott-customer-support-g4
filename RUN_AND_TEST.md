# Run & Test - Session Fix Debugging

## 🚀 How to Test RIGHT NOW

### Step 1: Stop Current Backend
```powershell
# In the terminal running backend:
Ctrl + C
```

### Step 2: Recompile (With NEW Debug Logging)
```powershell
cd backend
mvn clean compile
```

### Step 3: Run Backend with Spring Boot Plugin
```powershell
mvn spring-boot:run
```

**Wait for:**
```
[INFO] Started ChatAppApplication in X seconds
[INFO] Tomcat started on port(s): 8080
```

### Step 4: DON'T CLOSE TERMINAL!
Keep the backend terminal visible so you can see logs.

### Step 5: Login from Mobile/Web

**When you login, watch the backend terminal for logs:**

```
🔵 Creating new session for userId: user-456, deviceType: web
📌 New session object created:
   sessionId: abc-123-def-456
   userId: user-456
   deviceType: web
   isValid: true
   expiresAt: 1717418400000
   createdAt: 1717332000000
💾 Saving session to DynamoDB: sessionId=abc-123-def-456, userId=user-456, sk=active
✅ Session saved successfully: abc-123-def-456
✅ Session saved to DynamoDB: abc-123-def-456 (web) for user: user-456 (expires: 1717418400000)
```

**Expected: You should see ALL these logs ✅**

### Step 6: Make First API Request After Login

**After successful login, mobile/web will make an API request (like GET /api/conversations)**

**Watch for:**
```
=== Validating session: abc-123-def-456 for userId: user-456
✅ Session found: userId=user-456, isValid=true, expiresAt=1717418400000
✅ Session validation SUCCESS for abc-123-def-456
```

**Expected: You should see "✅ Session validation SUCCESS" ✅**

### Step 7: If Everything Shows ✅

**Then:**
- ✅ You should see conversations on app
- ✅ You should NOT be logged out
- ✅ **THE FIX WORKS!**

### Step 8: If You See ❌ Error Logs

**Important:**
- **Take screenshot of the ❌ error logs**
- **Copy the exact error message**
- **Share with me**

---

## 📊 What Logs Mean

### Logs During Login (Step 5)

| Log | Meaning |
|-----|---------|
| 🔵 Creating new session | Session creation started |
| 📌 New session object created | Session object built |
| 💾 Saving session to DynamoDB | About to save to DB |
| ✅ Session saved successfully | Saved OK |
| ✅ Session saved to DynamoDB | Final confirmation |

**If any ❌ appears here**: Database save failed

---

### Logs During API Request (Step 6)

| Log | Meaning |
|-----|---------|
| === Validating session | Checking if session exists & valid |
| ✅ Session found | Found in DB |
| ✅ Session validation SUCCESS | All checks passed |

**If any ❌ appears here**: Session validation failed

---

## ❌ Common ❌ Logs You Might See

### ❌ "Session {id} NOT FOUND in database"
```
=== Validating session: abc-123
❌ Session abc-123 NOT FOUND in database
```
**Means**: Session not saved, or DB query failed  
**Next**: Check if "✅ Session saved successfully" appeared before

### ❌ "Session expiresAt is NULL"
```
✅ Session found
❌ Session expiresAt is NULL!
```
**Means**: expiresAt not set in DB  
**Next**: Check "📌 New session object created" logs for expiresAt value

### ❌ "Session expired"
```
❌ Session expired: now=1717332001000, expiresAt=1717332000000
```
**Means**: expiresAt is in the past  
**Next**: Check system time, or Session.create() logic

### ❌ "Failed to save session"
```
❌ Failed to save session abc-123: {error}
```
**Means**: DynamoDB save failed  
**Next**: Check DynamoDB connection, AWS credentials

---

## 🔍 How to Copy Logs

### Option 1: Copy from Terminal
```
1. Terminal running mvn spring-boot:run
2. Right-click on terminal
3. Select all text (Ctrl+A)
4. Copy (Ctrl+C)
5. Paste into document
```

### Option 2: From Log File
```powershell
# Get last 100 lines with session logs
Get-Content backend/logs/chat-app.log -Tail 100 | `
  Select-String -Pattern "session|validat|🔵|✅|❌|💾" | `
  Tee-Object -FilePath "session_logs.txt"

# File will be saved as session_logs.txt
```

### Option 3: Filter Just Errors
```powershell
# Get only error logs
Get-Content backend/logs/chat-app.log | `
  Select-String -Pattern "❌|ERROR|Exception" | `
  Tee-Object -FilePath "error_logs.txt"
```

---

## 📋 Checklist

Before testing:
- [ ] Backend stopped (Ctrl+C)
- [ ] Recompiled (`mvn clean compile`)
- [ ] Ready to run (`mvn spring-boot:run`)

During testing:
- [ ] Backend terminal visible
- [ ] Mobile/Web app ready
- [ ] Screenshot ready to take
- [ ] Ready to copy logs

After testing:
- [ ] Note all ✅ or ❌ logs
- [ ] Screenshot or copy logs
- [ ] Share with me

---

## 🎯 MOST IMPORTANT

**When you test, please tell me:**

1. **Do you see "✅ Session saved successfully"?**
   - YES → Good, session is in DB
   - NO → Database save failed

2. **Do you see "✅ Session validation SUCCESS"?**
   - YES → Success! The fix works!
   - NO → Session validation failed, share the ❌ error

3. **What's the exact ❌ error message?**
   - Copy it exactly
   - Include context (a few lines before and after)

---

## 🚀 Quick Test Summary

```
RUN → LOGIN → WATCH LOGS → REPORT RESULTS

1. Run: mvn spring-boot:run
2. Login: Use mobile/web app
3. Watch: Backend terminal logs
4. Report: What ✅ or ❌ you see
5. Share: Screenshots of logs if ❌
```

**That's it! Let's debug this together!** 💪
