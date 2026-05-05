from faster_whisper import WhisperModel
from fastapi import FastAPI, UploadFile, File
import shutil
import os

app = FastAPI()

model = WhisperModel("base")

@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    file_path = f"temp_{file.filename}"

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    segments, _ = model.transcribe(
        file_path,
        language="vi"   # 👈 ép tiếng Việt
    )

    text = " ".join([segment.text for segment in segments])

    os.remove(file_path)

    return {"text": text}