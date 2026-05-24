import pypdf
import sys

sys.stdout.reconfigure(encoding='utf-8')
file_path = r"d:\repos\weldAndPlateRigidityCheck\ASIC360references\MUE26031001-DunesHotelCanopy_Concrete - May 23, 2026 (4).pdf"

print("Scanning Dunes Hotel Canopy (4) PDF for moment and weld calculations...")
reader = pypdf.PdfReader(file_path)
total_pages = len(reader.pages)
for i in range(total_pages):
    text = reader.pages[i].extract_text()
    if not text:
        continue
    if "Combination" in text or "Design results" in text or "Welds" in text:
        print(f"=== Page {i+1} ===")
        print(text[:2000])
