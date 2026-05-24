# AISC / Hilti Validation Report

Generated from the current calculator implementation after the HSS workflow was simplified to one global weld-group model.

## Scope

This validation checks that the math in the background matches what the app reports to the user for the in-scope HSS workflow:

- Global shear, `V`
- Global tension, `N`
- Global in-plane moment, `M_ip`
- No out-of-plane moment
- HSS group weld capacity using AISC §K5 group equations
- Chapter J weld/base-metal helper equations used elsewhere in the app

The reproducible validation script is:

```bash
npx vitest run src/math/__tests__/aiscProvision.validation.test.ts --reporter=verbose
```

## Executive Summary

The validation script passes. The important parity check is the Chapter K group example: the independent hand equations, `calcK5GroupCapacity()`, `useHSSCalculation()`, and `buildHSSReport()` all return the same capacities and DCRs.

That means the HSS calculation engine, UI-facing calculation object, and generated report model are aligned for the group workflow.

## AISC Chapter J Checks

### J2.4 Fillet Weld Strength

Made-up example based on AISC Design Examples Chapter K.10 weld format:

- Four 3/16 in fillet welds
- Each weld line 7 in long
- E70 electrode
- LRFD demand = 80 kips
- Directional increase disabled

Result:

| Item | Independent hand calc | Calculator result | Reference |
|---|---:|---:|---|
| `φRn` | 116.920 kips | 116.920 kips | AISC example rounds to 117 kips |
| DCR | 68.423% | 68.423% | `80 / φRn` |

Conclusion: `calcWeldMetal()` matches the independent §J2.4 hand equation.

### J4 Base-Metal Shear vs Tension

Made-up companion example to verify the app routes base-metal checks to the correct J4 branch:

- Base metal thickness = 0.25 in
- Length = 6 in
- Weld lines = 2
- Fy = 36 ksi
- Fu = 58 ksi

Result:

| Case | Governing equation | Demand | `φRn` | DCR |
|---|---|---:|---:|---:|
| Shear | §J4.2 shear yielding, `0.6FyA`, `φ = 1.00` | 30 kips | 64.800 kips | 46.296% |
| Tension | §J4.1 tensile yielding, `FyA`, `φ = 0.90` | 80 kips | 97.200 kips | 82.305% |

Conclusion: `calcBaseMetal()` uses the correct shear/tension branch instead of silently applying shear formulas to tension demand.

## AISC Chapter K Group Check

Made-up HSS group example:

- Branch: HSS8x4x1/4
- Chord: HSS10x10x3/8
- Branch/chord material: A500 Gr C
- Weld: 1/4 in E70
- K5 mode
- Branch `B` dimension transverse to support axis
- Loads: `V = 20 kips`, `N = 12 kips`, `M_ip = 8 ft-kips`

Independent hand equations:

- `Be = min(Be_raw, Bb)`
- `tw = 0.707w`
- `le = 2Hb + 2Be`
- `Sip = tw[Hb^2/3 + BeHb]`
- `Pn = Fnw tw le`
- `Mn-ip = Fnw Sip`
- `φ = 0.75`

Result:

| Item | Value |
|---|---:|
| `Be` | 2.091 in |
| `le` | 20.182 in |
| `φPn` | 112.366 kips |
| `φMn-ip` | 211.911 kip-in |
| Shear DCR | 17.799% |
| Tension DCR | 10.679% |
| `M_ip` DCR | 45.302% |
| Combined §K4 unity | 0.631 |

Parity conclusion:

- Independent hand equations match `calcK5GroupCapacity()`.
- `calcK5GroupCapacity()` matches `useHSSCalculation()`.
- `useHSSCalculation()` matches `buildHSSReport()` DCRs.

This directly validates that the user-facing HSS result cards and exported report are being fed by the same backend math.

## Hilti CBFEM Correlation

The Hilti comparison script remains:

```bash
npx vitest run src/math/__tests__/hiltiCBFEM.verification.test.ts --reporter=verbose
```

Current key results:

| Scenario | Hilti CBFEM | Calculator group DCR | Delta |
|---|---:|---:|---:|
| R5 tension, HSS8x2x1/8, N = 10 kip, Ls = 0.348 in | 34% | 7.7% | -26.3 pts |
| R5 tension, standard 5/16 in leg | 34% | 8.6% | -25.4 pts |
| R4 moment, HSS8x2x1/8, M = 10 ft-kip, Ls = 0.348 in | 76% | 64.3% | -11.7 pts |
| R4 moment, standard 5/16 in leg | 76% | 71.6% | -4.4 pts |
| R2 moment, small leg Ls = 0.223 in | 290% | 100.3% | -189.7 pts |
| R2 moment, 1/4 in leg | 290% | 89.5% | -200.5 pts |
| Original shear, HSS4x4x1/4, V = 17 kip | 49% | 19.1% | -29.9 pts |

Interpretation:

- The in-plane moment group check is now in the same line as Hilti for the R4 report, especially with the standard 5/16 in leg.
- The R2 small-leg case remains far below Hilti because Hilti CBFEM is capturing nonlinear weld/plasticity/local concentration behavior beyond the current AISC §K5 elastic group equation.
- The shear case remains below Hilti because strict AISC group length does not model the same plate/chord flexibility and mesh stress concentration CBFEM reports.

These differences should be documented as scope differences, not silently hidden. Matching Hilti exactly would require extending beyond the current code-provision model.

## AISC Reference Folder Checks

The existing scratch scripts extract/search AISC reference examples:

- `scratch/search_k_examples.py`
- `scratch/search_j_examples.py`
- `scratch/extract_k_toc.py`

Manual extracted reference checks:

| AISC example | Published value | Independent calculator-style value | Result |
|---|---:|---:|---|
| Chapter K.10 weld available strength | 117 kips | 116.9 kips | Matches rounding |
| Chapter K.12 base plate required thickness | 1.08 in | 1.08 in | Matches |

## Validation Judgment

The calculator is now internally consistent for the HSS group workflow. The backend math, visible UI values, and report model agree for the tested Chapter K group case.

The current implementation is defensible as an AISC-code-scope calculator. It should not claim full CBFEM equivalence. The right positioning is:

> AISC §J/§K group weld calculator with documented CBFEM correlation checks.

Hilti alignment is reasonable for the primary in-plane moment report, but not for every CBFEM scenario. The gaps are explainable and tied to analysis scope rather than hidden implementation mismatch.
