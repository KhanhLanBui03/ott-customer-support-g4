# ─────────────────────────────────────────────
# Build image nhẹ dựa trên Python 3.10 slim
# ─────────────────────────────────────────────
FROM python:3.10-slim

# Đặt thư mục làm việc
WORKDIR /app

# Cài đặt ffmpeg (bắt buộc cho Whisper xử lý audio)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements và cài thư viện Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Cài torch CPU-only (để giảm dung lượng, không cần GPU)
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

# Copy source code
COPY . .

# Render sẽ inject biến PORT, mặc định 8000 nếu chạy local
ENV PORT=8000

# Expose cổng
EXPOSE $PORT

# Khởi chạy uvicorn — đọc PORT từ biến môi trường
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port $PORT"]
