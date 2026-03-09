#!/usr/bin/env python3
from PIL import Image, ImageDraw, ImageFont

# Create base image with dark background
img = Image.new('RGB', (1200, 630), color=(10, 14, 26))
draw = ImageDraw.Draw(img)

# Draw gradient background (poster style)
for y in range(630):
    ratio = y / 630.0
    r = int(26 * (1 - ratio) + 10 * ratio)
    g = int(32 * (1 - ratio) + 14 * ratio)
    b = int(51 * (1 - ratio) + 26 * ratio)
    draw.line([(0, y), (1200, y)], fill=(r, g, b))

# Draw geometric pattern in top right (network/constellation style)
import random
random.seed(42)
accent_color = (92, 200, 255)
for i in range(15):
    x = random.randint(800, 1200)
    y = random.randint(100, 350)
    draw.ellipse([x-3, y-3, x+3, y+3], fill=accent_color)
    # Connect some dots
    if i > 0 and i % 3 == 0:
        prev_x = random.randint(800, 1200)
        prev_y = random.randint(100, 350)
        draw.line([(x, y), (prev_x, prev_y)], fill=accent_color, width=1)

# Load fonts
try:
    title_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 90)
    role_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 50)
    desc_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 32)
    url_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 24)
except:
    title_font = role_font = desc_font = url_font = ImageFont.load_default()

# Colors
cyan = (92, 200, 255)
light_gray = (200, 200, 200)
gray = (150, 150, 150)
light_cyan = (100, 180, 255)

# Draw main content on left side
draw.text((50, 80), "Satyam Nayak", font=title_font, fill=cyan)
draw.text((50, 180), "Technical Product Manager", font=role_font, fill=cyan)

draw.text((50, 270), "Design & Scale Platform Products", font=desc_font, fill=light_gray)
draw.text((50, 315), "AI Systems  •  Integration Workflows", font=desc_font, fill=light_gray)

draw.text((50, 420), "5+ Years  •  Startup Founder  •  Metrics-Driven", font=desc_font, fill=gray)

draw.text((50, 540), "satyamnyk.com", font=url_font, fill=light_cyan)

# Load and add profile image on right side
try:
    profile = Image.open('assets/profile.png')
    
    # Create square crop from profile
    width, height = profile.size
    size = min(width, height)
    left = (width - size) // 2
    top = (height - size) // 2
    profile_square = profile.crop((left, top, left + size, top + size))
    
    # Resize to fit in right side (350x350 square)
    profile_square = profile_square.resize((350, 350), Image.Resampling.LANCZOS)
    
    # Add rounded corners
    mask = Image.new('L', (350, 350), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle((0, 0, 350, 350), radius=20, fill=255)
    profile_square.putalpha(mask)
    
    # Paste image on right side, centered vertically
    x_pos = 750
    y_pos = (630 - 350) // 2
    img.paste(profile_square, (x_pos, y_pos), profile_square)
    
except Exception as e:
    print(f"Note: Could not load profile image: {e}")

# Convert and save as PNG
img = img.convert('RGB')
img.save('assets/og-poster.png', 'PNG', quality=95)
print("✅ OG poster with profile photo and accent pattern created!")




