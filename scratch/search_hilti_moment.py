import pypdf
import sys
import os

sys.stdout.reconfigure(encoding='utf-8')
pdf_dir = r"d:\repos\weldAndPlateRigidityCheck\ASIC360references"

for file_name in os.listdir(pdf_dir):
    if "DunesHotelCanopy" not in file_name:
        continue
    file_path = os.path.join(pdf_dir, file_name)
    print(f"\n==========================================")
    print(f" FILE: {file_name}")
    print(f"==========================================")
    
    reader = pypdf.PdfReader(file_path)
    for i, page in enumerate(reader.pages):
        text = page.extract_text()
        if not text:
            continue
        if "moment" in text.lower():
            lines = text.split("\n")
            for line in lines:
                if any(k in line.lower() for k in ["moment", "weld", "couple", "force", "arm", "centroid"]):
                    print(f"[Page {i+1}] {line.strip()}")
