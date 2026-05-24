import pypdf
import sys

sys.stdout.reconfigure(encoding='utf-8')
file_path = r"d:\repos\weldAndPlateRigidityCheck\ASIC360references\AISC 360-22-chapterK.pdf"

reader = pypdf.PdfReader(file_path)
for page_num in [13, 14, 15]:  # pages 14, 15, 16 are 0-indexed as 13, 14, 15
    print(f"=== PAGE {page_num+1} ===")
    text = reader.pages[page_num].extract_text()
    if text:
        print(text)
