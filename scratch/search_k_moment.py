import pypdf
import sys

sys.stdout.reconfigure(encoding='utf-8')
file_path = r"d:\repos\weldAndPlateRigidityCheck\ASIC360references\AISC 360-22-chapterK.pdf"

print("Searching Chapter K for Table K5.1 and moment calculations...")
reader = pypdf.PdfReader(file_path)
for i in range(len(reader.pages)):
    text = reader.pages[i].extract_text()
    if not text:
        continue
    if "table k5.1" in text.lower() or "k5-6" in text.lower() or "sip" in text.lower():
        print(f"--- Page {i+1} ---")
        lines = text.split("\n")
        for line in lines:
            if any(k in line.lower() for k in ["moment", "weld", "effective", "section modulus", "sip", "k5-"]):
                print(line.strip())
