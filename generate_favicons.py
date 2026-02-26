from PIL import Image
import os

SOURCE = "icon.png"
OUTPUT_DIR = "favicons"
os.makedirs(OUTPUT_DIR, exist_ok=True)

img = Image.open(SOURCE).convert("RGBA")

# Standard favicon sizes
sizes = [16, 32, 48, 64, 128, 180, 192, 512]

for size in sizes:
    resized = img.resize((size, size), Image.LANCZOS)
    resized.save(os.path.join(OUTPUT_DIR, f"favicon-{size}x{size}.png"))
    print(f"Created favicon-{size}x{size}.png")

# Generate .ico with multiple sizes embedded
ico_sizes = [(16, 16), (32, 32), (48, 48), (64, 64)]
ico_images = [img.resize(s, Image.LANCZOS) for s in ico_sizes]
ico_images[0].save(
    os.path.join(OUTPUT_DIR, "favicon.ico"),
    format="ICO",
    sizes=ico_sizes,
    append_images=ico_images[1:],
)
print("Created favicon.ico")

# Copy apple-touch-icon (180x180 is the standard)
img.resize((180, 180), Image.LANCZOS).save(os.path.join(OUTPUT_DIR, "apple-touch-icon.png"))
print("Created apple-touch-icon.png")

print(f"\nAll favicons saved to '{OUTPUT_DIR}/'")
