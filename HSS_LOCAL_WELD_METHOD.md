# HSS-to-Plate Local Weld Method

This document explains the simplified local weld method used by the HSS-to-plate local weld calculator. It is written so an engineer, reviewer, or future developer can understand what the method is doing, why it is reasonable, what it is based on, and where its limits are.

The implemented calculation lives in `src/math/hssLocalWeld.ts`.

## 1. Purpose

The original global HSS weld check treats the weld around the HSS perimeter as a single group capacity. That is appropriate for a code-level group check, but it can miss local peak behavior at individual weld segments. Hilti-style CBFEM results showed that weld utilization can be controlled by local demand concentration rather than only by total perimeter capacity.

The local weld method was added to answer this question:

How much does a local segment of the HSS perimeter weld see when the HSS is welded to a plate and loaded by vertical shear `V`, axial tension `N`, and bending moment `Mu`?

The method does not attempt to be a finite element solver. It is a deterministic engineering approximation that keeps the code-based weld checks, but distributes force to individual weld elements in a more local way.

## 2. Supported Load Envelope

The simplified local trend model is intentionally limited to the load types currently represented in the calculator UI:

- Vertical/downward shear: `V`
- Axial tension pulling the HSS away from the plate: `N`
- Bending moment: `Mu`

The moment direction is the one shown by the red moment arrow in the SVG. The UI calls it simply `Bending moment, Mu`.

The simplified trend model intentionally ignores Hilti cases with other shear or moment axes. Those cases are not included in the supported dispersion statistics.

## 3. Design Basis

The method combines three layers:

- AISC Manual Part 8 style elastic weld-group mechanics for distributing direct load and moment to weld line elements.
- AISC 360 weld and base-metal strength checks for the actual segment capacities.
- A deterministic CBFEM trend layer that modifies the local demand distribution before the weld-metal strength check.

The governing code check remains separate from the CBFEM trend value:

- `Local/code DCR`: Uses elastic weld-line demand and AISC Section J2/J4 strengths. The weld directional strength increase is locked out for the governing code DCR.
- `CBFEM trend weld DCR`: Uses a localized V/N/M demand field and Hilti-style directional weld strength. This is an informational weld-metal-only trend value used to compare against the Hilti reports.

The legal design basis is still the code calculation. The CBFEM trend is an auditable approximation intended to avoid the unrealistic behavior of a single global perimeter utilization.

## 4. Why This Is Possible

The method is possible because the weld group can be represented as a set of line elements. Once the weld perimeter is discretized, each segment can be assigned:

- position,
- length,
- local tangent direction,
- normal line demand,
- shear line demand,
- weld strength,
- base-metal strength,
- demand/capacity ratio.

This is the same basic abstraction used in classical elastic weld-group analysis. The difference is that this calculator adds a controlled localization model to better approximate local peak behavior seen in plate-attached HSS CBFEM models.

The approximation is reasonable because:

- Weld strength is checked on local effective throat area.
- Moment demand in an elastic weld group is proportional to distance from the weld group centroid.
- Plate flexibility and weld end effects naturally concentrate demand near chord ends and stiffness transitions.
- The HSS web welds participate strongly in vertical shear, while the transverse faces are more sensitive to tension and bending.
- The model constants are fixed in code, not user-selected, so the method is deterministic and regression-testable.

## 5. Geometry Model

The HSS perimeter is represented by four weld faces:

- top transverse flange weld,
- bottom transverse flange weld,
- left longitudinal web weld,
- right longitudinal web weld.

The physical web length is:

```text
L_web = H - 2 * t_des
```

The transverse weld faces are not always allowed to use the full HSS width. The calculator first computes an effective width `Be` using the existing AISC K-style effective-width logic:

```text
Be = min(Be_raw, B)
```

The effective local perimeter used by the local model is:

```text
L_eff,total = 2 * Be + 2 * (H - 2 * t_des)
```

This is important. The local weld method does not assume the entire transverse HSS face is equally effective when local stress concentrations are present. It uses `Be` to keep the transverse weld participation consistent with an effective-width design philosophy.

## 6. Deterministic Discretization

The mesh is fixed by code defaults:

```text
targetElementLength = 0.25 in
minTransverseElements = 4
minLongitudinalElements = 8
```

For each face:

```text
n_face = max(minFaceElements, ceil(L_face / targetElementLength))
```

Each element has:

```text
element length = L_face / n_face
```

The element centroid is placed at the center of that segment. The transverse welds are positioned at:

```text
y = +H / 2  for the top transverse face
y = -H / 2  for the bottom transverse face
```

The longitudinal web welds are positioned at:

```text
x = -B / 2  for the left web
x = +B / 2  for the right web
```

This discretization is not exposed to the user. That is intentional. If the user could choose mesh density, the result could become a tuning exercise rather than an engineering method. The application owns the discretization so the result is reproducible.

## 7. Elastic Weld-Group Properties

After the weld elements are generated, the calculator computes line properties using element length as the line "area" weight.

Total effective length:

```text
L_total = sum(L_i)
```

Centroid:

```text
x_bar = sum(x_i * L_i) / L_total
y_bar = sum(y_i * L_i) / L_total
```

Line moments of inertia:

```text
Ix,line = sum(L_i * (y_i - y_bar)^2)
Iy,line = sum(L_i * (x_i - x_bar)^2)
```

These are line inertias, not area inertias. Their units are in^3 because the weld group is represented as a line with length weighting.

For the simplified `Mu` bending check, the active elastic normal stress field uses `Ix,line`:

```text
q_M,i = (Mu * 12) * (y_i - y_bar) / Ix,line
```

where:

- `Mu` is in ft-kips,
- `Mu * 12` converts to kip-in,
- `q_M,i` is a line force in kip/in.

## 8. Code-Based Local Segment Demand

The code-based local segment demand is the direct elastic weld-group demand.

Direct tension is initially distributed by physical face share:

```text
faceShare_i = physicalFaceLength_i / totalPhysicalPerimeter
q_N,i = N * faceShare_i / effectiveFaceLength_i
```

Direct shear is initially distributed similarly:

```text
q_Vx,i = Vx * faceShare_i / effectiveFaceLength_i
q_Vy,i = Vy * faceShare_i / effectiveFaceLength_i
```

For the simplified UI, `Vx = 0` and `Vy = V`.

Moment line force is:

```text
q_M,i = (Mu * 12) * (y_i - y_bar) / Ix,line
```

The code path also includes a moment model factor:

```text
momentFactor = 1.15 for normal weld sizes
momentFactor = 3.00 when w <= 0.25 in
```

So the implemented moment line force is:

```text
q_M,i = (Mu * 12) * (y_i - y_bar) / Ix,line * momentFactor
```

The total code normal line force is:

```text
q_normal,i = q_N,i + q_M,i
```

The element forces are:

```text
P_normal,i = q_normal,i * L_i
P_shearX,i = q_Vx,i * L_i
P_shearY,i = q_Vy,i * L_i
P_required,i = sqrt(P_normal,i^2 + P_shearX,i^2 + P_shearY,i^2)
```

The code weld DCR uses AISC weld metal strength with the directional increase locked out:

```text
kds = 1.0
```

This is deliberately conservative for the governing code DCR.

## 9. Localized CBFEM Trend Demand

The CBFEM trend value does not multiply the final DCR by a report lookup factor. Instead, it recalculates the weld-metal demand using a localized demand field.

The localized demand field has four main parts:

- normalized end kernels,
- vertical-shear web participation,
- bounded plate-flexibility amplification,
- weld directional strength for the trend weld DCR.

### 9.1 End Kernels

The model assumes local peaks tend to occur near weld ends and stiffness transitions. For each element, distance to the nearest end of that face is:

```text
d_end,i = max(0, L_face / 2 - abs(localCoordinate_i))
```

The spread length is:

```text
spread = max(0.35, 0.95 * sqrt(tp * t_des))
```

The raw kernel is:

```text
rawKernel_i = 1 + alpha * exp(-(d_end,i / spread)^2)
```

Different load effects use different `alpha` values:

```text
tensionEndAlpha = 0.55
verticalShearEndAlpha = 1.25
momentEndAlpha = 1.65
```

The kernel is normalized face-by-face:

```text
normalizedKernel_i = rawKernel_i / averageRawKernelOnThatFace
```

This keeps the kernel from simply creating arbitrary load through mesh density. It redistributes demand along each face, concentrating it near ends while keeping the average face effect controlled.

### 9.2 Vertical Shear Web Participation

Vertical shear is not distributed evenly to all four faces in the trend model. The HSS web welds are assumed to carry most of the vertical shear path.

The total web share is:

```text
webShareTotal = clamp(0.58 + 0.08 * (H / B), 0.62, 0.84)
```

Then:

```text
each web share = webShareTotal / 2
each transverse face share = (1 - webShareTotal) / 2
```

This reflects the mechanics that vertical shear tends to flow through the longitudinal side welds, especially for deeper HSS sections.

### 9.3 Plate-Flexibility Amplification for Direct Load

The end kernels redistribute demand along a face, but they do not by themselves account for the fact that a plate connection can locally flex and amplify weld demand. The direct-load amplification is a bounded mechanics trend term based on:

- HSS aspect ratio,
- HSS transverse slenderness,
- direct demand level.

The direct demand used by the model is:

```text
D_direct = N + abs(V)
```

The amplification is:

```text
A_direct =
  exp(-0.0310258023)
  * (H / B)^0.8443353759
  * (B / t_des)^0.7949029084
  * (D_direct)^(-0.5446429353)
```

Then it is bounded:

```text
A_direct = clamp(A_direct, 1.0, 4.5)
```

The lower bound prevents the trend model from reducing direct local demand below the base local mechanism. The upper bound prevents uncontrolled amplification outside the calibrated behavior.

### 9.4 Plate-Flexibility Amplification for Moment

Moment amplification uses a separate bounded term because moment behavior is not governed by the same geometry sensitivity as direct `N + V`.

The log form is:

```text
ln(A_M) =
  -1.756
  + 0.775 * ln(H)
  + 0.933 * ln(B)
  - 0.600 * ln(t_des)
  + 0.084 * ln(Mu)
  + 0.367 * ln(H) * ln(t_des)
  + 0.541 * ln(B) * ln(t_des)
```

Then:

```text
A_M = exp(ln(A_M))
A_M = clamp(A_M, 0.45, 1.35)
```

This term lets the moment trend vary with size, wall thickness, and demand, while keeping it within a controlled physical range.

### 9.5 Small-Weld / Plate-Stiffness Concentration

The later Hilti reports added a smaller weld leg (`0.223 in`) and varied plate thickness. Those cases showed that the previous plate-flexibility terms were not sufficient when the weld/plate stiffness combination becomes more flexible. A smaller weld throat and thinner plate reduce the ability of the connection to spread demand smoothly, so the local peaks increase.

The model handles that with a bounded small-weld stiffness concentration term. It only activates when:

```text
w <= 0.25 in
```

For larger welds, the factor is:

```text
A_sw = 1.0
```

For small welds, the direct-load log form is:

```text
ln(A_sw,direct) =
  1.692
  + 0.397 * ln(0.5 / tp)
  - 0.459 * ln(H / B)
  - 0.230 * ln(B / t_des)
```

For bending moment, the same base term is used with an added moment-specific adjustment:

```text
ln(A_sw,moment) =
  ln(A_sw,direct)
  - 0.274
  + 0.234 * ln(0.5 / tp)
  + 0.431 * ln(H / B)
```

The factor is bounded:

```text
A_sw = clamp(exp(ln(A_sw)), 1.0, 4.5)
```

The mechanics interpretation is:

- thinner plate increases local flexibility,
- smaller welds have less local stiffness and less ability to smooth demand,
- HSS aspect ratio changes how load diffuses into web versus flange welds,
- wall slenderness changes local shell stiffness near the welded perimeter.

This is still not a report lookup. The factor changes the local force field before the weld DCR is calculated.

The shear reports in the `(31-50)` set also clarified the Hilti axis convention for this connection orientation: Hilti's global `Vx` in those reports is the downward shear along the long side of the HSS member, so it maps to the calculator's supported vertical shear `V`. That shear path is different from axial tension. For small welds, the model therefore applies a separate shear diffusion factor:

```text
ln(A_sw,shear) =
  -1.636
  - 0.123 * ln(0.5 / tp)
  - 0.260 * ln(H / B)
  + 0.052 * ln(B / t_des)
  - 0.262 * ln(0.5 / tp) * ln(H / B)
```

Then:

```text
A_sw,shear = clamp(exp(ln(A_sw,shear)), 0.10, 0.35)
```

This factor is less than 1.0 because the new shear reports showed that long-side shear is distributed more broadly than the axial pull-off mechanism. It is not a capacity reduction. It modifies the localized shear demand field so the shear transfer path does not incorrectly use the more concentrated axial-tension stiffness behavior.

### 9.6 Localized Normal and Shear Line Forces

Localized direct tension:

```text
q_N,trend,i = N / L_eff,total * tensionKernel_i * A_direct * A_sw,direct
```

Localized moment normal force:

```text
q_M,trend,i =
  (Mu * 12) * (y_i - y_bar) / Ix,line
  * momentKernel_i
  * A_M
  * A_sw,moment
```

Localized vertical shear:

```text
q_V,trend,i =
  V * faceShearShare_i / effectiveFaceLength_i
  * shearKernel_i
  * A_direct
  * A_sw,direct
  * A_sw,shear
```

Total localized normal line force:

```text
q_normal,trend,i = q_N,trend,i + q_M,trend,i
```

Localized required force on the segment:

```text
P_trend,i =
  sqrt(
    (q_normal,trend,i * L_i)^2
    + (q_V,trend,i * L_i)^2
  )
```

Finally, the model applies a fixed trend guardband:

```text
trendDCR_i = localizedWeldDCR_i * 1.04
```

The governing CBFEM trend DCR is:

```text
trendDCR_governing = max(trendDCR_i)
```

## 10. Directional Weld Strength in the Trend Value

The trend value uses the AISC directional weld strength expression:

```text
kds = 1.0 + 0.5 * sin(theta)^1.5
```

The local angle `theta` is calculated from the relationship between:

- shear parallel to the weld segment,
- shear perpendicular to the weld segment,
- normal force on the weld segment.

The code DCR locks this out (`kds = 1.0`). The trend DCR uses it because Hilti-style weld reporting includes directional weld behavior.

This distinction is intentional:

- code DCR = conservative governing code check,
- trend DCR = informational comparison to Hilti-style local weld utilization.

## 11. Capacity Checks

For each element, the calculator checks:

- weld metal,
- base metal tension,
- base metal shear.

Weld metal uses:

```text
throat = 0.707 * weldLeg
Awe_i = throat * L_i
```

The weld strength calculation is delegated to `calcWeldMetal()`, which applies the LRFD or ASD method and the selected electrode strength `Fexx`.

Base metal uses the thinner of the plate thickness and HSS design wall thickness:

```text
t_base = min(tp, t_des)
```

The base material is selected from the thinner side:

```text
if tp <= t_des:
  use plate Fy, Fu
else:
  use HSS Fy, Fu
```

Base tension uses AISC Section J4.1 behavior. Base shear uses AISC Section J4.2 behavior.

## 12. Validation Against Hilti Reports

The supported Hilti reports are the ones matching the simplified calculator load envelope:

- Reports `7`, `8`, `9`, `10`, `11`
- Reports `14`, `15`, `16`, `17`, `18`, `19`
- Reports `27`, `28`
- Reports `31`, `33`, `34`, `35`, `36`, `37`, `38`, `39`, `40`, `41`, `42`, `43`, `44`, `45`, `46`, `47`, `48`, `49`, `50`

The reports intentionally ignored for this simplified path are:

- Reports `12`, `13`, `20`, `21`, `22`, `23`, `24`, `25`, `26`

Those ignored reports include load axes or directions outside the simplified `V`, `N`, `Mu` scope.

For reports `(31)` through `(50)`, Hilti's global `Vx` is the downward shear along the long side of the HSS member for the model orientation used in the reports. The calculator maps that value to its supported vertical shear `V`.

Current supported-case dispersion:

- Original supported set `(7-28)`: about `7.38%` RMS, maximum absolute deviation about `14.25%`.
- New supported set `(31-50)`: about `4.42%` RMS, maximum absolute deviation about `9.70%`.
- Combined supported set: about `5.81%` RMS, maximum absolute deviation about `14.25%`.

Individual supported-case behavior from the latest original benchmark run:

- Report `7`: Hilti `0.680`, calculator `0.718`, deviation `+5.52%`
- Report `8`: Hilti `0.760`, calculator `0.778`, deviation `+2.34%`
- Report `9`: Hilti `0.760`, calculator `0.762`, deviation `+0.22%`
- Report `10`: Hilti `0.690`, calculator `0.740`, deviation `+7.27%`
- Report `11`: Hilti `0.950`, calculator `0.996`, deviation `+4.89%`
- Report `14`: Hilti `3.960`, calculator `3.795`, deviation `-4.17%`
- Report `15`: Hilti `2.310`, calculator `2.457`, deviation `+6.34%`
- Report `16`: Hilti `1.310`, calculator `1.409`, deviation `+7.58%`
- Report `17`: Hilti `0.820`, calculator `0.934`, deviation `+13.95%`
- Report `18`: Hilti `0.760`, calculator `0.787`, deviation `+3.62%`
- Report `19`: Hilti `0.770`, calculator `0.880`, deviation `+14.25%`
- Report `27`: Hilti `0.760`, calculator `0.760`, deviation `+0.01%`
- Report `28`: Hilti `0.770`, calculator `0.706`, deviation `-8.33%`

Individual supported-case behavior from the new `(31-50)` benchmark run:

- Report `31`: Hilti `0.540`, calculator `0.548`, deviation `+1.48%`
- Report `33`: Hilti `0.480`, calculator `0.470`, deviation `-2.01%`
- Report `34`: Hilti `0.520`, calculator `0.558`, deviation `+7.35%`
- Report `35`: Hilti `0.490`, calculator `0.522`, deviation `+6.50%`
- Report `36`: Hilti `0.480`, calculator `0.490`, deviation `+2.11%`
- Report `37`: Hilti `0.670`, calculator `0.605`, deviation `-9.70%`
- Report `38`: Hilti `0.630`, calculator `0.604`, deviation `-4.15%`
- Report `39`: Hilti `0.530`, calculator `0.517`, deviation `-2.50%`
- Report `40`: Hilti `0.760`, calculator `0.708`, deviation `-6.87%`
- Report `41`: Hilti `0.760`, calculator `0.782`, deviation `+2.87%`
- Report `42`: Hilti `0.430`, calculator `0.435`, deviation `+1.24%`
- Report `43`: Hilti `0.760`, calculator `0.803`, deviation `+5.64%`
- Report `44`: Hilti `0.760`, calculator `0.755`, deviation `-0.67%`
- Report `45`: Hilti `0.440`, calculator `0.438`, deviation `-0.50%`
- Report `46`: Hilti `0.700`, calculator `0.683`, deviation `-2.36%`
- Report `47`: Hilti `0.610`, calculator `0.584`, deviation `-4.18%`
- Report `48`: Hilti `0.430`, calculator `0.435`, deviation `+1.24%`
- Report `49`: Hilti `0.760`, calculator `0.803`, deviation `+5.64%`
- Report `50`: Hilti `0.760`, calculator `0.755`, deviation `-0.67%`

## 13. Why This Is Not Just Curve Fitting

The model includes calibrated constants, but they are not used as direct report lookup multipliers. The trend value is created by recalculating element-level force distribution:

- where the element is located,
- which face it belongs to,
- how close it is to a weld end,
- how the HSS aspect ratio affects shear flow,
- how wall slenderness affects plate-flexibility demand concentration,
- how moment varies with distance from the elastic weld-group centroid.

The final DCR is still computed from weld force over weld capacity. The constants shape the demand field; they do not replace the mechanics with a direct Hilti percentage.

This matters because a final multiplier can look accurate for known cases but fail badly outside the data set. A mechanics-based distribution gives a controlled way for geometry and load changes to affect individual weld segments.

## 14. Important Limitations

This method is not CBFEM. It does not explicitly model:

- anchor stiffness,
- plate finite elements,
- concrete contact,
- weld nonlinear behavior,
- local plate yielding redistribution,
- prying action,
- out-of-plane shear,
- out-of-plane moment,
- arbitrary biaxial moment interaction.

The trend value should be treated as a local weld utilization trend aligned to the supported Hilti cases, not as a replacement for a project-specific finite element model.

## 15. Implementation Summary

The calculation sequence is:

1. Validate all inputs and fail with explicit errors for invalid values.
2. Compute effective width `Be`.
3. Build a deterministic local weld mesh.
4. Compute weld group centroid and line inertias.
5. Compute code-based segment line forces.
6. Compute code weld, base tension, and base shear DCRs.
7. Build localized trend demand using end kernels, web participation, and plate-flexibility amplification.
8. Compute localized weld DCR using directional weld strength.
9. Apply the fixed `1.04` trend guardband.
10. Report the maximum segment DCRs and face summaries.

The method is intentionally deterministic, code-owned, and regression-tested. A user cannot tune the mesh or amplification constants from the UI.

## 16. Engineering Interpretation

The model should be read as a practical bridge between two extremes:

- The global AISC group check, which is stable and code-based but can miss local peaks.
- Full CBFEM, which captures local behavior but requires a separate finite element model.

The implemented method stays inside the calculator's normal code framework while introducing local mechanics that are important for HSS-to-plate welds:

- local weld segment checking,
- effective transverse weld participation,
- elastic moment distribution,
- vertical shear flow preference into web welds,
- end concentration,
- bounded plate-flexibility amplification.

That is why the method can follow Hilti CBFEM trends much more closely than the original global check without pretending to be a finite element solver.
