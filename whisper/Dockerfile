# ─────────────────────────────────────────────
# Image cực nhẹ — chỉ là API proxy, không chạy AI model
# ─────────────────────────────────────────────
FROM python:3.10-slim

WORKDIR /app

# Chỉ cài thư viện Python, không cần ffmpeg hay build tools
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Render inject biến PORT, mặc định 8000 khi chạy local
ENV PORT=8000

EXPOSE $PORT

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port $PORT"]
