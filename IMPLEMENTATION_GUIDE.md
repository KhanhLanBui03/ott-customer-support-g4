# Chat Application - Implementation & Deployment Guide

## 🚀 Quick Start

### Local Development Setup

#### 1. Prerequisites
```bash
# Install Java 17
java -version

# Install Maven 3.8+
mvn -version

# Install Docker & Docker Compose
docker --version
docker-compose --version

# Install Redis (or use Docker)
redis-cli --version

# Install DynamoDB Local
```

#### 2. Start Infrastructure (Docker)
```yaml
# docker-compose.yml
version: '3.8'

services:
  dynamodb:
    image: amazon/dynamodb-local:latest
    ports:
      - "8000:8000"
    environment:
      AWS_REGION: ap-southeast-1
    command: -jar DynamoDBLocal.jar -sharedDb

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: chat_db
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql

volumes:
  redis_data:
  mysql_data:
```

**Run:**
```bash
docker-compose up -d
```

#### 3. Build Backend
```bash
cd backend
mvn clean package -DskipTests
# Or: mvn spring-boot:run
```

#### 4. Build Frontend Web
```bash
cd web
npm install
npm run dev  # Vite dev server on :5173
```

#### 5. Build Mobile App
```bash
cd mobile
npm install
npx expo start
# Press 'w' for web, 'i' for iOS, 'a' for Android
```

---

## 📡 API Endpoints

### Authentication Module

#### 1. Register User
**POST** `/api/v1/auth/register`

**Request:**
```json
{
  "phoneNumber": "+84912345678",
  "password": "SecurePass@123",
  "confirmPassword": "SecurePass@123",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "userId": "uuid-xxxx",
    "phoneNumber": "+84912345678",
    "firstName": "John",
    "lastName": "Doe",
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc...",
    "tokenType": "Bearer",
    "expiresIn": 86400000,
    "sessionId": "session-uuid"
  }
}
```

#### 2. Login User
**POST** `/api/v1/auth/login`

**Request:**
```json
{
  "phoneNumber": "+84912345678",
  "password": "SecurePass@123",
  "deviceId": "device-uuid",
  "deviceName": "iPhone 12"
}
```

**Response:** Same as Register (includes tokens)

#### 3. Refresh Token
**POST** `/api/v1/auth/refresh`

**Request:**
```json
{
  "refreshToken": "eyJhbGc...",
  "deviceId": "device-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "new-access-token",
    "refreshToken": "new-refresh-token",
    "tokenType": "Bearer",
    "expiresIn": 86400000,
    "sessionId": "new-session-id"
  }
}
```

#### 4. Logout
**POST** `/api/v1/auth/logout`

**Headers:**
```
Authorization: Bearer {accessToken}
X-Session-Id: {sessionId}
X-User-Id: {userId}
```

**Response:**
```json
{
  "success": true,
  "message": "Logout successful",
  "data": null
}
```

#### 5. Change Password
**POST** `/api/v1/auth/change-password`

**Headers:**
```
Authorization: Bearer {accessToken}
X-User-Id: {userId}
```

**Parameters:**
```
oldPassword: string
newPassword: string
```

### Message Module

#### 1. Send Message
**POST** `/api/v1/messages/send`

**Headers:**
```
Authorization: Bearer {accessToken}
X-User-Id: {userId}
```

**Request:**
```json
{
  "conversationId": "conv-uuid",
  "content": "Hello, how are you?",
  "type": "TEXT",
  "replyToMessageId": "msg-uuid (optional)",
  "isEncrypted": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "messageId": "msg-uuid",
    "conversationId": "conv-uuid",
    "senderId": "user-uuid",
    "senderName": "John Doe",
    "content": "Hello, how are you?",
    "type": "TEXT",
    "status": "SENT",
    "createdAt": 1234567890000
  }
}
```

#### 2. Get Message History
**GET** `/api/v1/messages/{conversationId}`

**Query Parameters:**
- `limit`: number of messages (default 20)
- `fromMessageId`: for pagination

**Headers:**
```
Authorization: Bearer {accessToken}
X-User-Id: {userId}
```

#### 3. Recall Message
**POST** `/api/v1/messages/{messageId}/recall`

**Headers:**
```
Authorization: Bearer {accessToken}
X-User-Id: {userId}
```

#### 4. Edit Message
**PUT** `/api/v1/messages/{messageId}`

**Request:**
```json
{
  "conversationId": "conv-uuid",
  "content": "Updated message content"
}
```

#### 5. Mark as Read
**POST** `/api/v1/messages/{messageId}/read`

**Request:**
```json
{
  "conversationId": "conv-uuid"
}
```

#### 6. Add Reaction
**POST** `/api/v1/messages/{messageId}/reaction`

**Request:**
```json
{
  "conversationId": "conv-uuid",
  "emoji": "👍"
}
```

---

## 🔌 WebSocket Events

### Connection
```
WebSocket URL: ws://localhost:8080/ws/chat
Headers:
  Authorization: Bearer {accessToken}
```

### Subscribe to Messages
```javascript
// Client (JavaScript)
stompClient.subscribe(`/topic/conversation/{conversationId}`, (message) => {
  console.log('New message:', JSON.parse(message.body));
});
```

### Send Message via WebSocket
```javascript
stompClient.send(`/app/chat/send`, {}, JSON.stringify({
  conversationId: 'conv-uuid',
  content: 'Hello',
  type: 'TEXT'
}));
```

### Typing Indicator
```javascript
// Start typing
stompClient.send(`/app/chat/typing`, {}, JSON.stringify({
  conversationId: 'conv-uuid',
  isTyping: true
}));

// Subscribe to typing events
stompClient.subscribe(`/topic/typing/{conversationId}`, (message) => {
  console.log('User typing:', JSON.parse(message.body));
});
```

### Message Status Update
```javascript
// Subscribe to message status
stompClient.subscribe(`/user/{userId}/queue/status`, (message) => {
  console.log('Message delivered/read:', JSON.parse(message.body));
});
```

---

## 🗄️ DynamoDB Setup

### Create Tables
```bash
# Using AWS CLI
aws dynamodb create-table \
  --table-name chat_users \
  --attribute-definitions \
    AttributeName=userId,AttributeType=S \
    AttributeName=phoneNumber,AttributeType=S \
  --key-schema \
    AttributeName=userId,KeyType=HASH \
  --global-secondary-indexes \
    "IndexName=phoneNumber-index,Keys=[{AttributeName=phoneNumber,KeyType=HASH}],Projection={ProjectionType=ALL},ProvisionedThroughput={ReadCapacityUnits=10,WriteCapacityUnits=10}" \
  --provisioned-throughput ReadCapacityUnits=10,WriteCapacityUnits=10 \
  --region ap-southeast-1

# For local DynamoDB:
aws dynamodb create-table \
  --endpoint-url http://localhost:8000 \
  --table-name chat_messages \
  --attribute-definitions \
    AttributeName=conversationId,AttributeType=S \
    AttributeName=messageId,AttributeType=S \
  --key-schema \
    AttributeName=conversationId,KeyType=HASH \
    AttributeName=messageId,KeyType=RANGE \
  --provisioned-throughput ReadCapacityUnits=10,WriteCapacityUnits=10 \
  --region ap-southeast-1
```

### Python Script to Create All Tables
```python
import boto3

dynamodb = boto3.resource(
    'dynamodb',
    endpoint_url='http://localhost:8000',
    region_name='ap-southeast-1'
)

# Create Users Table
dynamodb.create_table(
    TableName='chat_users',
    KeySchema=[
        {'AttributeName': 'userId', 'KeyType': 'HASH'}
    ],
    AttributeDefinitions=[
        {'AttributeName': 'userId', 'AttributeType': 'S'},
        {'AttributeName': 'phoneNumber', 'AttributeType': 'S'}
    ],
    GlobalSecondaryIndexes=[{
        'IndexName': 'phoneNumber-index',
        'KeySchema': [{'AttributeName': 'phoneNumber', 'KeyType': 'HASH'}],
        'Projection': {'ProjectionType': 'ALL'},
        'ProvisionedThroughput': {
            'ReadCapacityUnits': 10,
            'WriteCapacityUnits': 10
        }
    }],
    ProvisionedThroughput={
        'ReadCapacityUnits': 10,
        'WriteCapacityUnits': 10
    }
)

print('Tables created successfully')
```

---

## 🐳 Docker Deployment

### Build Backend Image
```dockerfile
# Dockerfile
FROM eclipse-temurin:17-jre

WORKDIR /app

COPY target/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
```

**Build:**
```bash
mvn clean package
docker build -t chat-app-backend:latest .
```

### Docker Compose (Production)
```yaml
version: '3.8'

services:
  backend:
    image: chat-app-backend:latest
    ports:
      - "8080:8080"
    environment:
      SPRING_DATASOURCE_URL: jdbc:mysql://mysql:3306/chat_db
      AWS_REGION: ap-southeast-1
      AWS_DYNAMODB_ENDPOINT: http://dynamodb:8000
      REDIS_HOST: redis
      REDIS_PORT: 6379
    depends_on:
      - dynamodb
      - redis
      - mysql
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/actuator/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  web:
    image: chat-app-web:latest
    ports:
      - "3000:3000"
    depends_on:
      - backend

  mobile:
    image: chat-app-mobile:latest
    ports:
      - "19000:19000"

  dynamodb:
    image: amazon/dynamodb-local:latest
    ports:
      - "8000:8000"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: chat_db
    volumes:
      - mysql_data:/var/lib/mysql

volumes:
  mysql_data:
```

---

## 🧪 Testing

### Unit Tests
```java
// src/test/java/com/chatapp/modules/auth/service/AuthServiceTest.java
@SpringBootTest
class AuthServiceTest {

    @MockBean
    private UserRepository userRepository;

    @InjectMocks
    private AuthService authService;

    @Test
    void testRegister_Success() {
        // Arrange
        RegisterRequest request = RegisterRequest.builder()
            .phoneNumber("+84912345678")
            .password("SecurePass@123")
            .firstName("John")
            .lastName("Doe")
            .build();

        // Act
        // Assert
    }

    @Test
    void testLogin_InvalidCredentials() {
        // Test logic
    }
}
```

### Integration Tests
```bash
mvn test
```

### Load Testing (JMeter)
```
# Test concurrent logins
- 100 threads
- Ramp-up 10 seconds
- Duration 60 seconds
- Assert response time < 500ms
```

---

## 📊 Monitoring & Logging

### Application Monitoring
```yaml
# application.yml
actuator:
  endpoints:
    web:
      exposure:
        include: health,metrics,prometheus

logging:
  level:
    root: INFO
    com.chatapp: DEBUG
  pattern:
    console: "%d{yyyy-MM-dd HH:mm:ss} - %msg%n"
    file: "%d{yyyy-MM-dd HH:mm:ss} [%thread] %-5level %logger{36} - %msg%n"
```

### Key Metrics
- Message throughput
- UserLogin success rate
- WebSocket connection count
- Database latency
- Redis cache hit ratio

---

## 🔐 Security Checklist

- [ ] JWT secret key (min 256 bits)
- [ ] Password requires uppercase, lowercase, digit, special char
- [ ] Rate limiting enabled (5 login attempts)
- [ ] HTTPS enforced in production
- [ ] CORS properly configured
- [ ] SQL injection protection
- [ ] XSS protection
- [ ] Environment variables for secrets
- [ ] Audit logging enabled

---

## 📈 Performance Optimization

### Redis Caching Strategy
```
User profile     → 30 min TTL
Conversation     → 15 min TTL
Recent messages  → 5 min TTL
Online users     → 1 hour TTL
```

### Database Optimization
- Partition conversations by date
- Index on conversationId + createdAt
- Batch message inserts

### Frontend Optimization
- Code splitting
- Lazy loading components
- Virtual scrolling for message list
- Compression (gzip)

---

## 🚢 Production Deployment

### AWS Architecture
```
Load Balancer (ALB)
    ↓
ECS Cluster (Fargate)
    ├── Chat Service (3 instances)
    ├── Auth Service (2 instances)
    └── Message Service (2 instances)
    ↓
RDS (MySQL)
DynamoDB
ElastiCache (Redis)
S3 (Media storage)
```

### Kubernetes Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: chat-app-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: chat-app
  template:
    metadata:
      labels:
        app: chat-app
    spec:
      containers:
      - name: backend
        image: chat-app-backend:latest
        ports:
        - containerPort: 8080
        env:
        - name: SPRING_PROFILES_ACTIVE
          value: "prod"
        - name: AWS_REGION
          value: "ap-southeast-1"
        livenessProbe:
          httpGet:
            path: /actuator/health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
```

---

## 📚 Next Implementation Steps

1. **Implement Other Modules:**
   - User Module (Profile, Status)
   - Conversation Module (Create, List, Archive)
   - Notification Module (FCM integration)
   - Media Module (S3 upload, presigned URLs)
   - Story Module (Create, View tracking, TTL)
   - Contact Module (Sync, Hash privacy)
   - AI Module (OpenAI integration)
   - E2E Encryption Module (RSA/AES)

2. **Frontend Development:**
   - Login/Register pages
   - Chat UI (Real-time messaging)
   - Conversation list
   - User profile
   - Story feature

3. **Testing:**
   - Unit tests for all services
   - Integration tests
   - E2E tests with Cypress/Playwright
   - Load testing

4. **DevOps:**
   - CI/CD pipeline (GitHub Actions)
   - Docker containerization
   - Kubernetes deployment
   - Monitoring & alerting

5. **Documentation:**
   - API documentation (Swagger/OpenAPI)
   - Architecture diagrams
   - Deployment guide

---

## 🆘 Troubleshooting

### DynamoDB Connection Error
```
Check: AWS_DYNAMODB_ENDPOINT, AWS_REGION, AWS credentials
```

### Redis Connection Error
```
Check: REDIS_HOST, REDIS_PORT, Redis service running
```

### JWT Token Invalid
```
Check: jwt.secret in application.yml, token expiration
```

### WebSocket Connection Fails
```
Check: CORS configuration, WebSocket path allowed
```

---

## 📞 Support
For issues and questions, please refer to the main SYSTEM_DESIGN.md document.
