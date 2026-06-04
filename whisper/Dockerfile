# ─────────────────────────────────────────────
# Build image nhẹ dựa trên Python 3.10 slim
# ─────────────────────────────────────────────
FROM python:3.10-slim

# Đặt thư mục làm việc
WORKDIR /app

# Cài đặt các thư viện hệ thống cần thiết
# ffmpeg: bắt buộc cho Whisper xử lý audio
# build-essential: cần để build một số thư viện Python native
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy file requirements trước để tận dụng Docker layer cache
COPY requirements.txt .

# Cài đặt các thư viện Python
# Dùng torch CPU-only để tiết kiệm dung lượng và RAM
RUN pip install --no-cache-dir \
    fastapi \
    "uvicorn[standard]" \
    python-multipart \
    faster-whisper \
    transformers \
    sentencepiece \
    torch --index-url https://download.pytorch.org/whl/cpu

# Copy toàn bộ source code vào container
COPY . .

# Expose cổng 8000 (FastAPI mặc định)
EXPOSE 8000

# Khởi chạy server uvicorn lắng nghe trên mọi địa chỉ
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
