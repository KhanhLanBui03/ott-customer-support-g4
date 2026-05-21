from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

model_name = "facebook/nllb-200-distilled-600M"

tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForSeq2SeqLM.from_pretrained(model_name)

text = "My name is Phạm Văn Hinh and I am a software engineer."

# Protect names/entities
protected = {
    "__NAME_0__": "Phạm Văn Hinh"
}

# Replace real name with placeholder
for key, value in protected.items():
    text = text.replace(value, key)

tokenizer.src_lang = "eng_Latn"

inputs = tokenizer(text, return_tensors="pt")

translated_tokens = model.generate(
    **inputs,
    forced_bos_token_id=tokenizer.convert_tokens_to_ids("vie_Latn"),
    max_length=30
)

translated_text = tokenizer.batch_decode(
    translated_tokens,
    skip_special_tokens=True
)[0]

# Restore original name
for key, value in protected.items():
    translated_text = translated_text.replace(key, value)

print(translated_text)