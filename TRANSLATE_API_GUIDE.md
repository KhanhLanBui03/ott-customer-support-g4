# Hướng Dẫn Tích Hợp API Dịch Tin Nhắn cho Frontend

Tài liệu này mô tả cách sử dụng các API backend để triển khai tính năng dịch tin nhắn trong giao diện người dùng.

---

## 1. Dịch Một Tin Nhắn Đơn Lẻ

Chức năng này được sử dụng khi người dùng nhấn vào một tin nhắn cụ thể để yêu cầu dịch.

-   **Endpoint:** `POST /api/v1/messages/{messageId}/translate`
-   **Phương thức:** `POST`
-   **Mô tả:** Gửi yêu cầu dịch cho một tin nhắn duy nhất dựa vào ID của nó.
-   **Tham số trên URL:**
    -   `messageId` (string, required): ID của tin nhắn cần dịch.
-   **Body của Request (JSON):**

    ```json
    {
      "conversationId": "string",
      "srcLang": "string",
      "tgtLang": "string"
    }
    ```

    -   `conversationId` (string, required): ID của cuộc hội thoại chứa tin nhắn.
    -   `srcLang` (string, required): Mã ngôn ngữ nguồn (ví dụ: `"vie_Latn"` cho Tiếng Việt).
    -   `tgtLang` (string, required): Mã ngôn ngữ đích (ví dụ: `"eng_Latn"` cho Tiếng Anh).

-   **Response thành công (200 OK):**

    ```json
    {
      "success": true,
      "message": "Message translated successfully",
      "data": {
        "messageId": "abc-123",
        "original": "Chào bạn, bạn khỏe không?",
        "translated": "Hello, how are you?",
        "srcLang": "vie_Latn",
        "tgtLang": "eng_Latn"
      }
    }
    ```

    -   **Logic FE:** Cập nhật giao diện của tin nhắn có `messageId` tương ứng để hiển thị cả nội dung `original` và `translated`.

-   **Response khi quá thời gian (Timeout):**
    Backend sẽ trả về nội dung gốc nếu quá trình dịch mất quá 60 giây.

    ```json
    {
      "success": true,
      "message": "Translation timeout, returned original",
      "data": {
        "messageId": "abc-123",
        "original": "Chào bạn, bạn khỏe không?",
        "translated": "Chào bạn, bạn khỏe không?",
        "srcLang": "vie_Latn",
        "tgtLang": "eng_Latn"
      }
    }
    ```

    -   **Logic FE:** Có thể hiển thị một thông báo nhỏ như "Dịch thất bại, vui lòng thử lại" bên cạnh tin nhắn.

---

## 2. Dịch Hàng Loạt Tin Nhắn (Dịch Toàn Bộ Hội Thoại)

Chức năng này được sử dụng khi người dùng muốn dịch toàn bộ các tin nhắn đang hiển thị trên màn hình. Đây là cách được khuyến khích để tối ưu hiệu suất.

-   **Endpoint:** `POST /api/v1/messages/translate-batch`
-   **Phương thức:** `POST`
-   **Mô tả:** Gửi một danh sách các ID tin nhắn để dịch chúng trong một lần gọi API duy nhất.
-   **Body của Request (JSON):**

    ```json
    {
      "conversationId": "string",
      "messageIds": [
        "id_tin_nhan_1",
        "id_tin_nhan_2",
        "id_tin_nhan_3"
      ],
      "srcLang": "string",
      "tgtLang": "string"
    }
    ```

    -   `messageIds` (array of strings, required): Mảng chứa ID của tất cả các tin nhắn cần dịch.

-   **Response thành công (200 OK):**

    ```json
    {
      "success": true,
      "message": "Messages translated successfully",
      "data": {
        "id_tin_nhan_1": "Translated text for message 1",
        "id_tin_nhan_2": "Translated text for message 2",
        "id_tin_nhan_3": "Translated text for message 3"
      }
    }
    ```

    -   **Logic FE:**
        1.  Lặp qua đối tượng `data` trong response.
        2.  `key` của mỗi cặp `key-value` chính là `messageId`.
        3.  `value` là nội dung đã được dịch.
        4.  Cập nhật giao diện cho từng tin nhắn tương ứng với `messageId`.

---

## Lưu ý quan trọng cho Frontend

-   **Xác thực:** Tất cả các API trên đều yêu cầu người dùng đã đăng nhập. Cần gửi `Authorization: Bearer <token>` trong header của mỗi request.
-   **Quản lý trạng thái:** Nên có một trạng thái (state) trong component để lưu các bản dịch, ví dụ: `const [translations, setTranslations] = useState({});` với key là `messageId` và value là bản dịch.
-   **Trải nghiệm người dùng:** Khi đang chờ API dịch, nên hiển thị một chỉ báo loading (spinner) bên cạnh tin nhắn hoặc trên nút "Dịch" để người dùng biết hệ thống đang xử lý.
-   **Mã ngôn ngữ:** Danh sách các mã ngôn ngữ được hỗ trợ (ví dụ: `vie_Latn`, `eng_Latn`, `fra_Latn`, `jpn_Jpan`...) cần được thống nhất giữa backend và frontend.
