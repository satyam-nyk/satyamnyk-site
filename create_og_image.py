#!/usr/bin/env python3
from PIL import Image, ImageDraw, ImageFont

# Create base image with dark background
img = Image.new('RGB', (1200, 630), color=(10, 14, 26))
draw = ImageDraw.Draw(img)

# Draw gradient background
for y in range(630):
    ratio = y / 630.0
    r = int(26 * (1 - ratio) + 10 * ratio)
    g = int(32 * (1 - ratio) + 14 * ratio)
    b = int(51 * (1 - ratio) + 26 * ratio)
    draw.line([(0, y), (1200, y)], fill=(r, g, b))

# Load fonts
try:
    title_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 100)
    role_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 55)
    desc_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 38)
    url_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 26)
except:
    title_font = role_font = desc_font = url_font = ImageFont.load_default()

# Colors
cyan = (92, 200, 255)
light_gray = (210, 210, 210)
gray = (160, 160, 160)
light_cyan = (100, 180, 255)
purple = (124, 58, 237)

# Draw accent circles (circles with transparency effect via lighter color)
draw.ellipse([750, -80, 1350, 520], outline=cyan, width=0)
draw.ellipse([-80, 300, 420, 800], outline=purple, width=0)

# Draw main content
draw.text((60, 95), "Satyam Nayak", font=title_font, fill=cyan)
draw.text((60, 215), "Technical Product Manager", font=role_font, fill=cyan)

draw.text((60, 305), "Design & Scale Platform Products", font=desc_font, fill=light_gray)
draw.text((60, 365), "AI Systems  •  Integration Workflows", font=desc_font, fill=light_gray)

draw.text((60, 475), "5+ Years  •  Startup Founder  •  Metrics-Driven", font=desc_font, fill=gray)

draw.text((60, 565), "satyamnyk.com", font=url_font, fill=light_cyan)

# Draw accent border rectangle
draw.rectangle([900, 80, 1150, 550], outline=cyan, width=2)

# Save as PNG
img.save('assets/og-image.png', 'PNG', quality=95)
print("✅ PNG OG image created successfully!")
