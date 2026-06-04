from PIL import Image
import os
import shutil

# Source icon path
SOURCE_ICON = r"C:\Users\thanh\.gemini\antigravity-ide\brain\d1b82281-5306-467a-8f0c-f0e3aff4fa87\f5chat_icon_1780556914485.png"

# Android mipmap sizes
SIZES = {
    "mipmap-mdpi":    48,
    "mipmap-hdpi":    72,
    "mipmap-xhdpi":   96,
    "mipmap-xxhdpi":  144,
    "mipmap-xxxhdpi": 192,
}

RES_BASE = r"C:\Users\thanh\Desktop\CongNgheMoi\ott-customer-support-g4\mobile\android\app\src\main\res"

def resize_icon(src, dst, size):
    img = Image.open(src).convert("RGBA")
    img = img.resize((size, size), Image.LANCZOS)
    img.save(dst, "WEBP", quality=95)
    print(f"  OK Saved {size}x{size} -> {dst}")

print("Generating F5 Chat icons...\n")

img_src = Image.open(SOURCE_ICON)
print(f"Source icon: {img_src.size[0]}x{img_src.size[1]} px")

for folder, size in SIZES.items():
    folder_path = os.path.join(RES_BASE, folder)
    os.makedirs(folder_path, exist_ok=True)
    
    # ic_launcher
    launcher_dst = os.path.join(folder_path, "ic_launcher.webp")
    resize_icon(SOURCE_ICON, launcher_dst, size)
    
    # ic_launcher_round (same image for round)
    round_dst = os.path.join(folder_path, "ic_launcher_round.webp")
    resize_icon(SOURCE_ICON, round_dst, size)

# Also save a copy to drawable for splash
drawable_path = os.path.join(RES_BASE, "drawable")
os.makedirs(drawable_path, exist_ok=True)

print("\nAll icons generated successfully!")
print(f"\nIcons saved to: {RES_BASE}")
