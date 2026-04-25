# API Test Guide for Postman

## 1. Register API
**Endpoint:** `POST http://localhost:8080/api/v1/auth/register`

**Request Headers:**
```
Content-Type: application/json
```

**Request Body (JSON):**
```json
{
  "phoneNumber": "0901234567",
  "email": "test@example.com",
  "password": "password123",
  "confirmPassword": "password123",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Validation Rules:**
- `phoneNumber`: Must match pattern `^0\d{9}$` (e.g., 0XXXXXXXXX)
- `email`: Valid email format
- `password`: At least 8 characters
- `confirmPassword`: Must match password
- `firstName`: 2-50 characters
- `lastName`: 2-50 characters

**Expected Response (201/200):**
```json
{
  "data": {
    "email": "test@example.com",
    "otpRequired": true
  },
  "success": true
}
```

---

## 2. Send OTP API
**Endpoint:** `POST http://localhost:8080/api/v1/auth/send-otp?email=test@example.com&purpose=REGISTRATION`

**Query Parameters:**
- `email`: The email address
- `purpose`: (optional, default: "GENERAL") - Examples: `REGISTRATION`, `FORGOT_PASSWORD`, `LOGIN`

⚠️ **Important:** 
- Use `purpose=REGISTRATION` when verifying OTP with `/verify-otp` endpoint
- Use `purpose=FORGOT_PASSWORD` when resetting password

**Expected Response:**
```json
{
  "data": "OTP sent successfully",
  "message": "123456",
  "success": true
}
```
*Note: The OTP is returned in `message` field for development testing*

---

## 3. Verify OTP API
**Endpoint:** `POST http://localhost:8080/api/v1/auth/verify-otp`

**Request Body (JSON):**
```json
{
  "email": "test@example.com",
  "otpCode": "123456",
  "purpose": "REGISTRATION"
}
```

⚠️ **Important:** 
- `purpose` must match the purpose used in Step 2 when sending OTP
- Examples: `REGISTRATION`, `FORGOT_PASSWORD`
- If not provided, defaults to `REGISTRATION`

**Expected Response:**
```json
{
  "data": {
    "userId": "uuid-string",
    "phoneNumber": "0901234567",
    "firstName": "John",
    "lastName": "Doe",
    "email": "test@example.com",
    "avatarUrl": null,
    "bio": null,
    "accessToken": "jwt-token",
    "refreshToken": "jwt-token",
    "tokenType": "Bearer",
    "expiresIn": 86400000,
    "sessionId": "session-uuid"
  },
  "success": true
}
```

---

## 4. Login API
**Endpoint:** `POST http://localhost:8080/api/v1/auth/login`

**Request Body (JSON):**
```json
{
  "email": "test@example.com",
  "password": "password123"
}
```

**Expected Response:**
```json
{
  "data": {
    "userId": "uuid-string",
    "phoneNumber": "0901234567",
    "firstName": "John",
    "lastName": "Doe",
    "email": "test@example.com",
    "avatarUrl": null,
    "bio": null,
    "accessToken": "jwt-token",
    "refreshToken": "jwt-token",
    "tokenType": "Bearer",
    "expiresIn": 86400000,
    "sessionId": "session-uuid"
  },
  "message": "Login successful",
  "success": true
}
```

---

## 5. Refresh Token API
**Endpoint:** `POST http://localhost:8080/api/v1/auth/refresh`

**Request Body (JSON):**
```json
{
  "refreshToken": "your-refresh-token-here",
  "deviceId": "device-001"
}
```

**Expected Response:**
```json
{
  "data": {
    "accessToken": "new-jwt-token",
    "refreshToken": "new-refresh-token",
    "tokenType": "Bearer",
    "expiresIn": 86400000,
    "sessionId": "session-uuid"
  },
  "message": "Token refreshed successfully",
  "success": true
}
```

---

## 6. Check User Status API
**Endpoint:** `POST http://localhost:8080/api/v1/auth/check`

**Request Body (JSON):**
```json
{
  "phoneNumber": "0901234567"
}
```

**Expected Response (User exists and verified):**
```json
{
  "data": {
    "exists": true,
    "verified": true,
    "phoneNumber": "0901234567",
    "firstName": "John",
    "lastName": "Doe"
  },
  "message": "User status checked",
  "success": true
}
```

**Expected Response (User does not exist):**
```json
{
  "data": {
    "exists": false,
    "verified": false,
    "phoneNumber": "0901234567"
  },
  "message": "User status checked",
  "success": true
}
```

---

## 7. Logout API
**Endpoint:** `POST http://localhost:8080/api/v1/auth/logout`

**Request Headers:**
```
X-Session-Id: your-session-id
X-User-Id: your-user-id
Content-Type: application/json
```

**Request Body:**
```json
{}
```

**Expected Response:**
```json
{
  "data": null,
  "message": "Logout successful",
  "success": true
}
```

---

## 8. Forgot Password API
**Endpoint:** `POST http://localhost:8080/api/v1/auth/forgot-password`

**Request Body (JSON):**
```json
{
  "email": "test@example.com"
}
```

**Expected Response:**
```json
{
  "data": {
    "email": "test@example.com",
    "devOtp": "123456"
  },
  "message": "OTP sent successfully",
  "success": true
}
```

---

## 9. Reset Password API
**Endpoint:** `POST http://localhost:8080/api/v1/auth/reset-password`

**Request Body (JSON):**
```json
{
  "email": "test@example.com",
  "otpCode": "123456",
  "newPassword": "newpassword123"
}
```

**Expected Response:**
```json
{
  "data": null,
  "message": "Password reset successfully",
  "success": true
}
```

---

## 10. Update Conversation Wallpaper API
**Endpoint:** `PUT http://localhost:8080/api/v1/conversations/{conversationId}/wallpaper`

**Request Headers:**
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Request Body (JSON):**
```json
{
  "wallpaperUrl": "https://example.com/wallpaper.jpg"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Wallpaper updated successfully",
  "data": null
}
```

**WebSocket Events (automatically broadcasted to all members):**
- `WALLPAPER_UPDATED` - Contains wallpaperUrl
- `CONVERSATION_UPDATE` - Full conversation details with new wallpaperUrl

**Flow:**
1. Upload image using media API (or external URL)
2. Call this endpoint with wallpaperUrl
3. All members instantly receive `WALLPAPER_UPDATED` event via WebSocket
4. Frontend updates background for all members in that conversation

---

## API Workflow: Full Wallpaper Update Flow

### Step 1: (Optional) Upload background image
```
POST http://localhost:8080/api/v1/media/upload
[multipart form-data with image file]
Response: { "mediaUrl": "https://s3.example.com/image.jpg" }
```

### Step 2: Update conversation wallpaper
```
PUT http://localhost:8080/api/v1/conversations/{conversationId}/wallpaper
{
  "wallpaperUrl": "https://s3.example.com/image.jpg"
}
```

### Step 3: WebSocket automatically broadcasts
All members in conversation receive:
```
Event: WALLPAPER_UPDATED
Data: { "wallpaperUrl": "https://s3.example.com/image.jpg" }
```

### Step 4: Frontend updates UI
Update background image in chat UI for all members instantly!

---

## Test Flow Example

⚠️ **Important:** You must complete the registration and OTP verification flow FIRST before you can login!

### Step 1: Register a new user
```
POST http://localhost:8080/api/v1/auth/register
{
  "phoneNumber": "0901234567",
  "email": "test@example.com",
  "password": "password123",
  "confirmPassword": "password123",
  "firstName": "John",
  "lastName": "Doe"
}
```
Response: `{ "data": { "email": "test@example.com", "otpRequired": true }, "success": true }`

### Step 2: Send OTP (for Registration)
```
POST http://localhost:8080/api/v1/auth/send-otp?email=test@example.com&purpose=REGISTRATION
```
*Copy the OTP from response's `message` field*

### Step 3: Verify OTP (This will mark email as verified AND auto-login you)
```
POST http://localhost:8080/api/v1/auth/verify-otp
{
  "email": "test@example.com",
  "otpCode": "PASTE_OTP_HERE",
  "purpose": "REGISTRATION"
}
```
✅ Success! You'll get accessToken and sessionId
⚠️ Email is now verified and you're logged in!

### Step 4: Login with email & password (for subsequent logins)
```
POST http://localhost:8080/api/v1/auth/login
{
  "email": "test@example.com",
  "password": "password123"
}
```
✅ Success! You'll get new accessToken and sessionId

### Step 5: Test authenticated endpoint
Use the `accessToken` from login response in Authorization header:
```
Authorization: Bearer YOUR_ACCESS_TOKEN
X-User-Id: YOUR_USER_ID
X-Session-Id: YOUR_SESSION_ID
```

---

## Common Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| OTP invalid or expired | Wrong OTP, expired (>5 min), or purpose mismatch | Request a new OTP with correct purpose & verify within 5 minutes |
| Email is not verified | Email hasn't been verified via OTP | Complete OTP verification flow in Step 3 first |
| Phone number invalid | Wrong format | Use format: 0XXXXXXXXX (11 digits starting with 0) |
| Email already registered | User exists and is verified | Use a different email |
| Password too short | < 8 characters | Use at least 8 characters |
| Passwords don't match | confirmPassword != password | Make sure both match exactly |

---

## Notes

✅ **Development Mode:** OTP is returned in the response for easy testing  
✅ **Email sending:** Uses Gmail SMTP (configured in application.yml)  
✅ **No Redis required:** Uses in-memory storage  
✅ **JWT tokens expire:** Access token valid for 24 hours
