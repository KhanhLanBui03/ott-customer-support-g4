from faster_whisper import WhisperModel
from fastapi import FastAPI, UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import shutil
import os
import tempfile

app = FastAPI(title="Whisper Speech-to-Text Service")

# ─────────────────────────────────────────────
# Lazy Load Whisper Model
# (Không load lúc khởi động để tránh timeout trên Render free tier)
# ─────────────────────────────────────────────
_whisper_model = None

def get_whisper_model():
    global _whisper_model
    if _whisper_model is None:
        print("[INFO] Loading Whisper model 'base'...")
        _whisper_model = WhisperModel(
            "base",
            device="cpu",
            compute_type="int8"
        )
        print("[INFO] Whisper model loaded successfully!")
    return _whisper_model

# ─────────────────────────────────────────────
# Request Schemas (giữ lại để backward compatible với Spring Boot)
# ─────────────────────────────────────────────

class TranslateRequest(BaseModel):
    text: str
    source_lang: str
    target_lang: str

class TranslateItem(BaseModel):
    text: str
    src: str
    tgt: str

class BatchTranslateRequest(BaseModel):
    items: List[TranslateItem]

# ─────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────

@app.get("/")
async def root():
    return {"service": "Whisper STT", "status": "running"}

@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    """Speech-to-text dùng Whisper — chuyển giọng nói thành văn bản."""
    # Dùng tempfile để tránh xung đột tên file
    suffix = os.path.splitext(file.filename or "audio")[1] or ".webm"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp_path = tmp.name
        shutil.copyfileobj(file.file, tmp)

    try:
        model = get_whisper_model()
        segments, info = model.transcribe(tmp_path, language="vi")
        text = " ".join([segment.text for segment in segments])
        return {
            "text": text,
            "language": info.language
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        os.remove(tmp_path)


@app.post("/translate")
async def translate(req: TranslateRequest):
    """
    Endpoint dịch — hiện tại trả về text gốc (NLLB đã bị tắt vì giới hạn RAM).
    Spring Boot sẽ dùng Gemini/Google Translate thay thế nếu cần.
    """
    return {"translated_text": req.text}


@app.post("/translate/batch")
async def translate_batch(req: BatchTranslateRequest):
    """
    Endpoint dịch batch — hiện tại trả về text gốc (NLLB đã bị tắt vì giới hạn RAM).
    """
    return [item.text for item in req.items]