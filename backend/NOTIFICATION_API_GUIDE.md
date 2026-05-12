# Notification API Usage Guide

## 1. Tạo Notification

**Endpoint:**
```
POST /api/notifications/create
```
**Request Body (JSON):**
```
{
  "senderId": "string",
  "receiverId": "string",
  "type": "FRIEND_REQUEST", // hoặc FRIEND_ACCEPTED, MESSAGE, OTHER
  "message": "string"
}
```
**Response:**
- Trả về thông tin notification vừa tạo (id, senderId, receiverId, type, message, isRead, createdAt)

## 2. Lấy danh sách Notification theo receiverId

**Endpoint:**
```
GET /api/notifications/receiver/{receiverId}
```
**Response:**
- Trả về danh sách notification của receiverId

## 3. Lấy danh sách Notification theo senderId

**Endpoint:**
```
GET /api/notifications/sender/{senderId}
```
**Response:**
- Trả về danh sách notification mà senderId là người gửi

## 4. Đánh dấu notification đã đọc (gợi ý, cần bổ sung endpoint nếu chưa có)

**Endpoint:**
```
PUT /api/notifications/update/isread
```
**Request Body:**
- Thường là notificationId hoặc receiverId + trạng thái isRead

## 5. Xóa notification (gợi ý, cần bổ sung endpoint nếu chưa có)

**Endpoint:**
```
DELETE /api/notifications/delete
```
**Request Body:**
- notificationId

---

## Enum NotificationType
- FRIEND_REQUEST
- FRIEND_ACCEPTED
- MESSAGE
- OTHER

## Lưu ý
- Các trường đều là bắt buộc, type phải đúng với enum NotificationType.
- Nếu truyền thiếu hoặc sai định dạng sẽ trả về lỗi 400.
- Các endpoint trả về chuẩn RESTful, bọc trong ApiResponse.

## Ví dụ tạo notification (Postman)
```
POST http://localhost:8080/api/notifications/create
Content-Type: application/json

{
  "senderId": "user123",
  "receiverId": "user456",
  "type": "FRIEND_REQUEST",
  "message": "user123 đã gửi lời mời kết bạn cho bạn."
}
```

## Ví dụ lấy danh sách notification theo receiverId
```
GET http://localhost:8080/api/notifications/receiver/user456
```

## Ví dụ lấy danh sách notification theo senderId
```
GET http://localhost:8080/api/notifications/sender/user123
```

---
Nếu cần bổ sung endpoint hoặc ví dụ cụ thể, hãy liên hệ nhóm phát triển.
