# Mystic Map v1.0

**Author:** Mohammad
**License:** CC BY-NC (Creative Commons Attribution-NonCommercial)
**Date:** 2026-04-17

## Overview

The Mystic Map is a symbolic-topological navigation system with **67 nodes**
and **108 transitions**, organized into 5 creature clusters, 36 generic
interstitial nodes, and 1 central Nexus.

## Quick Start

1. **Node data:** Open `node_map.json` for the complete Copilot-ready schema (v1.1-copilot).
2. **Legend:** See `docs/legend_onepage.pdf` or `node_legend.csv` for a quick reference.
3. **Developer integration:** Check `dev/` for TypeScript contracts and query examples.
4. **Visual assets:** SVG vectors in `creatures/` and `geometry/`; rasters in `exports/`.

## Structure

```
mystic-map_v1.0/
├── README.md                          ← You are here
├── node_map.json                      ← Copilot-ready node schema
├── node_legend.csv                    ← Flat legend (spreadsheet-compatible)
├── central_emblem.svg                 ← Central emblem vector
├── creatures/                         ← Creature SVG assets
│   ├── phoenix.svg
│   ├── dragon.svg
│   ├── lion.svg
│   ├── raven.svg
│   ├── butterfly.svg
│   └── heart.svg
├── geometry/
│   └── grid.svg                       ← Background geometry grid
├── source/
│   └── master_composition_v1.0.svg    ← Layered master (SVG format)
├── color/
│   ├── palette.ase                    ← Adobe Swatch Exchange
│   ├── palette.gpl                    ← GIMP Palette
│   └── palette_readme.txt            ← Contrast ratios & usage
├── exports/
│   ├── composition_6000px.jpg         ← 6000px RGB
│   ├── composition_6000px.tif         ← Print-ready TIFF
│   ├── composition_high_contrast.png  ← WCAG-compliant variant
│   └── composition_no_glow.png        ← No glow/emissive effects
├── docs/
│   ├── legend_onepage.pdf             ← Canonical legend
│   ├── readme_metadata.txt            ← Metadata record
│   ├── changelog.md                   ← Version history
│   └── governance.txt                 ← Versioning & license rules
├── dev/
│   ├── mfcs_contract.ts               ← TypeScript state contract
│   ├── node_map_example_query.js      ← Query examples
│   └── test-transitions.spec.js       ← Transition test suite
├── accessibility/
│   └── accessibility_notes.txt        ← WCAG compliance notes
├── vscode-extension/                   ← MFCS Visualizer (VS Code)
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/extension.ts
│   ├── media/viewer.js
│   └── README.md
└── manifest.json                      ← SHA-256 checksums
```


## Live Visualizer (VS Code Extension)

The `vscode-extension/` directory contains a self-contained VS Code extension
that renders the full state graph inside the editor.

```bash
cd vscode-extension
npm install
npm run compile
# Press F5 → Command Palette → "MFCS: Open Visualizer"
```

Features: guardian-colored nodes, dormant flagging, HARDSTOP detection,
node inspector panel, trace history, layer toggles, keyboard navigation.

## Validation

```bash
node dev/test-transitions.spec.js
```

All 108 transitions must resolve to valid nodes, and C01 must be reachable
from every node in the graph.
