# 📱 Chat Application - Modular Monolith Architecture

A **production-ready** Chat Application built with **Modular Monolith** architecture using Spring Boot, featuring real-time messaging, multi-device support, and advanced security.

## 🎯 Overview

This is a **scalable, secure, and feature-rich** chat application designed for **thousands of concurrent users** with clear module separation for easy transition to microservices.

### Key Highlights:
✅ **Monolith with Modular Design** - 10 independent modules  
✅ **Real-time Messaging** - WebSocket (STOMP protocol)  
✅ **Multi-Device Support** - Session management & device logout  
✅ **Production-Ready** - Enterprise-grade security & performance  
✅ **DynamoDB** - Highly scalable NoSQL database  
✅ **Redis** - Caching & session management  
✅ **End-to-End Encryption** - E2E encryption support  
✅ **Firebase Integration** - Push notifications (FCM)  
✅ **S3 Storage** - Media storage & presigned URLs  
✅ **OpenAI Integration** - AI chatbot support  

---

## 🏗️ Architecture

### Module Structure (10 Modules)
```
chat-app/
├── auth-module           (Login, Register, JWT, OTP, Sessions)
├── user-module           (Profile, Status, Settings)
├── contact-module        (Danh bạ sync, Privacy)
├── conversation-module   (1-1, Group chats)
├── message-module        (CQRS, Send, Recall, Edit, React)
├── notification-module   (FCM, Push notifications)
├── media-module          (S3, File upload, Presigned URLs)
├── ai-module             (OpenAI, Chatbot)
├── story-module          (Stories, TTL 24h, Privacy)
└── e2e-encryption-module (RSA/AES encryption)
```

### Technology Stack
| Layer | Technology | Version |
|-------|-----------|---------|
| **Backend** | Spring Boot | 3.2.0 |
| **Language** | Java | 17 |
| **Database** | DynamoDB | Latest |
| **Cache** | Redis | 7.x |
| **Real-time** | WebSocket (STOMP) | 3.2.0 |
| **Storage** | AWS S3 | Latest |
| **Notifications** | Firebase FCM | Latest |
| **Auth** | JWT (jjwt) | 0.12.3 |
| **Frontend Web** | React + TypeScript | 18+ |
| **Frontend Mobile** | React Native (Expo) | Latest |

---

## 🚀 Quick Start

### Prerequisites
```bash
# Java 17+
java -version

# Maven 3.8+
mvn -version

# Docker & Docker Compose
docker --version
docker-compose --version
```

### 1️⃣ Start Infrastructure
```bash
docker-compose up -d
# Services: DynamoDB (8000), Redis (6379), MySQL (3306)
```

### 2️⃣ Build & Run Backend
```bash
cd backend
mvn spring-boot:run
# Server runs on http://localhost:8080
```

### 3️⃣ Build & Run Frontend (Web)
```bash
cd web
npm install
npm run dev
# Runs on http://localhost:5173
```

### 4️⃣ Build & Run Mobile (Optional)
```bash
cd mobile
npm install
npx expo start
# Press 'w' for web, 'i' for iOS, 'a' for Android
```

---

## 📡 Core API Endpoints

### Authentication
```
POST   /api/v1/auth/register         Register user
POST   /api/v1/auth/login            Login
POST   /api/v1/auth/refresh          Refresh token
POST   /api/v1/auth/logout           Logout
POST   /api/v1/auth/change-password  Change password
```

### Messages
```
POST   /api/v1/messages/send              Send message
GET    /api/v1/messages/{conversationId}  Get history
POST   /api/v1/messages/{messageId}/read  Mark as read
POST   /api/v1/messages/{messageId}/recall Recall
PUT    /api/v1/messages/{messageId}       Edit
POST   /api/v1/messages/{messageId}/reaction Add reaction
```

### Conversations
```
POST   /api/v1/conversations              Create
GET    /api/v1/conversations              List
GET    /api/v1/conversations/{id}         Get details
PUT    /api/v1/conversations/{id}         Update
DELETE /api/v1/conversations/{id}         Delete
```

---

## 🔐 Security Features

### Authentication & Authorization
- **JWT Token** - Stateless authentication
- **Refresh Tokens** - 7-day refresh token rotation
- **Session Management** - Redis-backed sessions
- **Multi-Device Logout** - Auto logout from old devices
- **Rate Limiting** - 5 login attempts, 5-min lockout

### Password Security
- **PBKDF2 Hashing** - 120,000 iterations
- **Salt** - 32 bytes random salt
- **Strength Requirements** - Uppercase, lowercase, digit, special char

### OTP (SMS)
- **6-digit Code** - 5-minute validity
- **Rate Limited** - 3 attempts max
- **Privacy** - Phone number hashing (SHA-256)

### End-to-End Encryption
- **Key Exchange** - RSA (2048-bit)
- **Message Encryption** - AES-256-GCM
- **Storage** - Encrypted messages in DynamoDB

---

## 📊 Database Schema

### Key Tables
| Table | PK | SK | Use Case |
|-------|----|----|----------|
| **Users** | userId | - | User accounts |
| **Conversations** | conversationId | - | Chat threads |
| **Messages** | conversationId | messageId | Messages (sorted by time) |
| **Sessions** | sessionId | - | Active sessions (TTL 24h) |
| **OTP** | phoneNumber | - | OTP codes (TTL 5m) |
| **Stories** | storyId | - | Stories (TTL 24h) |
| **DeviceTokens** | deviceTokenId | - | FCM tokens |

---

## 🔄 Real-Time Communication (WebSocket)

### Subscribe to Messages
```javascript
// Connect
const stompClient = new StompJs.Client({
  brokerURL: 'ws://localhost:8080/ws/chat',
  headers: { Authorization: 'Bearer ' + accessToken }
});

// Subscribe
stompClient.subscribe(`/topic/conversation/${convId}`, (message) => {
  console.log('New message:', JSON.parse(message.body));
});

// Send
stompClient.send('/app/chat/send', {}, JSON.stringify({
  conversationId: convId,
  content: 'Hello!'
}));
```

### Events
- `/topic/conversation/{id}` - New messages
- `/topic/typing/{id}` - Typing indicators
- `/user/{userId}/queue/status` - Delivery/read receipts

---

## 📁 Project Structure

```
chat-app/
├── backend/
│   ├── src/main/java/com/chatapp/
│   │   ├── common/              (Shared utilities, exceptions)
│   │   ├── config/              (Security, DynamoDB, Redis, WebSocket)
│   │   ├── modules/
│   │   │   ├── auth/            (Login, JWT, OTP, Sessions)
│   │   │   ├── user/            (Profile, Status)
│   │   │   ├── message/         (CQRS - Send, Recall, Edit)
│   │   │   ├── conversation/    (Chat, Groups)
│   │   │   ├── notification/    (FCM, Push)
│   │   │   ├── media/           (S3 upload)
│   │   │   ├── ai/              (OpenAI)
│   │   │   ├── story/           (Stories, TTL)
│   │   │   └── contact/         (Danh bạ sync)
│   │   └── websocket/           (STOMP handlers)
│   ├── pom.xml
│   ├── Dockerfile
│   └── src/main/resources/application.yml
│
├── web/                         (React + TypeScript)
│   ├── src/
│   │   ├── pages/             (Login, Chat, Story)
│   │   ├── components/        (UI components)
│   │   ├── hooks/             (Custom hooks)
│   │   ├── api/               (API clients)
│   │   └── store/             (Redux state)
│   ├── package.json
│   └── vite.config.js
│
├── mobile/                      (React Native + Expo)
│   ├── src/
│   │   ├── screens/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── api/
│   └── package.json
│
├── docker-compose.yml           (Full stack setup)
├── SYSTEM_DESIGN.md             (Architecture & Database)
├── IMPLEMENTATION_GUIDE.md      (API endpoints, deployment)
└── README.md                    (This file)
```

---

## 📚 Documentation

- **[SYSTEM_DESIGN.md](./SYSTEM_DESIGN.md)** - Architecture, Database schema, Scaling strategy
- **[IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md)** - API endpoints, Docker, Testing, Deployment
- **API Docs** - Available at `http://localhost:8080/swagger-ui.html`

---

## 🧪 Testing

### Run Unit Tests
```bash
cd backend
mvn test
```

### Run Integration Tests
```bash
mvn verify
```

### Load Testing
```bash
# Using Apache JMeter
jmeter -t load-test.jmx
```

---

## 🐳 Docker Deployment

### Build Images
```bash
# Backend
docker build -t chat-app-backend:latest ./backend

# Web
docker build -t chat-app-web:latest ./web
```

### Run with Docker Compose
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

---

## ☁️ Cloud Deployment

### AWS Deployment
```yaml
Architecture:
  API Layer: ALB (Application Load Balancer)
  Compute: ECS Fargate (Containers)
  Database: DynamoDB (Managed NoSQL)
  Cache: ElastiCache (Redis)
  Storage: S3 (Media files)
  Notifications: SNS + FCM
  Messaging: SQS (Message queue)
```

### Kubernetes Deployment
```bash
kubectl apply -f k8s/
# Includes: Deployment, Service, ConfigMap, StatefulSet for Redis
```

---

## 📈 Performance Optimization

### Caching Strategy
- User profiles → 30 min TTL
- Conversations → 15 min TTL
- Recent messages → 5 min TTL
- Online users → 1 hour TTL

### Database Optimization
- Partition conversations by month
- Index on `conversationId + createdAt`
- Batch message inserts
- Connection pooling

### Frontend Optimization
- Code splitting (Webpack/Vite)
- Lazy loading components
- Virtual scrolling for message list
- Gzip compression

---

## 🔐 Security Checklist

- ✅ JWT secret (256+ bits)
- ✅ HTTPS enforced (production)
- ✅ CORS properly configured
- ✅ SQL injection protection (parametrized queries)
- ✅ XSS protection (Content Security Policy)
- ✅ CSRF protection
- ✅ Rate limiting (API & login)
- ✅ Password hashing (PBKDF2)
- ✅ OTP validation
- ✅ Audit logging

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📝 License

This project is licensed under the MIT License - see [LICENSE](./LICENSE) file for details.

---

## 💬 Support & Contact

For questions, issues, or suggestions:
- **Email**: support@chatapp.com
- **GitHub Issues**: [Report issues here](https://github.com/khanhbui/chat-app/issues)
- **Documentation**: See [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md)

---

## 🎉 Acknowledgments

- Built with **Spring Boot** for robustness
- Inspired by **WhatsApp** and **Zalo** architecture
- Community feedback and contributions welcome

---

**Made with ❤️ for scalable, secure communication**

10:02 PM
Để tối ưu hóa quy trình này một cách triệt để, giải quyết cả 3 vấn đề (UX, Vận hành, và Pháp lý), đồng thời phù hợp với một ứng dụng nhắn tin (Chat App), tôi đề xuất thiết kế lại quy trình theo sơ đồ tối ưu dưới đây.

1. Quy trình tối ưu chi tiết (Tự động hóa 100%)
Thay vì cần Admin phê duyệt hay gửi email thủ công, chúng ta sẽ tự động hóa toàn bộ bằng mã nguồn (Backend và Cron Job).

Bước 1: Yêu cầu xóa trên Giao diện (Client-side)
Khi người dùng vào phần cài đặt và chọn "Xóa tài khoản", hệ thống hiển thị một Popup/Form:

Lựa chọn hình thức:
Tạm khóa tài khoản (Soft Delete): Tài khoản sẽ bị ẩn ngay lập tức. Người dùng có 30 ngày để đăng nhập lại và khôi phục. Sau 30 ngày sẽ bị xóa vĩnh viễn.
Xóa vĩnh viễn ngay lập tức (Hard Delete): Tài khoản và toàn bộ dữ liệu cá nhân bị xóa/ẩn danh ngay lập tức, không thể khôi phục.
Xác thực bảo mật bắt buộc: Để tránh trường hợp người khác cầm máy xóa hộ, yêu cầu người dùng nhập mật khẩu hoặc nhập mã OTP gửi về Email/SĐT của họ trước khi xác nhận.
Bước 2: Xử lý ở Backend
Nếu chọn "Tạm khóa 30 ngày":
Đổi trạng thái User thành PENDING_DELETE (hoặc LOCKED).
Lưu trường deletion_date = CURRENT_DATE + 30 days vào bảng User.
Thu hồi tất cả phiên đăng nhập: Xóa Refresh Token của user đó trong database/Redis để buộc user đăng xuất ra khỏi mọi thiết bị ngay lập tức.
Gửi Email tự động: Hệ thống tự động gửi 1 email duy nhất thông báo: "Tài khoản của bạn đã được lên lịch xóa vào ngày [Date]. Nếu bạn không thực hiện yêu cầu này hoặc muốn khôi phục, vui lòng click vào nút dưới đây để Hủy yêu cầu xóa trước ngày [Date]."
Nếu chọn "Xóa ngay lập tức":
Thực hiện quy trình xóa/ẩn danh dữ liệu ngay lập tức (Xem chi tiết phần 2).
Bước 3: Cron Job tự động (Tác vụ chạy ngầm)
Viết một Scheduler (ví dụ: dùng @Scheduled trong Spring Boot) chạy vào mỗi đêm lúc 2:00 AM.
Nhiệm vụ của Scheduler: Tìm tất cả User có trạng thái PENDING_DELETE và có ngày deletion_date <= CURRENT_DATE, sau đó thực hiện xóa/ẩn danh dữ liệu của họ.
2. Gợi ý xử lý Dữ liệu đối với dự án Chat App (Quan trọng)
Vì dự án của bạn là Chat App, việc xóa hoàn toàn một User khỏi Database (Hard Delete) bằng câu lệnh DELETE FROM users rất dễ gây lỗi khóa ngoại (Foreign Key Constraint) hoặc làm hỏng cấu trúc hiển thị tin nhắn của những người dùng khác trong đoạn chat cũ.

Do đó, thay vì xóa hoàn toàn dòng (row) của User, bạn nên sử dụng giải pháp Ẩn danh hóa dữ liệu (Anonymization):

Thông tin	Khi hoạt động (Active)	Sau khi Xóa vĩnh viễn (Anonymized)
ID User	usr_98234	Giữ nguyên (để tránh lỗi liên kết tin nhắn)
Họ tên hiển thị	Nguyễn Văn A	Đổi thành Người dùng đã xóa (Deleted User)
Email / Số điện thoại	vana@gmail.com	Xóa hoặc mã hóa: deleted_98234@app.com (để giải phóng Email/SĐT này cho người khác đăng ký mới nếu cần)
Mật khẩu	Mật khẩu đã mã hóa	Đổi thành một chuỗi ngẫu nhiên vô nghĩa (ngăn đăng nhập lại)
Ảnh đại diện (Avatar)	Link ảnh trên S3	Đổi thành ảnh mặc định của hệ thống / Xóa ảnh trên S3
FCM Token (Thông báo đẩy)	Chuỗi token	Xóa sạch (để thiết bị của họ không bao giờ nhận được thông báo tin nhắn mới nữa)
3. Cách xử lý nếu người dùng chọn "KHÔNG" (Muốn hủy yêu cầu xóa)
Khi người dùng bấm vào link hủy xóa trong email, hoặc cố gắng đăng nhập lại trong vòng 30 ngày:

Nếu họ đăng nhập lại trong 30 ngày:
Hệ thống nhận diện trạng thái tài khoản là PENDING_DELETE.
Hiển thị thông báo: "Tài khoản của bạn đang trong quá trình chờ xóa. Bạn có muốn kích hoạt lại tài khoản của mình không?"
Nếu chọn Có (Kích hoạt lại): Cập nhật trạng thái về ACTIVE, xóa trường deletion_date, cho phép đăng nhập thành công.
Nếu chọn Không: Giữ nguyên trạng thái và thoát ra ngoài.
Nếu họ bấm vào link Hủy xóa trong email:
Chuyển hướng người dùng đến một trang Web xác nhận: "Yêu cầu khôi phục tài khoản thành công!".
Backend chuyển trạng thái User về ACTIVE và xóa deletion_date.
10:02 PM

