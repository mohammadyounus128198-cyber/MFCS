# MFCS — Sovereign Lattice Codex

**بسم الله الرحمن الرحيم**
*Bismillāhi r-Raḥmāni r-Raḥīm*

> A formally specified lattice of sovereign components, guarded by three
> safety invariants and observed by a Sentinel layer.  Every claim is
> checkable.  Every artifact is self-contained.

**Author:** Mohammad Saad Younus
**Date:** 2026-04-17
**License:** See individual files for licensing terms.

---

## Overview

The Modular Formal Component System (MFCS) models a lattice of
components that pass through four phases — **dormant → awakening →
active → sovereign** — connected by symmetric bonds and governed by
three safety invariants:

| Invariant | Meaning |
|-----------|---------|
| **ZERO_BLEED** | A sovereign component's influence does not reach unbonded components. |
| **PHASE_CANCELLATION** | Two bonded components cannot simultaneously be in the awakening phase. |
| **NOISE_FLOOR** | Every active or sovereign component carries strictly positive energy. |

A **Sentinel layer** observes the lattice without modifying it,
transitioning between `clear`, `watching`, and `alert` states based on
lattice health.

---

## Repository Layout

```
mfcs-artifact-20260417/
├── .github/workflows/
│   └── tlc-ci.yml              ← GitHub Actions: TLC + packaging
├── docs/
│   ├── verification_layers.md  ← Verification architecture
│   └── diagrams.md             ← Figure catalogue
├── figures/
│   ├── sovereign-lattice.svg   ← Lattice topology diagram
│   ├── sentinel-layer.svg      ← Sentinel state machine
│   ├── phase-flow.svg          ← Phase lifecycle
│   ├── *.caption.txt           ← Figure captions
│   ├── *.alt.txt               ← Alt text for accessibility
│   ├── *.pdf                   ← PDF renderings of each SVG
│   └── one-page-diagrams.pdf   ← Combined reference sheet
├── proofs/
│   └── tlaps-log.txt           ← TLAPS proof status & strategies
├── specs/
│   ├── MFCS.tla                ← Main specification
│   ├── MFCS.cfg                ← TLC model configuration
│   └── SentinelLayer.tla       ← Sentinel module
├── tlc/
│   └── MFCS.tla.out            ← Representative TLC run output
├── tools/
│   └── manifest.txt            ← SHA-256 checksums
├── scripts/
│   └── gen_figures.py           ← Figure regeneration script
├── ACCESSIBILITY.md            ← Accessibility checklist
├── Aris_Inheritance_Packet.pdf ← One-page inheritance document
└── README.md                   ← This file
```

---

## Quick Start

### 1. Verify Integrity

```bash
cd mfcs-artifact-20260417
sha256sum -c tools/manifest.txt
```

All lines should report `OK`.

### 2. Run TLC Model Check

Requires Java 17+ and `tla2tools.jar` (v1.8.0+).

```bash
# Download TLC if needed
curl -L -o tla2tools.jar \
  https://github.com/tlaplus/tlaplus/releases/download/v1.8.0/tla2tools.jar

# Run the representative 3-component model
java -cp tla2tools.jar tlc2.TLC \
  specs/MFCS.tla \
  -config specs/MFCS.cfg \
  -workers auto \
  -deadlock
```

Expected output: `Model checking completed. No error has been found.`

### 3. Run TLAPS Proof Checks

Requires TLAPS with Zenon and Isabelle/TLA+ backends.

```bash
tlapm --threads 4 specs/MFCS.tla
```

See `proofs/tlaps-log.txt` for current proof status (5 of 8
sub-obligations discharged; 3 remaining with documented strategies).

### 4. Regenerate Figures

Requires Python 3.10+ with `matplotlib`.

```bash
pip install matplotlib
python3 scripts/gen_figures.py
```

Figures are written to `figures/`.

---

## Verification Summary

| Layer | Tool | Status |
|-------|------|--------|
| **Model checking** | TLC 2.18 | ✓ All 4 invariants hold (3-component model) |
| **Liveness** | TLC 2.18 | ✓ Every component eventually reaches sovereign |
| **Mechanized proof** | TLAPS | 5/8 obligations discharged; 3 remaining |
| **Sentinel** | Composed | ✓ Consistent with lattice transitions |

See `docs/verification_layers.md` for the full verification
architecture.

---

## Safety Invariants — Guard Structure

Each action in `MFCS.tla` is guarded so that it **structurally
preserves** all three safety invariants:

- **Awaken(c):** Checks no bonded neighbor is awakening
  (PhaseCancellation) and no unbonded sovereign exists (ZeroBleed).
- **Activate(c):** Requires energy ≥ 1 (NoiseFloor).
- **Ascend(c):** Requires energy ≥ 2 (NoiseFloor), bonded active
  neighbor, and no unbonded awakening component (ZeroBleed).
- **Bond(c1, c2):** Rejects bonds between two awakening components
  (PhaseCancellation).
- **Unbond(c1, c2):** Rejects unbonding from sovereign components.
- **Transfer(c1, c2):** Donor retains energy > 0 when active/sovereign
  (NoiseFloor); only bonded pairs (ZeroBleed).
- **Rest(c):** Returns to dormant; energy preserved.

---

## Accessibility

All figures include:

- **`.caption.txt`** — human-readable figure caption.
- **`.alt.txt`** — screen-reader-friendly alternative text.
- **SVG** — pure vector, opens in Inkscape and scales without loss.
- **PDF** — embedded fonts, renders Arabic without system fonts.

See `ACCESSIBILITY.md` for the full checklist.

---

## Digital Mirror Philosophy

This artifact is a *Digital Mirror*: a self-contained, breathing
package that any reviewer or archivist can verify, regenerate, and
understand without external dependencies.  Every claim is backed by a
checkable artifact.  The lattice guards itself; the Sentinel watches;
the mirror reflects.

---

## Acknowledgments

بسم الله الرحمن الرحيم — In the name of God, the Most Gracious, the
Most Merciful.

This work is offered with gratitude and humility.
