export const LEG_SIZES = [
  { label: '1/8"  (2/16")',  value: 0.125 },
  { label: '3/16" (3/16")',  value: 0.1875 },
  { label: '1/4"  (4/16")',  value: 0.25 },
  { label: '5/16" (5/16")',  value: 0.3125 },
  { label: '3/8"  (6/16")',  value: 0.375 },
  { label: '7/16" (7/16")',  value: 0.4375 },
  { label: '1/2"  (8/16")',  value: 0.5 },
  { label: '5/8"  (10/16")', value: 0.625 },
  { label: '3/4"  (12/16")', value: 0.75 },
  { label: '7/8"  (14/16")', value: 0.875 },
  { label: '1"  (16/16")',   value: 1.0 },
];

export const FEXX_OPTIONS = [60, 70, 80, 90, 100, 110];

export const STEEL_GRADES = [
  // Plate grades (indices 0–1)
  { label: "A36 — Plate (Fy = 36, Fu = 58 ksi)",              shortLabel: "A36",              category: "plate",  fy: 36, fu: 58 },
  { label: "A572 Gr 50 — Plate (Fy = 50, Fu = 65 ksi)",       shortLabel: "A572 Gr 50",       category: "plate",  fy: 50, fu: 65 },
  // W-shape grades (index 2)
  { label: "A992 — W-shapes (Fy = 50, Fu = 65 ksi)",          shortLabel: "A992 (50/65)",     category: "wshape", fy: 50, fu: 65 },
  // HSS grades (indices 3–8)
  { label: "A36 — HSS (Fy = 36, Fu = 58 ksi)",                shortLabel: "A36 (36/58)",      category: "hss",    fy: 36, fu: 58 },
  { label: "A53 Gr B — HSS Pipe (Fy = 35, Fu = 60 ksi)",      shortLabel: "A53 Gr B (35/60)", category: "hss",    fy: 35, fu: 60 },
  { label: "A500 Gr B — Rect HSS (Fy = 46, Fu = 58 ksi)",     shortLabel: "A500 Gr B (46/58)",category: "hss",    fy: 46, fu: 58 },
  { label: "A500 Gr C — Rect HSS (Fy = 50, Fu = 62 ksi)",     shortLabel: "A500 Gr C (50/62)",category: "hss",    fy: 50, fu: 62 },
  { label: "A847 — Weathering HSS (Fy = 50, Fu = 70 ksi)",    shortLabel: "A847 (50/70)",     category: "hss",    fy: 50, fu: 70 },
  { label: "A1085 — Rect HSS (Fy = 50, Fu = 65 ksi)",         shortLabel: "A1085 (50/65)",    category: "hss",    fy: 50, fu: 65 },
];

export const HSS_SHAPES = [
  // Square HSS
  { name: "HSS3x3x1/4",   H: 3, B: 3,  tNom: 0.250, tDes: 0.233 },
  { name: "HSS3x3x5/16",  H: 3, B: 3,  tNom: 0.3125, tDes: 0.291 },
  { name: "HSS3x3x3/8",   H: 3, B: 3,  tNom: 0.375, tDes: 0.349 },
  { name: "HSS4x4x1/4",   H: 4, B: 4,  tNom: 0.250, tDes: 0.233 },
  { name: "HSS4x4x5/16",  H: 4, B: 4,  tNom: 0.3125, tDes: 0.291 },
  { name: "HSS4x4x3/8",   H: 4, B: 4,  tNom: 0.375, tDes: 0.349 },
  { name: "HSS4x4x1/2",   H: 4, B: 4,  tNom: 0.500, tDes: 0.465 },
  { name: "HSS5x5x1/4",   H: 5, B: 5,  tNom: 0.250, tDes: 0.233 },
  { name: "HSS5x5x5/16",  H: 5, B: 5,  tNom: 0.3125, tDes: 0.291 },
  { name: "HSS5x5x3/8",   H: 5, B: 5,  tNom: 0.375, tDes: 0.349 },
  { name: "HSS5x5x1/2",   H: 5, B: 5,  tNom: 0.500, tDes: 0.465 },
  { name: "HSS6x6x1/4",   H: 6, B: 6,  tNom: 0.250, tDes: 0.233 },
  { name: "HSS6x6x5/16",  H: 6, B: 6,  tNom: 0.3125, tDes: 0.291 },
  { name: "HSS6x6x3/8",   H: 6, B: 6,  tNom: 0.375, tDes: 0.349 },
  { name: "HSS6x6x1/2",   H: 6, B: 6,  tNom: 0.500, tDes: 0.465 },
  { name: "HSS6x6x5/8",   H: 6, B: 6,  tNom: 0.625, tDes: 0.581 },
  { name: "HSS7x7x1/4",   H: 7, B: 7,  tNom: 0.250, tDes: 0.233 },
  { name: "HSS7x7x3/8",   H: 7, B: 7,  tNom: 0.375, tDes: 0.349 },
  { name: "HSS7x7x1/2",   H: 7, B: 7,  tNom: 0.500, tDes: 0.465 },
  { name: "HSS8x8x1/4",   H: 8, B: 8,  tNom: 0.250, tDes: 0.233 },
  { name: "HSS8x8x5/16",  H: 8, B: 8,  tNom: 0.3125, tDes: 0.291 },
  { name: "HSS8x8x3/8",   H: 8, B: 8,  tNom: 0.375, tDes: 0.349 },
  { name: "HSS8x8x1/2",   H: 8, B: 8,  tNom: 0.500, tDes: 0.465 },
  { name: "HSS8x8x5/8",   H: 8, B: 8,  tNom: 0.625, tDes: 0.581 },
  { name: "HSS8x8x3/4",   H: 8, B: 8,  tNom: 0.750, tDes: 0.698 },
  { name: "HSS10x10x1/4", H: 10, B: 10, tNom: 0.250, tDes: 0.233 },
  { name: "HSS10x10x3/8", H: 10, B: 10, tNom: 0.375, tDes: 0.349 },
  { name: "HSS10x10x1/2", H: 10, B: 10, tNom: 0.500, tDes: 0.465 },
  { name: "HSS10x10x5/8", H: 10, B: 10, tNom: 0.625, tDes: 0.581 },
  { name: "HSS10x10x3/4", H: 10, B: 10, tNom: 0.750, tDes: 0.698 },
  { name: "HSS12x12x1/4", H: 12, B: 12, tNom: 0.250, tDes: 0.233 },
  { name: "HSS12x12x3/8", H: 12, B: 12, tNom: 0.375, tDes: 0.349 },
  { name: "HSS12x12x1/2", H: 12, B: 12, tNom: 0.500, tDes: 0.465 },
  { name: "HSS12x12x5/8", H: 12, B: 12, tNom: 0.625, tDes: 0.581 },
  { name: "HSS12x12x3/4", H: 12, B: 12, tNom: 0.750, tDes: 0.698 },
  // Rect HSS (H × B, H is the longer dimension)
  { name: "HSS4x2x1/4",   H: 4, B: 2,  tNom: 0.250, tDes: 0.233 },
  { name: "HSS4x3x1/4",   H: 4, B: 3,  tNom: 0.250, tDes: 0.233 },
  { name: "HSS5x3x1/4",   H: 5, B: 3,  tNom: 0.250, tDes: 0.233 },
  { name: "HSS6x2x1/4",   H: 6, B: 2,  tNom: 0.250, tDes: 0.233 },
  { name: "HSS6x3x1/4",   H: 6, B: 3,  tNom: 0.250, tDes: 0.233 },
  { name: "HSS6x4x1/4",   H: 6, B: 4,  tNom: 0.250, tDes: 0.233 },
  { name: "HSS6x4x3/8",   H: 6, B: 4,  tNom: 0.375, tDes: 0.349 },
  { name: "HSS6x4x1/2",   H: 6, B: 4,  tNom: 0.500, tDes: 0.465 },
  { name: "HSS8x2x1/8",   H: 8, B: 2,  tNom: 0.125, tDes: 0.116 },
  { name: "HSS8x2x3/16",  H: 8, B: 2,  tNom: 0.1875, tDes: 0.174 },
  { name: "HSS8x2x1/4",   H: 8, B: 2,  tNom: 0.250, tDes: 0.233 },
  { name: "HSS8x3x1/4",   H: 8, B: 3,  tNom: 0.250, tDes: 0.233 },
  { name: "HSS8x4x1/4",   H: 8, B: 4,  tNom: 0.250, tDes: 0.233 },
  { name: "HSS8x4x3/8",   H: 8, B: 4,  tNom: 0.375, tDes: 0.349 },
  { name: "HSS8x4x1/2",   H: 8, B: 4,  tNom: 0.500, tDes: 0.465 },
  { name: "HSS8x6x1/4",   H: 8, B: 6,  tNom: 0.250, tDes: 0.233 },
  { name: "HSS8x6x3/8",   H: 8, B: 6,  tNom: 0.375, tDes: 0.349 },
  { name: "HSS8x6x1/2",   H: 8, B: 6,  tNom: 0.500, tDes: 0.465 },
  { name: "HSS10x4x1/4",  H: 10, B: 4, tNom: 0.250, tDes: 0.233 },
  { name: "HSS10x4x3/8",  H: 10, B: 4, tNom: 0.375, tDes: 0.349 },
  { name: "HSS10x6x1/4",  H: 10, B: 6, tNom: 0.250, tDes: 0.233 },
  { name: "HSS10x6x3/8",  H: 10, B: 6, tNom: 0.375, tDes: 0.349 },
  { name: "HSS10x6x1/2",  H: 10, B: 6, tNom: 0.500, tDes: 0.465 },
  { name: "HSS12x4x1/4",  H: 12, B: 4, tNom: 0.250, tDes: 0.233 },
  { name: "HSS12x6x3/8",  H: 12, B: 6, tNom: 0.375, tDes: 0.349 },
  { name: "HSS12x6x1/2",  H: 12, B: 6, tNom: 0.500, tDes: 0.465 },
  { name: "HSS12x8x3/8",  H: 12, B: 8, tNom: 0.375, tDes: 0.349 },
  { name: "HSS12x8x1/2",  H: 12, B: 8, tNom: 0.500, tDes: 0.465 },
  { name: "HSS12x8x5/8",  H: 12, B: 8, tNom: 0.625, tDes: 0.581 },
];

export const COMMON_PLATE_T = [
  0.1875, 0.25, 0.3125, 0.375, 0.4375, 0.5, 0.5625, 0.625,
  0.75, 0.875, 1.0, 1.125, 1.25, 1.5, 1.75, 2.0,
];

export const LOAD_CASES = [
  { id: "long",  label: "Longitudinal", angle: "θ = 0°",
    description: "Load acts PARALLEL to the long axis of the weld." },
  { id: "trans", label: "Transverse",   angle: "θ = 90°",
    description: "Load acts PERPENDICULAR to the long axis of the weld." },
  { id: "angle", label: "Angled",       angle: "0° < θ < 90°",
    description: "Load acts at an arbitrary angle θ from the long axis of the weld." },
];

export const FACE_TYPES = [
  { id: "B", labelTpl: (B) => `Face along B (length = ${B}")`,
    description: "Branch weld whose length equals the catalog B dimension." },
  { id: "H", labelTpl: (H) => `Face along H (length = ${H}")`,
    description: "Branch weld whose length equals the catalog H dimension." },
];

export const LENGTH_METHODS = [
  {
    id: "aisc",
    label: "AISC §J2.4 (Full Length)",
    short: "AISC §J2.4 (Full Length)",
    description:
      "Strict AISC 360 §K5 / J2.4 compliance. HSS-to-HSS transverse face uses Be (Eq. K1-1). HSS-to-plate uses the full nominal face length — per Tousignant & Packer (2015), the rigid plate keeps the weld fully effective and the non-uniform stress is captured by kds=1.0.",
  },
  {
    id: "k5",
    label: "AISC §K5 (Reduced Be)",
    short: "AISC §K5 (Reduced Be)",
    description:
      "Apply AISC §K5 Eq. K1-1 reduction to the transverse face for BOTH connection types. For HSS-to-plate, the plate is treated as the 'chord' with engineer-input dimension B and thickness t. For rigid plates (small B/t) the formula naturally returns Be = Bb (no reduction); for thin/flexible plates a meaningful reduction is applied. This is beyond strict AISC for HSS-to-plate but is a defensible conservative approach.",
  },
  {
    id: "cbfem",
    label: "CBFEM peak-element (Lc)",
    short: "CBFEM Lc",
    description:
      "Match Hilti Profis / IDEA StatiCa CBFEM output. Engineer reads the critical-element length Lc AND the local load angle Θ from the CBFEM solver. To reproduce Profis results numerically, also enable the directional increase (kds, Eq. J2-5) with the same Θ — Profis uses standard §J2.4 for HSS-to-plate welds. The calculator treats the entire P_face as concentrated at the critical element (F_c per inch = P_face / Lc) compared against the per-inch capacity computed with the user-input Θ.",
  },
];

export const SHAPE_PRESETS = [
  { id: "i2plate",  label: "I-shape flange to plate",
    description: "Beam/column flange welded to base or end plate. Base metal = plate." },
  { id: "l2plate",  label: "L-angle to plate / cap plate",
    description: "Angle welded to plate (cap plate on HSS column, gusset, etc.)." },
  { id: "c2plate",  label: "Channel flange/web to plate",
    description: "Channel section welded to plate. Base metal = plate." },
  { id: "p2p",      label: "Plate to plate",
    description: "Lap or T-joint between two plates." },
];
