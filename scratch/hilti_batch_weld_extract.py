from __future__ import annotations

from pathlib import Path
import json
import re
import sys

from pypdf import PdfReader


DOWNLOADS = Path(r"C:\Users\rcaso\Downloads")


def fnum(value: str) -> float:
    return float(value.replace(",", ""))


def extract_report(report_no: int) -> dict:
    path = DOWNLOADS / f"MUE26031001-DunesHotelCanopy_Concrete - May 23, 2026 ({report_no}).pdf"
    text = "\n".join(page.extract_text() or "" for page in PdfReader(str(path)).pages)

    plate = re.search(
        r"Anchor plate.*?=\s*([0-9.]+) in\. x ([0-9.]+) in\. x ([0-9.]+) in\.",
        text,
        re.S,
    )
    profile = re.search(
        r"Profile:.*?,\s*([^;]+);\s*\(L x W x T\)\s*=\s*([0-9.]+) in\. x ([0-9.]+) in\. x ([0-9.]+) in\.",
        text,
    )
    loads = re.search(
        r"N\s*=\s*([-0-9.]+);\s*Vx\s*=\s*([-0-9.]+);\s*Vy\s*=\s*([-0-9.]+);\s*\n?\s*"
        r"Mx\s*=\s*([-0-9.]+);\s*My\s*=\s*([-0-9.]+);\s*Mz\s*=\s*([-0-9.]+);",
        text,
    )
    weld_start = text.find("2.5 Welds")
    weld_end = text.find("2.6 Concrete")
    weld_block = text[weld_start:weld_end if weld_end > weld_start else len(text)]

    variable_rows = list(
        re.finditer(
            r"Member 1-([A-Za-z]+)\s+([12])\s+E70xx\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s+"
            r"70,000\s+([0-9.]+)\s+([0-9.]+)",
            weld_block,
        )
    )
    result_rows = list(
        re.finditer(
            r"Member 1-([A-Za-z]+)\s+([12])\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s+(NOT OK|OK|NG|N/A)",
            weld_block,
        )
    )

    rows = []
    for idx, var in enumerate(variable_rows):
        row = {
            "edge": var.group(1),
            "index": int(var.group(2)),
            "th": fnum(var.group(3)),
            "ls": fnum(var.group(4)),
            "L": fnum(var.group(5)),
            "Lc": fnum(var.group(6)),
            "theta": fnum(var.group(7)),
            "Aw": fnum(var.group(8)),
        }
        if idx < len(result_rows):
            res = result_rows[idx]
            row.update({
                "Fn": fnum(res.group(3)),
                "phiRn": fnum(res.group(4)),
                "util": fnum(res.group(5)),
                "status": res.group(6),
            })
        rows.append(row)

    if not profile:
        raise ValueError(f"Report {report_no}: profile not found")
    if not plate:
        raise ValueError(f"Report {report_no}: plate geometry not found")
    if not loads:
        raise ValueError(f"Report {report_no}: loads not found")
    if not rows:
        raise ValueError(f"Report {report_no}: weld rows not found")

    return {
        "report": report_no,
        "profile": profile.group(1).strip(),
        "L": fnum(profile.group(2)),
        "W": fnum(profile.group(3)),
        "Tnom": fnum(profile.group(4)),
        "plate": {
            "lx": fnum(plate.group(1)),
            "ly": fnum(plate.group(2)),
            "t": fnum(plate.group(3)),
        },
        "loads": {
            "N": fnum(loads.group(1)),
            "Vx": fnum(loads.group(2)),
            "Vy": fnum(loads.group(3)),
            "Mx": fnum(loads.group(4)),
            "My": fnum(loads.group(5)),
            "Mz": fnum(loads.group(6)),
        },
        "weldRows": rows,
        "maxWeldUtil": max(row.get("util", 0.0) for row in rows),
    }


def main() -> int:
    report_numbers = [
        int(arg)
        for arg in sys.argv[1:]
        if re.fullmatch(r"\d+", arg)
    ]
    if not report_numbers:
        report_numbers = list(range(7, 24))
    reports = [extract_report(report_no) for report_no in report_numbers]
    if "--json" in sys.argv:
        print(json.dumps(reports, indent=2))
        return 0

    for report in reports:
        loads = report["loads"]
        print(
            f"R{report['report']:02d} {report['profile']:12s} "
            f"LWT=({report['L']:.3f},{report['W']:.3f},{report['Tnom']:.3f}) "
            f"N={loads['N']:.3f} Vx={loads['Vx']:.3f} Vy={loads['Vy']:.3f} "
            f"My={loads['My']:.3f} max={report['maxWeldUtil']:.1f}%"
        )
        for row in report["weldRows"]:
            print(
                f"  {row['edge']}{row['index']}  L={row['L']:6.3f} Lc={row['Lc']:5.3f} "
                f"n={row['L'] / row['Lc']:4.1f} theta={row['theta']:5.1f} "
                f"Fn={row.get('Fn', 0):6.3f} cap={row.get('phiRn', 0):6.3f} "
                f"util={row.get('util', 0):6.1f}% {row.get('status', '?')}"
            )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
