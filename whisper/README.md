# Huong dan chay Whisper

Du an nay dung `faster_whisper` de chuyen audio thanh text thong qua FastAPI.

## 1. Yeu cau

- Python 3.10+.
- Da cai `ffmpeg` va them vao `PATH`.
- Cai cac thu vien Python can thiet:

```powershell
pip install fastapi uvicorn faster-whisper python-multipart
```

## 2. Chay ung dung

Trong thu muc `whisper`, chay lenh sau:

```powershell
uvicorn main:app --reload
```

Mac dinh server se chay o:

```text
http://127.0.0.1:8000
```

## 3. API su dung

Endpoint:

```text
POST /transcribe
```

File audio duoc gui len server se duoc xu ly voi model `base` va ep ngon ngu `vi`.

### Vi du PowerShell

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8000/transcribe" `
  -Method Post `
  -Form @{ file = Get-Item ".\example.mp3" }
```

### Vi du curl

```bash
curl -X POST "http://127.0.0.1:8000/transcribe" -F "file=@example.mp3"
```

## 4. Giai thich nhanh code

- `main.py` tao `FastAPI()`.
- `WhisperModel("base")` tai model Whisper co san.
- File upload se duoc luu tam vao `temp_<ten_file>`.
- Ham `transcribe()` se doc file, chuyen thanh van ban, sau do xoa file tam.

## 5. Loi thuong gap

- Neu bao loi khong tim thay `ffmpeg`, hay cai `ffmpeg` va kiem tra lai `PATH`.
- Neu dang tai model lau, lan chay dau tien co the mat them thoi gian.
- Neu upload file bi loi, hay dam bao da cai `python-multipart`.