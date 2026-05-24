import pypdf
import sys

sys.stdout.reconfigure(encoding='utf-8')
file_path = r"d:\repos\weldAndPlateRigidityCheck\ASIC360references\MUE26031001-DunesHotelCanopy_Concrete - May 23, 2026 (4).pdf"

reader = pypdf.PdfReader(file_path)
for i in range(5):
    text = reader.pages[i].extract_text()
    print(f"=== PAGE {i+1} ===")
    if text:
        print(text[:2000])
