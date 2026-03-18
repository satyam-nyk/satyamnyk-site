#!/usr/bin/env python3
"""
Create a higher-quality 1080x1920 reel for free:
- Script source: videos/script.json (from generate-script.js) or built-in fallback
- Voiceover: ElevenLabs (if key present) then Edge TTS (free, non-macOS)
- Subtitles: rendered directly on slides via Pillow (no ffmpeg drawtext dependency)
- Background music: generated ambient bed via ffmpeg lavfi (free)
- Output: videos/reel_voice_subtitles_1080x1920.mp4
"""

import json
import os
import re
import subprocess
import urllib.error
import urllib.request
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

PROJECT_ROOT = Path(__file__).parent.parent
VIDEOS_DIR = PROJECT_ROOT / "videos"
WORK_DIR = VIDEOS_DIR / "voice_pipeline"
IMAGES_DIR = WORK_DIR / "images"
SEGMENTS_DIR = WORK_DIR / "segments"
VIDEOS_DIR.mkdir(exist_ok=True)
WORK_DIR.mkdir(exist_ok=True)
IMAGES_DIR.mkdir(exist_ok=True)
SEGMENTS_DIR.mkdir(exist_ok=True)

SCRIPT_PATH = VIDEOS_DIR / "script.json"
OUT_VIDEO = VIDEOS_DIR / "reel_voice_subtitles_1080x1920.mp4"
META_PATH = VIDEOS_DIR / "reel_voice_meta.json"
ENV_PATH = PROJECT_ROOT / ".env"

W, H = 1080, 1920
FPS = 30

DEFAULT_SCRIPT = {
    "topic": "AI Jobs Shift in 2026",
    "slides": [
        {"text": "Automation is replacing repetitive work across industries", "duration": 7, "emoji": "AI"},
        {"text": "Factory and office workflows are being rebuilt with AI", "duration": 7, "emoji": "WORK"},
        {"text": "New roles are opening in model operations and safety", "duration": 7, "emoji": "NEW"},
        {"text": "Prompting and verification are now practical career skills", "duration": 7, "emoji": "SKILL"},
        {"text": "People who reskill early are moving ahead faster", "duration": 7, "emoji": "LEARN"},
        {"text": "Employers value adaptability more than static credentials", "duration": 7, "emoji": "CAREER"},
        {"text": "Global competitiveness now depends on AI literacy", "duration": 7, "emoji": "GLOBAL"},
        {"text": "Your move is simple: learn tools and ship real work", "duration": 8, "emoji": "ACT"},
    ],
    "caption": "AI is changing work in 2026. Adapt early, reskill fast, stay relevant.\n\n#AI #FutureOfWork #Automation #Jobs2026 #ArtificialIntelligence #TechNews #CareerAdvice #WorkTrends #Technology #Reskilling",
}


def run(cmd):
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"Command failed: {' '.join(cmd)}\n{res.stderr[-700:]}")
    return res


def probe_duration(path):
    res = run([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "csv=p=0", str(path)
    ])
    return float(res.stdout.strip())


def atempo_chain(factor):
    # ffmpeg atempo supports 0.5..2.0 per filter; chain when outside range.
    parts = []
    remaining = factor
    while remaining > 2.0:
        parts.append("atempo=2.0")
        remaining /= 2.0
    while remaining < 0.5:
        parts.append("atempo=0.5")
        remaining /= 0.5
    parts.append(f"atempo={remaining:.5f}")
    return ",".join(parts)


def load_script():
    if SCRIPT_PATH.exists():
        with open(SCRIPT_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        if data.get("slides"):
            return data
    return DEFAULT_SCRIPT


def load_env_file():
    data = {}
    if not ENV_PATH.exists():
        return data
    for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        data[k.strip()] = v.strip()
    return data


def synthesize_with_elevenlabs(text, out_mp3, env):
    api_key = env.get("ELEVENLABS_API_KEY")
    if not api_key:
        return False

    voice_id = env.get("ELEVENLABS_VOICE_ID", "JBFqnCBsd6RMkjVDRZzb")
    model_id = env.get("ELEVENLABS_MODEL_ID", "eleven_multilingual_v2")
    stability = float(env.get("ELEVENLABS_STABILITY", "0.35"))
    similarity = float(env.get("ELEVENLABS_SIMILARITY_BOOST", "0.85"))
    style = float(env.get("ELEVENLABS_STYLE", "0.25"))

    url = (
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
        "?output_format=mp3_44100_128"
    )
    payload = {
        "text": text,
        "model_id": model_id,
        "voice_settings": {
            "stability": stability,
            "similarity_boost": similarity,
            "style": style,
        },
    }

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "xi-api-key": api_key,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            audio = resp.read()
        out_mp3.write_bytes(audio)
        return True
    except urllib.error.HTTPError as e:
        msg = e.read().decode("utf-8", errors="ignore")
        print(f"ElevenLabs HTTP error: {e.code} {msg[:300]}")
        return False
    except Exception as e:
        print(f"ElevenLabs error: {e}")
        return False


def ensure_edge_tts_available(env):
    check = subprocess.run(["python3", "-m", "edge_tts", "--help"], capture_output=True, text=True)
    if check.returncode == 0:
        return True

    auto_install = env.get("AUTO_INSTALL_EDGE_TTS", "1") == "1"
    if not auto_install:
        return False

    print("Installing edge-tts...")
    install = subprocess.run(["python3", "-m", "pip", "install", "edge-tts"], capture_output=True, text=True)
    if install.returncode != 0:
        print("edge-tts install failed:", install.stderr[-300:])
        return False

    verify = subprocess.run(["python3", "-m", "edge_tts", "--help"], capture_output=True, text=True)
    return verify.returncode == 0


def synthesize_with_edge_tts(text, out_mp3, env):
    if not ensure_edge_tts_available(env):
        return False

    voice = env.get("EDGE_TTS_VOICE", "en-US-AvaMultilingualNeural")
    rate = env.get("EDGE_TTS_RATE", "+0%")
    cmd = [
        "python3", "-m", "edge_tts",
        "--voice", voice,
        "--rate", rate,
        "--text", text,
        "--write-media", str(out_mp3),
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"Edge TTS failed: {res.stderr[-300:]}")
        return False
    return out_mp3.exists() and out_mp3.stat().st_size > 0


def font_candidates():
    return [
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/HelveticaNeue.ttc",
        "/Library/Fonts/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]


def get_font(size):
    for p in font_candidates():
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
    return ImageFont.load_default()


def wrap(draw, text, font, max_width):
    words = text.split()
    lines = []
    curr = ""
    for w in words:
        candidate = (curr + " " + w).strip()
        box = draw.textbbox((0, 0), candidate, font=font)
        if box[2] - box[0] <= max_width:
            curr = candidate
        else:
            if curr:
                lines.append(curr)
            curr = w
    if curr:
        lines.append(curr)
    return lines


def gradient_for_idx(idx):
    palettes = [
        ((25, 28, 66), (89, 47, 149)),
        ((14, 40, 80), (38, 120, 180)),
        ((20, 55, 45), (80, 160, 120)),
        ((60, 24, 32), (180, 85, 100)),
        ((32, 32, 32), (90, 90, 110)),
        ((48, 20, 80), (130, 60, 175)),
        ((20, 62, 70), (85, 154, 170)),
        ((100, 45, 10), (190, 115, 45)),
    ]
    return palettes[idx % len(palettes)]


def draw_infographic(draw, slide, idx):
    g = str(slide.get("graphic", "stat")).lower().strip()
    stat = str(slide.get("stat_value", "")).strip()

    panel = [120, 360, W - 120, 660]
    draw.rounded_rectangle(panel, radius=28, fill=(255, 255, 255, 32), outline=(255, 255, 255, 100), width=3)

    if g == "bar":
        vals = [52, 68, 39, 74]
        labels = ["Q1", "Q2", "Q3", "Q4"]
        base_y = 610
        x0 = 190
        for i, v in enumerate(vals):
            x = x0 + i * 170
            h = int(v * 2.8)
            draw.rectangle([x, base_y - h, x + 90, base_y], fill=(130, 190, 255), outline=(245, 250, 255), width=2)
            draw.text((x + 45, base_y + 24), labels[i], anchor="mm", font=get_font(24), fill=(235, 240, 255))
    elif g == "line":
        pts = [(190, 560), (340, 520), (500, 540), (670, 470), (860, 430)]
        draw.line(pts, fill=(160, 230, 255), width=7)
        for p in pts:
            draw.ellipse([p[0] - 8, p[1] - 8, p[0] + 8, p[1] + 8], fill=(255, 255, 255))
    elif g == "timeline":
        y = 520
        draw.line([(180, y), (900, y)], fill=(220, 235, 255), width=5)
        years = ["2023", "2024", "2025", "2026"]
        for i, yr in enumerate(years):
            x = 220 + i * 220
            draw.ellipse([x - 14, y - 14, x + 14, y + 14], fill=(255, 255, 255))
            draw.text((x, y + 42), yr, anchor="mm", font=get_font(24), fill=(235, 240, 255))
    elif g == "split":
        draw.rounded_rectangle([210, 420, 520, 620], radius=20, fill=(111, 185, 255), outline=(255, 255, 255), width=2)
        draw.rounded_rectangle([560, 420, 870, 620], radius=20, fill=(255, 145, 145), outline=(255, 255, 255), width=2)
        draw.text((365, 520), "Side A", anchor="mm", font=get_font(34), fill=(15, 20, 30))
        draw.text((715, 520), "Side B", anchor="mm", font=get_font(34), fill=(30, 12, 12))
    elif g == "map":
        cx, cy, r = 540, 510, 130
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(235, 245, 255), width=5)
        for dy in [-70, -30, 10, 50]:
            rr = int((r * r - dy * dy) ** 0.5)
            draw.arc([cx - rr, cy + dy - 2, cx + rr, cy + dy + 2], 0, 360, fill=(210, 225, 255), width=2)
        draw.arc([cx - r + 26, cy - r, cx + r - 26, cy + r], 90, 270, fill=(210, 225, 255), width=2)
        draw.arc([cx - r + 60, cy - r, cx + r - 60, cy + r], 90, 270, fill=(210, 225, 255), width=2)
    elif g == "arrow":
        draw.line([(250, 590), (500, 510), (690, 540), (880, 430)], fill=(170, 235, 180), width=10)
        draw.polygon([(880, 430), (845, 442), (860, 400)], fill=(170, 235, 180))
    else:
        if not stat:
            stat = "KEY METRIC"
        draw.text((W // 2, 500), stat, anchor="mm", font=get_font(74), fill=(245, 248, 255))

    if stat:
        draw.text((W // 2, 635), stat, anchor="mm", font=get_font(28), fill=(230, 240, 255))


def render_slide(slide, idx, total):
    img = Image.new("RGB", (W, H), "black")
    draw = ImageDraw.Draw(img)

    c1, c2 = gradient_for_idx(idx)
    for y in range(H):
        t = y / (H - 1)
        r = int(c1[0] + (c2[0] - c1[0]) * t)
        g = int(c1[1] + (c2[1] - c1[1]) * t)
        b = int(c1[2] + (c2[2] - c1[2]) * t)
        draw.line([(0, y), (W, y)], fill=(r, g, b))

    draw.rectangle([0, 0, W, 10], fill=(255, 255, 255))
    draw.rectangle([0, H - 10, W, H], fill=(255, 255, 255))

    draw_infographic(draw, slide, idx)

    f_counter = get_font(30)
    counter = f"{idx + 1}/{total}"
    cb = draw.textbbox((0, 0), counter, font=f_counter)
    cw = cb[2] - cb[0] + 24
    cx = (W - cw) // 2
    draw.rounded_rectangle([cx, 150, cx + cw, 205], radius=16, fill=(255, 255, 255, 50))
    draw.text((W // 2, 176), counter, anchor="mm", font=f_counter, fill=(240, 240, 240))

    f_head = get_font(86)
    f_sub = get_font(50)
    f_brand = get_font(34)

    text = slide.get("text", "").strip()
    parts = re.split(r"\s*[.-]\s*", text, maxsplit=1)
    headline = parts[0].upper()
    sub = parts[1] if len(parts) > 1 else text

    head_lines = wrap(draw, headline, f_head, W - 120)
    sub_lines = wrap(draw, sub, f_sub, W - 140)

    y = 700
    for line in head_lines:
        draw.text((W // 2, y), line, anchor="mm", font=f_head, fill=(255, 255, 255))
        y += 100

    y += 40
    for line in sub_lines:
        draw.text((W // 2, y), line, anchor="mm", font=f_sub, fill=(230, 240, 255))
        y += 64

    # Subtitle band at bottom for readability
    draw.rounded_rectangle([70, H - 390, W - 70, H - 210], radius=20, fill=(0, 0, 0, 130))
    subtitle_lines = wrap(draw, text, get_font(42), W - 180)
    sy = H - 340
    for line in subtitle_lines[:2]:
        draw.text((W // 2, sy), line, anchor="mm", font=get_font(42), fill=(255, 255, 255))
        sy += 52

    draw.text((W // 2, H - 110), "@GlobalDailyDose", anchor="mm", font=f_brand, fill=(230, 230, 230))

    out = IMAGES_DIR / f"slide_{idx:02d}.png"
    img.save(out)
    return out


def main():
    env = load_env_file()
    script = load_script()
    slides = script["slides"]
    total = sum(int(s.get("duration", 7)) for s in slides)

    print(f"Topic: {script.get('topic', 'Untitled')}")
    print(f"Slides: {len(slides)}")
    print(f"Target duration: {total}s")

    segment_files = []
    narration_lines = []

    for i, slide in enumerate(slides):
        image = render_slide(slide, i, len(slides))
        duration = int(slide.get("duration", 7))
        segment = SEGMENTS_DIR / f"seg_{i:02d}.mp4"
        segment_files.append(segment)

        # Subtle motion with zoompan for better visual quality.
        vf = (
            f"scale={W*2}:{H*2},"
            f"zoompan=z='min(1.12,1+0.0012*on)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':"
            f"d={duration * FPS}:s={W}x{H}:fps={FPS},format=yuv420p"
        )
        run([
            "ffmpeg", "-y", "-loop", "1", "-i", str(image),
            "-t", str(duration), "-r", str(FPS), "-vf", vf,
            "-c:v", "libx264", "-preset", "medium", "-crf", "19", str(segment)
        ])

        narration_lines.append(slide.get("text", ""))
        print(f"Built slide {i+1}/{len(slides)}")

    concat_file = WORK_DIR / "concat_segments.txt"
    concat_file.write_text("\n".join([f"file '{p}'" for p in segment_files]), encoding="utf-8")

    silent_video = WORK_DIR / "silent_video.mp4"
    run([
        "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(concat_file),
        "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p",
        "-movflags", "+faststart", str(silent_video)
    ])

    # Voiceover: ElevenLabs first, then Edge TTS. No macOS say fallback.
    narration_text = ". ".join(narration_lines)
    narration_text = re.sub(r"\s+", " ", narration_text).strip()
    voice_mp3 = WORK_DIR / "voice.mp3"
    voice_m4a = WORK_DIR / "voice.m4a"
    voice_fit = WORK_DIR / "voice_fit.m4a"

    provider_pref = env.get("TTS_PROVIDER", "auto").lower()
    used_provider = "unknown"
    used_voice = "unknown"

    elevenlabs_ok = False
    if provider_pref in ("elevenlabs", "auto"):
        elevenlabs_ok = synthesize_with_elevenlabs(narration_text, voice_mp3, env)

    if elevenlabs_ok:
        run(["ffmpeg", "-y", "-i", str(voice_mp3), "-c:a", "aac", "-b:a", "160k", str(voice_m4a)])
        used_provider = "elevenlabs"
        used_voice = env.get("ELEVENLABS_VOICE_ID", "JBFqnCBsd6RMkjVDRZzb")
        print("Voiceover provider: ElevenLabs")
    else:
        edge_ok = provider_pref in ("edge", "auto", "elevenlabs") and synthesize_with_edge_tts(narration_text, voice_mp3, env)
        if edge_ok:
            run(["ffmpeg", "-y", "-i", str(voice_mp3), "-c:a", "aac", "-b:a", "160k", str(voice_m4a)])
            used_provider = "edge-tts"
            used_voice = env.get("EDGE_TTS_VOICE", "en-US-AvaMultilingualNeural")
            print("Voiceover provider: Edge TTS")
        else:
            raise RuntimeError(
                "No TTS provider available. Set ELEVENLABS_API_KEY or install/use Edge TTS."
            )

    voice_duration = probe_duration(voice_m4a)
    tempo = voice_duration / total
    tempo_filter = atempo_chain(tempo)
    run([
        "ffmpeg", "-y", "-i", str(voice_m4a), "-af", tempo_filter,
        "-t", str(total), "-c:a", "aac", "-b:a", "160k", str(voice_fit)
    ])

    # Free generated ambient music bed
    music = WORK_DIR / "music.m4a"
    run([
        "ffmpeg", "-y",
        "-f", "lavfi", "-i", f"sine=frequency=220:duration={total}:sample_rate=44100",
        "-f", "lavfi", "-i", f"sine=frequency=330:duration={total}:sample_rate=44100",
        "-filter_complex", "[0:a]volume=0.05[a0];[1:a]volume=0.03[a1];[a0][a1]amix=inputs=2:normalize=0,lowpass=f=1200,afade=t=in:st=0:d=2,afade=t=out:st={}:d=2".format(max(0, total - 2)),
        "-c:a", "aac", "-b:a", "128k", str(music)
    ])

    # Mix narration + background music
    mix = WORK_DIR / "mix.m4a"
    run([
        "ffmpeg", "-y", "-i", str(voice_fit), "-i", str(music),
        "-filter_complex", "[0:a]volume=1.35[v];[1:a]volume=0.22[m];[v][m]amix=inputs=2:normalize=0,alimiter=limit=0.95[a]",
        "-map", "[a]", "-t", str(total), "-c:a", "aac", "-b:a", "192k", str(mix)
    ])

    # Final mux
    run([
        "ffmpeg", "-y", "-i", str(silent_video), "-i", str(mix),
        "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", str(OUT_VIDEO)
    ])

    out_dur = probe_duration(OUT_VIDEO)
    meta = {
        "video": str(OUT_VIDEO),
        "topic": script.get("topic"),
        "duration": out_dur,
        "caption": script.get("caption", ""),
        "source_script": str(SCRIPT_PATH if SCRIPT_PATH.exists() else "built-in-fallback"),
        "tts_provider": used_provider,
        "tts_voice": used_voice,
    }
    META_PATH.write_text(json.dumps(meta, indent=2), encoding="utf-8")

    print("Done")
    print(f"Output: {OUT_VIDEO}")
    print(f"Duration: {out_dur:.1f}s")
    print(f"Meta: {META_PATH}")


if __name__ == "__main__":
    main()
