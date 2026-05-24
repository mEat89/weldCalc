import pypdf

file_path = r"d:\repos\weldAndPlateRigidityCheck\ASIC360references\AISC 360-22-chapterK.pdf"
reader = pypdf.PdfReader(file_path)

# Let's extract pages 13, 14, 15 (1-based indices 13, 14, 15)
extracted_text = []
for page_num in [13, 14, 15]:
    if page_num <= len(reader.pages):
        page_text = reader.pages[page_num - 1].extract_text()
        extracted_text.append(f"--- PAGE {page_num} ---\n{page_text}")

with open(r"d:\repos\weldAndPlateRigidityCheck\scratch\extracted_k.txt", "w", encoding="utf-8") as f:
    f.write("\n\n".join(extracted_text))

print("Pages 13-15 extracted successfully.")
