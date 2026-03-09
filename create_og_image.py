#!/usr/bin/env python3
from PIL import Image, ImageDraw, ImageFont

# Create base image with poster background color (#2596be)
img = Image.new('RGB', (1200, 630), color=(37, 150, 190))
draw = ImageDraw.Draw(img)

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

# Convert and save as PNG
img = img.convert('RGB')
img.save('assets/og-image.png', 'PNG', quality=95)
print("✅ OG poster image created!")




