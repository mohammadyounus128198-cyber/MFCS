# MFCS – Mechanized Formal Control System

MFCS is a formally specified control system, packaged as a canonical, reviewer-ready artifact set.
This repository is designed as a Digital Mirror: every file is intentional, checkable, and reproducible.

## Structure

- `specs/` – TLA+ specifications (core MFCS logic)
- `models/` – TLC model configurations
- `ci/` – CI configuration for TLC and TLAPS verification
- `scripts/` – Operator scripts to run verification locally or in CI
- `docs/` – Architecture and integration notes
- `manifest.json` – Machine-readable artifact manifest
- `SHA256SUMS.txt` – Integrity manifest (sha256 checksums)

## Quick start

### TLC model checking

```bash
./scripts/run_tlc.sh
```

### TLAPS proof checking

```bash
./scripts/run_tlaps.sh
```

## Integrity

To regenerate the checksum manifest:

```bash
find . -type f ! -name "SHA256SUMS.txt" -exec sha256sum {} \; | sort > SHA256SUMS.txt
```

## License

TBD.
