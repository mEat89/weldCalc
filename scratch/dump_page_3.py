import pypdf
import sys

sys.stdout.reconfigure(encoding='utf-8')
file_path = r"d:\repos\weldAndPlateRigidityCheck\ASIC360references\MUE26031001-DunesHotelCanopy_Concrete - May 23, 2026 (1).pdf"

reader = pypdf.PdfReader(file_path)
text = reader.pages[2].extract_text()  # Page 3 is index 2
print(text)
