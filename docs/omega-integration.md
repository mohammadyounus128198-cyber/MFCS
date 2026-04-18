# Omega System Integration Notes

MFCS is a formal component within the Omega System decision lattice.

## Role in Omega

- **Layer:** Control / invariants
- **Inputs:** Signals from NEXUS ORACLE / Omega lattice
- **Outputs:** Admissible action sets, invariant violations, and traces

## Integration pattern

1. Omega emits a candidate decision trace.
2. MFCS (via TLC or derived monitors) checks the trace against the specification.
3. If invariants hold, the action set is cleared for execution.
4. If invariants fail, Omega receives a structured violation report.

## Artifacts used

- `specs/MFCS.tla` – Defines the allowed state transitions and invariants.
- `models/default/MC.cfg` – Encodes environment assumptions and parameters.
- `SHA256SUMS.txt` – Ensures the MFCS artifacts used by Omega match the canonical mirror.
