import sys

sys.stdout.reconfigure(encoding='utf-8')

# Inputs from Dunes Hotel Canopy (4)
branch_B = 2.0
branch_H = 8.0
branch_t = 0.1160 # HSS8x2x1/8 design thickness
branch_Fy = 46.0
branch_Fu = 58.0

plate_t = 0.50
plate_Fy = 36.0
plate_Fu = 58.0

applied_moment = 10.0 # ft-kips
leg_size = 0.348 # Hilti nominal leg size
fexx = 70.0

# 1. Selected face is Face B (B_b = 2.0 in)
selected_face_nominal = branch_B
d_couple = branch_H

# 2. Calculate K5 effective width Be (branch is chord, plate is branch)
chord_B = selected_face_nominal
chord_t = branch_t
chord_Fy = branch_Fy

branch_t_p = plate_t
branch_Fy_p = plate_Fy

Bt = chord_B / chord_t
be_raw = (10.0 / Bt) * ((chord_Fy * chord_t) / (branch_Fy_p * branch_t_p)) * chord_B
be = min(be_raw, selected_face_nominal)
L_eff = be

# 3. Apportion moment elastically per AISC Table K5.1 Eq. K5-6
moment_share_factor = L_eff / (L_eff + d_couple / 3.0)
p_face = ((applied_moment * 12.0) / d_couple) * moment_share_factor

# 4. Weld capacity (Check 1)
te = 0.707 * leg_size
Awe = te * L_eff
Fnw = 0.60 * fexx # kds = 1.0 locked
Rn = Fnw * Awe
phi_Rn_weld = 0.75 * Rn
dcr_weld = p_face / phi_Rn_weld

# 5. Base metal capacity (Check 2)
# base metal is the thinner of plate and HSS
if plate_t <= branch_t:
    base_t = plate_t
    base_Fy = plate_Fy
    base_Fu = plate_Fu
    base_label = "Plate (thinner)"
else:
    base_t = branch_t
    base_Fy = branch_Fy
    base_Fu = branch_Fu
    base_label = "HSS wall (thinner)"

A_base = base_t * L_eff
Rn_yield = 0.60 * base_Fy * A_base
cap_yield = 1.00 * Rn_yield

Rn_rupture = 0.60 * base_Fu * A_base
cap_rupture = 0.75 * Rn_rupture

phi_Rn_base = min(cap_yield, cap_rupture)
dcr_base = p_face / phi_Rn_base

print("=== CALCULATED RESULTS ===")
print(f"HSS Branch: HSS {branch_H:.0f}x{branch_B:.0f}x1/8")
print(f"B_b = {branch_B:.3f} in, H_b = {branch_H:.3f} in, t_des = {branch_t:.4f} in")
print(f"Selected Face: Face B (B_b = {selected_face_nominal:.3f} in)")
print(f"L_eff (K5 Be) = {L_eff:.3f} in (reduction factor: {(L_eff / selected_face_nominal)*100:.1f}%)")
print(f"Moment Share Factor = {moment_share_factor*100:.2f}%")
print(f"Face Demand P_face = {p_face:.3f} kips")
print("\n--- Check 1: Weld Metal ---")
print(f"te = {te:.4f} in, Awe = {Awe:.4f} in2")
print(f"Nominal Rn = {Rn:.3f} kips")
print(f"phi Rn = {phi_Rn_weld:.3f} kips")
print(f"Weld DCR = {dcr_weld*100:.1f}%")
print("\n--- Check 2: Base Metal ---")
print(f"Base Metal: {base_label} (t = {base_t:.4f} in)")
print(f"A_base = {A_base:.4f} in2")
print(f"phi Rn (yield) = {cap_yield:.3f} kips")
print(f"phi Rn (rupture) = {cap_rupture:.3f} kips")
print(f"phi Rn (governing) = {phi_Rn_base:.3f} kips")
print(f"Base Metal DCR = {dcr_base*100:.1f}%")
