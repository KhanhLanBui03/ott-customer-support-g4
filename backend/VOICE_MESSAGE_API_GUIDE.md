# API Guide: Gửi và Nhận Tin Nhắn Ghi Âm (Voice Message)

## 1. Upload file ghi âm (voice record)

**Endpoint:**
`POST /api/v1/media/upload`

**Mô tả:**
Upload file ghi âm (audio) lên server, nhận về URL để gửi kèm tin nhắn.

**Request:**
- Loại: `multipart/form-data`
- Tham số:
  - `file`: (File) file audio (ví dụ: .m4a, .mp3, .wav)
  - `folder`: (String, optional) thư mục lưu trữ, nên để là `voice`

**Ví dụ với Postman:**
- Chọn Body → form-data
  - Key: `file` (type: File) → chọn file ghi âm
  - Key: `folder` (type: Text) → `voice`

**Response:**
```json
{
  "success": true,
  "data": {
    "url": "https://.../voice/abc123.m4a",
    "fileName": "abc123.m4a"
  },
  "message": "File uploaded successfully"
}
```

---

## 2. Gửi tin nhắn ghi âm

**Endpoint:**
`POST /api/v1/messages/send`

**Mô tả:**
Gửi tin nhắn thoại, sử dụng URL file audio vừa upload.

**Request:**
- Loại: `application/json`
- Header: `Authorization: Bearer <token>`
- Body:
```json
{
  "conversationId": "string",         // ID cuộc trò chuyện
  "content": "",                      // Để rỗng hoặc mô tả ngắn
  "type": "VOICE",                    // Loại tin nhắn
  "mediaUrls": ["<audio_url>"],       // Mảng URL file audio vừa upload
  "replyToMessageId": null,           // (optional) ID tin nhắn trả lời
  "isEncrypted": false,               // (optional)
  "forwardedFrom": null               // (optional)
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    // Thông tin tin nhắn vừa gửi, bao gồm mediaUrls
  },
  "message": "Message sent successfully"
}
```

---

## 3. Hiển thị & phát lại tin nhắn ghi âm

- Lấy danh sách tin nhắn qua API `/api/v1/messages/{conversationId}`.
- Nếu `type == "VOICE"` và `mediaUrls` có giá trị, frontend hiển thị nút play audio, sử dụng URL trong `mediaUrls[0]`.

---

## 4. Lưu ý

- File audio phải gửi qua multipart/form-data, không truyền path file qua URL.
- Đảm bảo gửi đúng endpoint `/api/v1/messages/send` (số nhiều).
- Đừng quên gửi Authorization header nếu API yêu cầu xác thực.

---

Nếu cần ví dụ code (JS, Java, Python) hoặc hướng dẫn test cụ thể bằng Postman/curl, hãy liên hệ để được hỗ trợ thêm.
