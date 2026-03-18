#!/usr/bin/env python3
"""
Generate a 1080x1920 60-second Instagram Reel using Pillow + FFmpeg.
Topic: AI Is Replacing Jobs at Record Speed in 2026
"""

import os
import json
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

# ── Paths ────────────────────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).parent.parent
VIDEOS_DIR   = PROJECT_ROOT / "videos"
FRAMES_DIR   = VIDEOS_DIR / "frames"
VIDEOS_DIR.mkdir(exist_ok=True)
FRAMES_DIR.mkdir(exist_ok=True)

OUTPUT      = VIDEOS_DIR / "reel_ai_jobs_2026.mp4"
META_FILE   = VIDEOS_DIR / "reel_meta.json"
CONCAT_FILE = VIDEOS_DIR / "concat.txt"

W, H = 1080, 1920

# ── Font helpers ─────────────────────────────────────────────────────────────
FONT_CANDIDATES = [
    # macOS
    "/System/Library/Fonts/Helvetica.ttc",
    "/System/Library/Fonts/HelveticaNeue.ttc",
    "/Library/Fonts/Arial Bold.ttf",
    "/Library/Fonts/Arial.ttf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    # Linux fallbacks
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]

def get_font(size):
    for path in FONT_CANDIDATES:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return ImageFont.load_default()

# ── Script data ───────────────────────────────────────────────────────────────
script = {
    "topic":   "AI Is Replacing Jobs at Record Speed in 2026",
    "caption": "🤖 AI is reshaping every industry in 2026. 300M jobs at risk — are you ready? \n\n#AI #FutureOfWork #Automation #AIRevolution #Jobs2026 #ArtificialIntelligence #TechNews #CareerAdvice #WorkTrends #Technology",
    "slides": [
        {
            "duration": 4,
            "emoji":    "🚨",
            "headline": "300 MILLION JOBS",
            "subtext":  "at risk from AI by 2030",
            "bg":       [(15, 12, 41), (48, 43, 99)],      # deep purple
        },
        {
            "duration": 8,
            "emoji":    "🤖",
            "headline": "AI IS NO LONGER",
            "subtext":  "the future — it is TODAY",
            "bg":       [(26, 26, 46), (22, 33, 62)],      # dark navy
        },
        {
            "duration": 7,
            "emoji":    "📉",
            "headline": "WHITE-COLLAR JOBS",
            "subtext":  "coders, analysts, writers — all disrupted",
            "bg":       [(13, 13, 13), (90, 0, 0)],        # dark red
        },
        {
            "duration": 7,
            "emoji":    "🏭",
            "headline": "MANUFACTURING",
            "subtext":  "robots replaced 40% of factory roles",
            "bg":       [(0, 40, 0), (0, 26, 0)],          # deep green
        },
        {
            "duration": 8,
            "emoji":    "💡",
            "headline": "NEW JOBS EMERGING",
            "subtext":  "AI trainers • Prompt engineers • Ethics officers",
            "bg":       [(0, 65, 106), (0, 100, 150)],     # ocean blue
        },
        {
            "duration": 7,
            "emoji":    "📚",
            "headline": "RE-SKILL NOW",
            "subtext":  "learn AI tools before they learn your job",
            "bg":       [(74, 0, 224), (142, 45, 226)],    # vivid purple
        },
        {
            "duration": 8,
            "emoji":    "🌍",
            "headline": "GLOBAL IMPACT",
            "subtext":  "developing nations hit hardest — IMF warns",
            "bg":       [(19, 78, 94), (113, 178, 128)],   # teal-green
        },
        {
            "duration": 8,
            "emoji":    "🔮",
            "headline": "ADAPT OR FALL BEHIND",
            "subtext":  "the AI age is here — your move",
            "bg":       [(180, 20, 10), (200, 130, 0)],    # red-orange
        },
    ]
}

total_duration = sum(s["duration"] for s in script["slides"])
print(f"📋 Topic: {script['topic']}")
print(f"⏱  Total duration: {total_duration}s  ({len(script['slides'])} slides)\n")

# ── Draw a slide image ────────────────────────────────────────────────────────
def draw_slide(slide, slide_idx, total_slides):
    img = Image.new("RGB", (W, H))
    draw = ImageDraw.Draw(img)

    # Vertical gradient background
    top_col    = slide["bg"][0]
    bottom_col = slide["bg"][1]
    for y in range(H):
        t   = y / H
        r   = int(top_col[0] + (bottom_col[0] - top_col[0]) * t)
        g   = int(top_col[1] + (bottom_col[1] - top_col[1]) * t)
        b   = int(top_col[2] + (bottom_col[2] - top_col[2]) * t)
        draw.line([(0, y), (W, y)], fill=(r, g, b))

    # Top & bottom accent bars
    draw.rectangle([0, 0, W, 10],        fill=(255, 255, 255, 200))
    draw.rectangle([0, H - 10, W, H],    fill=(255, 255, 255, 200))

    # Slide counter pill (top center)
    pill_text  = f"{slide_idx + 1}  /  {total_slides}"
    font_pill  = get_font(32)
    bbox       = draw.textbbox((0, 0), pill_text, font=font_pill)
    pill_w     = bbox[2] - bbox[0] + 40
    pill_h     = bbox[3] - bbox[1] + 20
    pill_x     = (W - pill_w) // 2
    draw.rounded_rectangle([pill_x, 160, pill_x + pill_w, 160 + pill_h],
                            radius=20, fill=(255, 255, 255, 40))
    draw.text(((W - (bbox[2] - bbox[0])) // 2, 170), pill_text,
              font=font_pill, fill=(255, 255, 255, 180))

    # Emoji (center-ish, upper half)
    font_emoji = get_font(110)
    draw.text((W // 2, 700), slide["emoji"], font=font_emoji,
              fill=(255, 255, 255), anchor="mm")

    # Headline (large, bold, centered, multi-line if needed)
    font_h = get_font(90)
    headline = slide["headline"]
    # Wrap if too wide
    words = headline.split()
    lines, line = [], ""
    for w in words:
        test = (line + " " + w).strip()
        bbox = draw.textbbox((0, 0), test, font=font_h)
        if bbox[2] - bbox[0] > W - 80:
            if line:
                lines.append(line)
            line = w
        else:
            line = test
    if line:
        lines.append(line)

    line_h   = 100
    total_h  = len(lines) * line_h
    start_y  = 870 - total_h // 2
    for li, ln in enumerate(lines):
        draw.text((W // 2, start_y + li * line_h), ln,
                  font=font_h, fill=(255, 255, 255), anchor="mm")

    # Subtext (smaller, centered, wrapped)
    font_s   = get_font(46)
    subtext  = slide["subtext"]
    # Simple wrap
    words2   = subtext.split()
    lines2, line2 = [], ""
    for w in words2:
        test  = (line2 + " " + w).strip()
        bbox2 = draw.textbbox((0, 0), test, font=font_s)
        if bbox2[2] - bbox2[0] > W - 120:
            if line2:
                lines2.append(line2)
            line2 = w
        else:
            line2 = test
    if line2:
        lines2.append(line2)

    sub_line_h = 60
    sub_start  = 1060
    for li, ln in enumerate(lines2):
        draw.text((W // 2, sub_start + li * sub_line_h), ln,
                  font=font_s, fill=(255, 255, 255, 210), anchor="mm")

    # Branding watermark
    font_brand = get_font(38)
    draw.text((W // 2, H - 100), "@GlobalDailyDose",
              font=font_brand, fill=(255, 255, 255, 100), anchor="mm")

    return img


# ── Generate PNG frames and build segments ────────────────────────────────────
segment_files = []
FPS = 30

print("🖼  Rendering slide images & building video segments...\n")

for i, slide in enumerate(script["slides"]):
    frame_path = FRAMES_DIR / f"slide_{i:02d}.png"
    seg_path   = VIDEOS_DIR / f"seg_{i:02d}.mp4"
    segment_files.append(str(seg_path))

    # Draw the slide image
    img = draw_slide(slide, i, len(script["slides"]))
    img.save(str(frame_path), "PNG")

    # Convert static image → video clip of slide["duration"] seconds
    cmd = [
        "ffmpeg", "-y",
        "-loop", "1",
        "-i", str(frame_path),
        "-c:v", "libx264",
        "-t", str(slide["duration"]),
        "-r", str(FPS),
        "-pix_fmt", "yuv420p",
        "-preset", "fast",
        "-crf", "22",
        "-vf", f"scale={W}:{H}",
        str(seg_path),
    ]
    result = subprocess.run(cmd, capture_output=True)
    if result.returncode != 0:
        print(f"  ❌ Segment {i} failed:\n{result.stderr.decode()[-400:]}")
        exit(1)

    print(f"  ✅ Slide {i+1}/{len(script['slides'])}: {slide['headline']} ({slide['duration']}s)")

# ── Concatenate segments ──────────────────────────────────────────────────────
print("\n🔗 Merging all segments into final reel...")

concat_content = "\n".join(f"file '{f}'" for f in segment_files)
CONCAT_FILE.write_text(concat_content)

merge_cmd = [
    "ffmpeg", "-y",
    "-f", "concat", "-safe", "0",
    "-i", str(CONCAT_FILE),
    "-c:v", "libx264",
    "-preset", "slow",
    "-crf", "18",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    str(OUTPUT),
]
result = subprocess.run(merge_cmd, capture_output=True)
if result.returncode != 0:
    print(f"❌ Merge failed:\n{result.stderr.decode()[-600:]}")
    exit(1)

# ── Verify ────────────────────────────────────────────────────────────────────
probe = subprocess.run(
    ["ffprobe", "-v", "error", "-show_entries", "format=duration",
     "-of", "csv=p=0", str(OUTPUT)],
    capture_output=True, text=True
)
duration = float(probe.stdout.strip())
size_mb   = OUTPUT.stat().st_size / 1024 / 1024

print(f"\n✅ Reel created successfully!")
print(f"   File:       {OUTPUT}")
print(f"   Dimensions: {W}x{H}  (9:16 portrait)")
print(f"   Duration:   {duration:.1f}s")
print(f"   File size:  {size_mb:.1f} MB")

# Save metadata
meta = {
    "output":   str(OUTPUT),
    "topic":    script["topic"],
    "caption":  script["caption"],
    "duration": duration,
}
META_FILE.write_text(json.dumps(meta, indent=2))
print(f"\n💾 Metadata → {META_FILE}")
print(f"\n📝 Caption ready:\n{script['caption']}")
