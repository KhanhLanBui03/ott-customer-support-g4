from faster_whisper import WhisperModel
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
from fastapi import FastAPI, UploadFile, File
from pydantic import BaseModel
from typing import List
import shutil
import os

app = FastAPI()

# ─────────────────────────────────────────────
# Whisper Model
# ─────────────────────────────────────────────
whisper_model = WhisperModel(
    "base",
    device="cpu",
    compute_type="int8"
)

# ─────────────────────────────────────────────
# NLLB Translation Model
# ─────────────────────────────────────────────
model_name = "facebook/nllb-200-distilled-600M"

tokenizer = AutoTokenizer.from_pretrained(model_name)
translator_model = AutoModelForSeq2SeqLM.from_pretrained(model_name)

# ─────────────────────────────────────────────
# Request Schemas
# ─────────────────────────────────────────────

class TranslateRequest(BaseModel):
    text: str
    source_lang: str
    target_lang: str

class TranslateItem(BaseModel):
    text: str
    src: str   # e.g. "vie_Latn"
    tgt: str   # e.g. "eng_Latn"

class BatchTranslateRequest(BaseModel):
    items: List[TranslateItem]

# ─────────────────────────────────────────────
# Helper
# ─────────────────────────────────────────────

def do_translate(text: str, src_lang: str, tgt_lang: str) -> str:
    """Core translation logic — dùng chung cho cả single và batch."""
    tokenizer.src_lang = src_lang

    inputs = tokenizer(text, return_tensors="pt", padding=True, truncation=True, max_length=512)

    translated_tokens = translator_model.generate(
        **inputs,
        forced_bos_token_id=tokenizer.convert_tokens_to_ids(tgt_lang),
        max_length=200,
        num_beams=4,
        early_stopping=True
    )

    return tokenizer.batch_decode(translated_tokens, skip_special_tokens=True)[0]

# ─────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    """Speech-to-text dùng Whisper."""
    file_path = f"temp_{file.filename}"

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    segments, info = whisper_model.transcribe(file_path, language="vi")
    text = " ".join([segment.text for segment in segments])

    os.remove(file_path)

    return {
        "text": text,
        "language": info.language
    }


@app.post("/translate")
async def translate(req: TranslateRequest):
    """Dịch 1 text — dùng field source_lang/target_lang (giữ backward compatible)."""
    translated = do_translate(req.text, req.source_lang, req.target_lang)
    return {"translated_text": translated}


@app.post("/translate/batch")
async def translate_batch(req: BatchTranslateRequest):
    """
    Dịch nhiều text cùng lúc — Spring TranslationBatchService gọi endpoint này.
    Input:  { "items": [{ "text": "...", "src": "vie_Latn", "tgt": "eng_Latn" }] }
    Output: ["translated_1", "translated_2", ...]
    """
    results = []

    for item in req.items:
        try:
            translated = do_translate(item.text, item.src, item.tgt)
            results.append(translated)
        except Exception as e:
            print(f"[ERROR] Logic dịch bị lỗi: {e}") # In lỗi cụ thể ra đây
            results.append(f"ERROR: {str(e)}") # Trả về lỗi thay vì text gốc để dễ debug

    return results