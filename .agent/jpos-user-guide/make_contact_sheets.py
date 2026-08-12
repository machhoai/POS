from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(r"D:\Github\POS\.agent\jpos-user-guide\render8")
pages = sorted(root.glob("page-*.png"), key=lambda p: int(p.stem.split("-")[1]))
thumb_w, thumb_h = 306, 396
cols, rows = 3, 5
for sheet_index in range((len(pages) + cols * rows - 1) // (cols * rows)):
    subset = pages[sheet_index * cols * rows:(sheet_index + 1) * cols * rows]
    canvas = Image.new("RGB", (cols * thumb_w, rows * (thumb_h + 24)), "#d5d9df")
    draw = ImageDraw.Draw(canvas)
    for i, path in enumerate(subset):
        image = Image.open(path).convert("RGB")
        image.thumbnail((thumb_w - 8, thumb_h - 8))
        x = (i % cols) * thumb_w + (thumb_w - image.width) // 2
        y = (i // cols) * (thumb_h + 24) + 4
        canvas.paste(image, (x, y))
        draw.text((x, y + image.height + 2), f"Trang {int(path.stem.split('-')[1])}", fill="black")
    canvas.save(root / f"contact-{sheet_index + 1}.png")
print(f"sheets={(len(pages) + cols * rows - 1) // (cols * rows)}")
