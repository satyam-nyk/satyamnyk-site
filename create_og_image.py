#!/usr/bin/env python3
from PIL import Image, ImageDraw, ImageFont

# Create 1:1 square image with dark background
img = Image.new('RGB', (1200, 1200), color=(10, 14, 26))
draw = ImageDraw.Draw(img)

# Draw gradient background (poster style)
for y in range(1200):
    ratio = y / 1200.0
    r = int(26 * (1 - ratio) + 10 * ratio)
    g = int(32 * (1 - ratio) + 14 * ratio)
    b = int(51 * (1 - ratio) + 26 * ratio)
    draw.line([(0, y), (1200, y)], fill=(r, g, b))

# Draw geometric pattern in top right (network/constellation style)
import random
random.seed(42)
accent_color = (92, 200, 255)
for i in range(20):
    x = random.randint(800, 1200)
    y = random.randint(100, 500)
    draw.ellipse([x-3, y-3, x+3, y+3], fill=accent_color)
    # Connect some dots
    if i > 0 and i % 3 == 0:
        prev_x = random.randint(800, 1200)
        prev_y = random.randint(100, 500)
        draw.line([(x, y), (prev_x, prev_y)], fill=accent_color, width=1)

# Load fonts
try:
    title_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 100)
    role_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 60)
    desc_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 40)
    url_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 32)
except:
    title_font = role_font = desc_font = url_font = ImageFont.load_default()

# Colors
cyan = (92, 200, 255)
light_gray = (200, 200, 200)
gray = (150, 150, 150)
light_cyan = (100, 180, 255)

# Draw main content centered
draw.text((60, 200), "Satyam Nayak", font=title_font, fill=cyan)
draw.text((60, 340), "Technical Product Manager", font=role_font, fill=cyan)

draw.text((60, 460), "Design & Scale Platform Products", font=desc_font, fill=light_gray)
draw.text((60, 530), "AI Systems  •  Integration Workflows", font=desc_font, fill=light_gray)

draw.text((60, 650), "5+ Years  •  Startup Founder", font=desc_font, fill=light_gray)
draw.text((60, 720), "Metrics-Driven", font=desc_font, fill=light_gray)

draw.text((60, 900), "satyamnyk.com", font=url_font, fill=light_cyan)

# Convert and save as PNG
img = img.convert('RGB')
img.save('assets/og-img.png', 'PNG', quality=95)
print("✅ 1:1 Square OG image created (1200x1200)!")




