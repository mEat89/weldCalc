import os
import sys
import pypdf

# Set standard output to handle utf-8 safely in Windows PowerShell
sys.stdout.reconfigure(encoding='utf-8')

pdf_dir = r"d:\repos\weldAndPlateRigidityCheck\ASIC360references"
keywords = ["moment", "couple", "arm", "centroid", "weld", "tension"]

print("Scanning all reference PDFs for moment couple weld calculations...")

for file_name in os.listdir(pdf_dir):
    if not file_name.endswith(".pdf"):
        continue
    file_path = os.path.join(pdf_dir, file_name)
    print(f"\n==========================================")
    print(f" FILE: {file_name}")
    print(f"==========================================")
    
    try:
        reader = pypdf.PdfReader(file_path)
        total_pages = len(reader.pages)
        matches = 0
        for i in range(total_pages):
            page_text = reader.pages[i].extract_text()
            if not page_text:
                continue
            
            lines = page_text.split("\n")
            for idx, line in enumerate(lines):
                # Search for co-occurrence of moment/couple and weld/force
                line_lower = line.lower()
                if any(k in line_lower for k in ["moment", "couple"]) and any(k in line_lower for k in ["weld", "force", "arm", "centroid"]):
                    clean_line = line.strip().encode('utf-8', errors='replace').decode('utf-8')
                    # Print context of 3 lines
                    context_lines = []
                    start = max(0, idx - 1)
                    end = min(len(lines), idx + 2)
                    for j in range(start, end):
                        prefix = "--> " if j == idx else "    "
                        context_lines.append(prefix + lines[j].strip())
                    context_str = "\n".join(context_lines)
                    print(f"[Page {i+1}]\n{context_str}\n")
                    matches += 1
                    if matches >= 20:
                        break
            if matches >= 20:
                print("... truncated matches ...")
                break
    except Exception as e:
        print(f"Error reading {file_name}: {e}")
