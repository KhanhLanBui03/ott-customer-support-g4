# API Guide: Speech-to-Text (Voice Message Transcription)

## 1. Chuyển đổi file ghi âm thành văn bản (Speech-to-Text)

**Endpoint:**
`POST /api/v1/messages/speech-to-text`

**Mô tả:**
Nhận file audio (ghi âm) và trả về transcript (nội dung chuyển từ giọng nói sang văn bản) sử dụng OpenAI Whisper API.

**Request:**
- Loại: `multipart/form-data`
- Tham số:
  - `file`: (File) file audio (hỗ trợ: .mp3, .m4a, .wav, ...)

**Ví dụ với Postman:**
- Chọn Body → form-data
  - Key: `file` (type: File) → chọn file ghi âm

**Response:**
```json
{
  "success": true,
  "data": {
    "transcript": "nội dung chuyển từ giọng nói"
  },
  "message": "Speech-to-text success"
}
```

---

## 2. Lưu ý sử dụng
- File audio phải gửi qua multipart/form-data, không truyền path file qua URL.
- Định dạng file nên là mp3, m4a, wav, ...
- Nếu lỗi 401 Unauthorized, kiểm tra lại API key OpenAI phía backend.
- Nếu lỗi 500, kiểm tra log backend để biết chi tiết.

---

## 3. Gợi ý sử dụng ở Frontend
- Sau khi người dùng ghi âm, gửi file audio lên endpoint này để lấy transcript.
- Hiển thị transcript cho user hoặc agent để hỗ trợ xử lý nhanh hơn.
- Có thể kết hợp transcript với tin nhắn voice để tăng trải nghiệm người dùng.

---

Nếu cần ví dụ code (JS, Java, Python) hoặc hướng dẫn test cụ thể bằng Postman/curl, hãy liên hệ để được hỗ trợ thêm.

