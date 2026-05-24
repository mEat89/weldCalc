import pypdf
import sys

sys.stdout.reconfigure(encoding='utf-8')
file_path = r"d:\repos\weldAndPlateRigidityCheck\ASIC360references\AISC Design Examples-chapterJ.pdf"

print("Searching AISC Design Examples Chapter J for moment-related examples...")
reader = pypdf.PdfReader(file_path)
for i, page in enumerate(reader.pages):
    text = page.extract_text()
    if not text:
        continue
    if "moment" in text.lower():
        print(f"--- Page {i+1} ---")
        lines = text.split("\n")
        for line in lines:
            if "moment" in line.lower() or "weld" in line.lower() or "couple" in line.lower() or "arm" in line.lower():
                print(line.strip())
