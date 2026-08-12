from pathlib import Path
import pypdfium2 as pdfium

root = Path(r"D:\Github\POS\.agent\jpos-user-guide\render8")
pdf = root / "Huong_dan_su_dung_JPOS_word.pdf"
doc = pdfium.PdfDocument(pdf)
for index, page in enumerate(doc, start=1):
    bitmap = page.render(scale=1.5)
    bitmap.to_pil().save(root / f"page-{index}.png")
print(f"rendered={len(doc)}")
