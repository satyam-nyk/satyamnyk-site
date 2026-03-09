#!/usr/bin/env python3
from PIL import Image, ImageDraw

# Create base image with clean dark background
img = Image.new('RGB', (1200, 630), color=(20, 25, 40))
draw = ImageDraw.Draw(img)

# Load and add profile image - make it large as the focal point
try:
    profile = Image.open('assets/profile.png')
    
    # Create square crop from profile
    width, height = profile.size
    size = min(width, height)
    left = (width - size) // 2
    top = (height - size) // 2
    profile_square = profile.crop((left, top, left + size, top + size))
    
    # Resize to large square (550x550)
    profile_square = profile_square.resize((550, 550), Image.Resampling.LANCZOS)
    
    # Add rounded corners
    mask = Image.new('L', (550, 550), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle((0, 0, 550, 550), radius=30, fill=255)
    profile_square.putalpha(mask)
    
    # Center the image on the card
    x_pos = (1200 - 550) // 2
    y_pos = (630 - 550) // 2
    img.paste(profile_square, (x_pos, y_pos), profile_square)
    
except Exception as e:
    print(f"Note: Could not load profile image: {e}")

# Convert and save as PNG
img = img.convert('RGB')
img.save('assets/og-image.png', 'PNG', quality=95)
print("✅ Profile photo focused OG image created!")



