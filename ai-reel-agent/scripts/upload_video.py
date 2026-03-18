#!/usr/bin/env python3
"""
Upload the reel to 0x0.st (no-bullshit file hosting) and get a public URL.
Falls back to transfer.sh if needed.
"""

import json
import subprocess
import sys
from pathlib import Path

VIDEOS_DIR = Path(__file__).parent.parent / "videos"
video_arg = Path(sys.argv[1]) if len(sys.argv) > 1 else (VIDEOS_DIR / "reel_voice_subtitles_1080x1920.mp4")
VIDEO = video_arg if video_arg.is_absolute() else (Path.cwd() / video_arg)
if not VIDEO.exists() and not video_arg.is_absolute():
    VIDEO = VIDEOS_DIR / video_arg

meta_candidates = [VIDEOS_DIR / "reel_voice_meta.json", VIDEOS_DIR / "reel_meta.json"]
META_FILE = next((m for m in meta_candidates if m.exists()), VIDEOS_DIR / "reel_voice_meta.json")

if not VIDEO.exists():
    print(f"❌ Video not found: {VIDEO}")
    sys.exit(1)

size_mb = VIDEO.stat().st_size / 1024 / 1024
print(f"📦 Uploading {VIDEO.name} ({size_mb:.1f} MB)...")

# Try catbox first (most reliable for direct mp4 links)
cat = subprocess.run(
    ["curl", "-F", "reqtype=fileupload", "-F", f"fileToUpload=@{VIDEO}", "https://catbox.moe/user/api.php"],
    capture_output=True, text=True, timeout=120
)
cat_url = cat.stdout.strip()

if cat.returncode == 0 and cat_url.startswith("http"):
    print(f"\n✅ Uploaded to: {cat_url}")
    meta = json.loads(META_FILE.read_text()) if META_FILE.exists() else {}
    meta["video_file"] = str(VIDEO)
    meta["video_url"] = cat_url
    META_FILE.write_text(json.dumps(meta, indent=2))
    print(f"💾 URL saved to {META_FILE.name}")
    print(f"\n🔗 Public video URL:\n{cat_url}")
    sys.exit(0)

# Then try 0x0.st
result = subprocess.run(
    ["curl", "-F", f"file=@{VIDEO}", "https://0x0.st"],
    capture_output=True, text=True, timeout=120
)
url = result.stdout.strip()

if result.returncode == 0 and url.startswith("http"):
    print(f"\n✅ Uploaded to: {url}")
    # Save URL
    meta = json.loads(META_FILE.read_text()) if META_FILE.exists() else {}
    meta["video_file"] = str(VIDEO)
    meta["video_url"] = url
    META_FILE.write_text(json.dumps(meta, indent=2))
    print(f"💾 URL saved to {META_FILE.name}")
    print(f"\n🔗 Public video URL:\n{url}")
else:
    print(f"0x0.st failed: {result.stderr[:200]}")
    # Try transfer.sh
    print("Trying transfer.sh...")
    result2 = subprocess.run(
        ["curl", "--upload-file", str(VIDEO),
         f"https://transfer.sh/{VIDEO.name}"],
        capture_output=True, text=True, timeout=120
    )
    url2 = result2.stdout.strip()
    if result2.returncode == 0 and url2.startswith("http"):
        print(f"\n✅ Uploaded to: {url2}")
        meta = json.loads(META_FILE.read_text()) if META_FILE.exists() else {}
        meta["video_file"] = str(VIDEO)
        meta["video_url"] = url2
        META_FILE.write_text(json.dumps(meta, indent=2))
        print(f"\n🔗 Public video URL:\n{url2}")
    else:
        print(f"❌ Both uploads failed.\ntransfer.sh stderr: {result2.stderr[:300]}")
        sys.exit(1)
