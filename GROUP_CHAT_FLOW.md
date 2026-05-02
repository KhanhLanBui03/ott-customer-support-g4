# Tài liệu Quy trình hoạt động Chat Group (Group Chat Flow)

Tài liệu này mô tả chi tiết luồng xử lý từ phía người dùng, giao diện đến hệ thống backend cho tính năng Chat Group trong ứng dụng.

---

## 1. Quy trình Khởi tạo Nhóm (Group Creation)

1.  **Frontend**: Người dùng nhấn nút "Tạo nhóm mới" trong `Sidebar`.
2.  **Validation**: Hệ thống yêu cầu nhập tên nhóm và chọn ít nhất **2 thành viên** khác (tổng cộng tối thiểu 3 người bao gồm cả người tạo).
3.  **API Call**: Frontend gọi `POST /api/v1/conversations` với payload chứa tên nhóm, danh sách ID thành viên và `type: "GROUP"`.
4.  **Backend (Service Layer)**: 
    *   Tạo bản ghi `Conversation` mới với ID là một UUID ngẫu nhiên.
    *   Tạo các bản ghi `UserConversation` để ánh xạ từng thành viên vào nhóm.
    *   Người tạo được gán vai trò `OWNER`, những người khác là `MEMBER`.
    *   Tạo một tin nhắn hệ thống (`SYSTEM`) thông báo: *"X đã tạo nhóm."*
5.  **Real-time Update**: Backend bắn sự kiện `CONVERSATION_UPDATE` qua WebSocket đến tất cả thành viên để nhóm mới hiện lên Sidebar của họ ngay lập tức.

---

## 2. Quy trình Mời và Tham gia Nhóm (Invitation & Joining)

1.  **Gửi lời mời**: Admin/Owner gửi lời mời qua API `inviteMember`. Backend lưu bản ghi `GroupInvitation` ở trạng thái `PENDING`.
2.  **Thông báo**: Backend gửi sự kiện `GROUP_INVITE` qua WebSocket. Người được mời sẽ thấy thông báo đỏ ở icon "Lời mời" trên Sidebar.
3.  **Chấp nhận**: Khi người dùng nhấn "Đồng ý":
    *   Backend cập nhật trạng thái lời mời thành `ACCEPTED`.
    *   Thêm người dùng vào danh sách `memberIds` của nhóm.
    *   Bắn tin nhắn hệ thống: *"Y đã tham gia nhóm."*
    *   Gửi sự kiện `CONVERSATION_UPDATE` để nhóm xuất hiện trên Sidebar của thành viên mới.

---

## 3. Cơ chế Nhắn tin Thời gian thực (Real-time Messaging)

1.  **Gửi tin nhắn**: Client gửi payload (nội dung, ảnh, file, replyId...) qua kênh WebSocket `/app/chat.send`.
2.  **Xử lý tại Backend**: 
    *   Lưu tin nhắn vào Database.
    *   Cập nhật `lastMessage` và `unreadCount` cho tất cả thành viên trong nhóm.
3.  **Phát tin nhắn (Broadcasting)**:
    *   Tin nhắn người dùng: Bắn sự kiện `MESSAGE_SEND`.
    *   Tin nhắn hệ thống: Bắn sự kiện `MESSAGE_NEW`.
4.  **Frontend Update**: Hook `useWebSocket` nhận tin nhắn và dispatch action `addMessage` vào Redux, cập nhật giao diện khung chat và vị trí hội thoại ở Sidebar.

---

## 4. Quản lý Thành viên và Vai trò (Management & Roles)

Dự án phân chia 3 cấp bậc quyền hạn:
*   **OWNER (Chủ nhóm)**: 
    *   Có toàn quyền: Đổi tên, đổi ảnh nền, ghim tin nhắn, mời người.
    *   Bổ nhiệm/Giáng cấp Phó nhóm (ADMIN).
    *   Xóa bất kỳ thành viên nào.
    *   Giải tán nhóm (`disbandGroup`).
    Bật/tắt chế độ "Chỉ Admin mới có thể chat".
*   **ADMIN (Phó nhóm)**: 
    *   Mời thành viên, xóa thành viên thường (MEMBER).
    *   Ghim tin nhắn, đổi tên nhóm.
*   **MEMBER (Thành viên)**: 
    *   Chat, gửi media, thả cảm xúc, trả lời tin nhắn.
    *   Xem thông tin nhóm và danh sách thành viên.

---

## 5. Các Tính năng Nâng cao

### A. Ghim tin nhắn (Pin Messages)
*   Cho phép ghim nhiều tin nhắn cùng lúc.
*   Danh sách tin nhắn ghim được lưu trong mảng `pinnedMessageIds` của hội thoại.
*   Khi ghim/bỏ ghim, hệ thống bắn sự kiện `MESSAGE_PIN` / `MESSAGE_UNPIN` để cập nhật thanh thông báo ở đầu khung chat.

### B. Bình chọn (Voting/Poll)
*   Tạo cuộc bình chọn với nhiều lựa chọn.
*   Hệ thống tự động ghim tin nhắn bình chọn lên đầu trang.
*   Cập nhật kết quả (số lượng người vote, danh sách người vote) theo thời gian thực qua sự kiện `MESSAGE_STATUS_UPDATE`.

### C. Trợ lý AI (AI Assistant)
Tích hợp Google Gemini để hỗ trợ quản lý nhóm:
*   **Tóm tắt (Summary)**: Phân tích lịch sử chat trong khoảng thời gian (1h, 24h, 7 ngày...) để tóm tắt nội dung chính.
*   **Thống kê (Stats)**: Báo cáo ai hoạt động tích cực nhất, chủ đề nào được thảo luận nhiều nhất.
*   **Biên bản (Announcement)**: Tự động soạn thảo thông báo hoặc biên bản cuộc họp từ nội dung chat.
*   **Trích xuất công việc (Task Extraction)**: Nhận diện các câu lệnh hoặc lời hứa hẹn để tạo danh sách TODO.

---

## 6. Quy trình Rời nhóm và Giải tán Nhóm

*   **Rời nhóm**: 
    *   Nếu là thành viên thường: Xóa mapping `UserConversation`.
    *   Nếu là OWNER: Hệ thống tự động chuyển giao quyền OWNER cho một ADMIN hoặc thành viên lâu năm nhất trước khi cho phép rời đi.
*   **Giải tán nhóm**: Chỉ OWNER mới có quyền. Xóa toàn bộ dữ liệu tin nhắn, mapping thành viên và bản ghi hội thoại.

