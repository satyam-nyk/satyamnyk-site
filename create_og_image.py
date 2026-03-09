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

# Draw main content on left side
draw.text((60, 95), "Satyam Nayak", font=title_font, fill=cyan)
draw.text((60, 215), "Technical Product Manager", font=role_font, fill=cyan)

draw.text((60, 305), "Design & Scale Platform Products", font=desc_font, fill=light_gray)
draw.text((60, 365), "AI Systems  •  Integration Workflows", font=desc_font, fill=light_gray)

draw.text((60, 475), "5+ Years  •  Startup Founder  •  Metrics-Driven", font=desc_font, fill=gray)

draw.text((60, 565), "satyamnyk.com", font=url_font, fill=light_cyan)

# Load and add profile image on right side (1:1 ratio square)
try:
    profile = Image.open('assets/profile.png')
    
    # Create square crop from profile
    width, height = profile.size
    size = min(width, height)
    left = (width - size) // 2
    top = (height - size) // 2
    profile_square = profile.crop((left, top, left + size, top + size))
    
    # Resize to fit in right side (400x400 square)
    profile_square = profile_square.resize((400, 400), Image.Resampling.LANCZOS)
    
    # Add rounded corners
    mask = Image.new('L', (400, 400), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle((0, 0, 400, 400), radius=20, fill=255)
    profile_square.putalpha(mask)
    
    # Paste image on right side, centered vertically
    x_pos = 750
    y_pos = (630 - 400) // 2
    img.paste(profile_square, (x_pos, y_pos), profile_square)
    
except Exception as e:
    print(f"Note: Could not load profile image: {e}")

# Save as PNG
img = img.convert('RGB')  # Remove alpha channel for final PNG
img.save('assets/og-image.png', 'PNG', quality=95)
print("✅ PNG OG image with profile photo created successfully!")

