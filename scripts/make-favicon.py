from PIL import Image, ImageDraw
import glob
import os
from collections import deque

assets = r"C:\Users\kkh00\.cursor\projects\c-Users-kkh00-OneDrive-vibe-coding\assets"
out = r"c:\Users\kkh00\OneDrive\바탕 화면\vibe_coding\app"
public = r"c:\Users\kkh00\OneDrive\바탕 화면\vibe_coding\public"
os.makedirs(public, exist_ok=True)

# Use the M-logo asset the user attached (bbcd778c), not older variants
preferred = [
    p
    for p in glob.glob(os.path.join(assets, "*android-chrome-512x512*"))
    if "bbcd778c" in p
]
src_path = preferred[0] if preferred else sorted(
    glob.glob(os.path.join(assets, "*android-chrome-512x512*")),
    key=os.path.getmtime,
    reverse=True,
)[0]
print("source:", src_path)

img = Image.open(src_path).convert("RGBA")
w, h = img.size
pixels = img.load()


def is_blackish(r: int, g: int, b: int, a: int) -> bool:
    if a < 8:
        return True
    return r < 30 and g < 30 and b < 30


# Flood-fill transparency from corners so only outer black is removed
visited = [[False] * w for _ in range(h)]
q: deque[tuple[int, int]] = deque()
for x, y in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
    r, g, b, a = pixels[x, y]
    if is_blackish(r, g, b, a):
        q.append((x, y))
        visited[y][x] = True

while q:
    x, y = q.popleft()
    pixels[x, y] = (0, 0, 0, 0)
    for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
        if nx < 0 or ny < 0 or nx >= w or ny >= h or visited[ny][nx]:
            continue
        r, g, b, a = pixels[nx, ny]
        if is_blackish(r, g, b, a):
            visited[ny][nx] = True
            q.append((nx, ny))

# Clear remaining near-black fringe only near edges
for y in range(h):
    for x in range(w):
        r, g, b, a = pixels[x, y]
        near_edge = x < w * 0.12 or x > w * 0.88 or y < h * 0.12 or y > h * 0.88
        if near_edge and r < 50 and g < 50 and b < 50 and a < 255:
            pixels[x, y] = (0, 0, 0, 0)

bbox = img.getbbox()
if bbox:
    pad = max(4, min(w, h) // 48)
    img = img.crop(
        (
            max(0, bbox[0] - pad),
            max(0, bbox[1] - pad),
            min(w, bbox[2] + pad),
            min(h, bbox[3] + pad),
        )
    )


def fit_square(im: Image.Image, size: int) -> Image.Image:
    im = im.copy()
    im.thumbnail((size, size), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(im, ((size - im.width) // 2, (size - im.height) // 2), im)
    return canvas


def save_png(im: Image.Image, path: str) -> None:
    im.save(path, format="PNG", optimize=True)


sizes = {
    "icon.png": 512,
    "apple-icon.png": 180,
}
for name, size in sizes.items():
    save_png(fit_square(img, size), os.path.join(out, name))

public_map = {
    "favicon-16x16.png": 16,
    "favicon-32x32.png": 32,
    "apple-touch-icon.png": 180,
    "android-chrome-192x192.png": 192,
    "android-chrome-512x512.png": 512,
    "icon.png": 512,
}
for name, size in public_map.items():
    save_png(fit_square(img, size), os.path.join(public, name))

# ICO: write as PNG-compressed multi-size when possible
ico_path = os.path.join(out, "favicon.ico")
ico_imgs = [fit_square(img, s) for s in (16, 32, 48)]
# Convert to mode that Pillow ICO handles reliably
ico_imgs[0].save(
    ico_path,
    format="ICO",
    sizes=[(16, 16), (32, 32), (48, 48)],
    append_images=ico_imgs[1:],
)
save_png(fit_square(img, 32), os.path.join(public, "favicon.png"))
import shutil

shutil.copy2(ico_path, os.path.join(public, "favicon.ico"))

print("done")
print("corner", fit_square(img, 512).getpixel((0, 0)))
print("ico bytes", os.path.getsize(ico_path))
