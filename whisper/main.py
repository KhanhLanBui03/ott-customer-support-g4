import os
import tempfile
import shutil
import httpx

from fastapi import FastAPI, UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import List

app = FastAPI(title="Whisper STT + Translation Service (API-based)")

# ─────────────────────────────────────────────
# Cấu hình
# ─────────────────────────────────────────────
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_STT_URL = "https://api.groq.com/openai/v1/audio/transcriptions"
MYMEMORY_URL  = "https://api.mymemory.translated.net/get"

# Map từ NLLB language code → ISO 639-1 code cho MyMemory
NLLB_TO_ISO = {
    "vie_Latn": "vi",
    "eng_Latn": "en",
    "zho_Hans": "zh",
    "fra_Latn": "fr",
    "deu_Latn": "de",
    "jpn_Jpan": "ja",
    "kor_Hang": "ko",
    "tha_Thai": "th",
    "ind_Latn": "id",
    "spa_Latn": "es",
    "por_Latn": "pt",
    "rus_Cyrl": "ru",
}

def to_iso(code: str) -> str:
    """Chuyển NLLB code (vie_Latn) hoặc ISO code (vi) sang ISO 639-1."""
    return NLLB_TO_ISO.get(code, code[:2] if "_" in code else code)

# ─────────────────────────────────────────────
# Request Schemas (backward compatible với Spring Boot)
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
# Helper: gọi MyMemory API
# ─────────────────────────────────────────────

async def translate_text(text: str, src: str, tgt: str) -> str:
    """Dịch văn bản qua MyMemory API (miễn phí, không cần API key)."""
    src_iso = to_iso(src)
    tgt_iso = to_iso(tgt)
    lang_pair = f"{src_iso}|{tgt_iso}"

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(MYMEMORY_URL, params={
            "q": text[:500],   # MyMemory giới hạn 500 ký tự/request
            "langpair": lang_pair,
        })
        resp.raise_for_status()
        data = resp.json()

    # responseStatus 200 = thành công
    if data.get("responseStatus") == 200:
        return data["responseData"]["translatedText"]
    else:
        # Nếu lỗi, trả về text gốc thay vì crash
        print(f"[WARN] MyMemory lỗi: {data.get('responseDetails')}")
        return text

# ─────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────

@app.get("/")
async def root():
    return {"service": "Whisper STT + Translation", "status": "running"}

@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    """
    Speech-to-text dùng Groq Whisper API.
    Groq chạy model Whisper trên H100 GPU — cực nhanh, miễn phí 7200s audio/ngày.
    """
    if not GROQ_API_KEY:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY chưa được cấu hình")

    # Lưu file tạm
    suffix = os.path.splitext(file.filename or "audio")[1] or ".webm"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp_path = tmp.name
        shutil.copyfileobj(file.file, tmp)

    try:
        # Gọi Groq Whisper API
        async with httpx.AsyncClient(timeout=60.0) as client:
            with open(tmp_path, "rb") as audio_file:
                resp = await client.post(
                    GROQ_STT_URL,
                    headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
                    data={
                        "model": "whisper-large-v3-turbo",  # model mới nhất, nhanh nhất
                        "language": "vi",
                        "response_format": "json",
                    },
                    files={"file": (file.filename or "audio" + suffix, audio_file, file.content_type or "audio/webm")},
                )

        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail=f"Groq API lỗi: {resp.text}")

        result = resp.json()
        return {
            "text": result.get("text", ""),
            "language": "vi"
        }
    finally:
        os.remove(tmp_path)


@app.post("/translate")
async def translate(req: TranslateRequest):
    """Dịch 1 text qua MyMemory API — miễn phí, không cần API key."""
    translated = await translate_text(req.text, req.source_lang, req.target_lang)
    return {"translated_text": translated}


@app.post("/translate/batch")
async def translate_batch(req: BatchTranslateRequest):
    """
    Dịch nhiều text qua MyMemory API.
    Spring TranslationBatchService gọi endpoint này.
    """
    results = []
    for item in req.items:
        try:
            translated = await translate_text(item.text, item.src, item.tgt)
            results.append(translated)
        except Exception as e:
            print(f"[ERROR] Dịch lỗi: {e}")
            results.append(item.text)  # trả về text gốc nếu lỗi
    return results