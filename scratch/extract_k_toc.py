import pypdf
import sys

sys.stdout.reconfigure(encoding='utf-8')
file_path = r"d:\repos\weldAndPlateRigidityCheck\ASIC360references\AISC Design Examples-chapterK.pdf"

reader = pypdf.PdfReader(file_path)
for i in range(min(10, len(reader.pages))):
    text = reader.pages[i].extract_text()
    print(f"=== PAGE {i+1} ===")
    if text:
        print(text[:1500])
