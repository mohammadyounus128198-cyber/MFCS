---- MODULE MFCS ----
(***************************************************************************)
(* Modular Formal Component System — Sovereign Lattice Codex               *)
(* Author: Mohammad Saad Younus                                            *)
(*                                                                         *)
(* بسم الله الرحمن الرحيم                                                  *)
(* Bismillahi r-Rahmani r-Rahim                                            *)
(*                                                                         *)
(* This specification models a lattice of sovereign components, each       *)
(* carrying a phase and an energy level.  Three safety invariants guard     *)
(* the lattice:                                                            *)
(*                                                                         *)
(*   ZERO_BLEED         — isolation between unbonded components            *)
(*   PHASE_CANCELLATION — conflicting awakening phases cancel              *)
(*   NOISE_FLOOR        — minimum energy backing for active components     *)
(*                                                                         *)
(* The Sentinel variable tracks the guardian's observation state.           *)
(***************************************************************************)

EXTENDS Naturals, FiniteSets

CONSTANTS
    Components,        \* Finite set of component identifiers
    MaxEnergy          \* Positive natural: upper energy bound per component

ASSUME ComponentAssumption ==
    /\ IsFiniteSet(Components)
    /\ Components /= {}

ASSUME EnergyAssumption ==
    /\ MaxEnergy \in Nat
    /\ MaxEnergy >= 2

VARIABLES
    phase,             \* phase[c] \in Phases for each c \in Components
    energy,            \* energy[c] \in 0..MaxEnergy
    bonds,             \* Symmetric relation on Components (lattice edges)
    sentinel           \* Guardian observation: "clear" | "watching" | "alert"

vars == <<phase, energy, bonds, sentinel>>

(* ═══════════════════ Constants and Helpers ═══════════════════ *)

Phases == {"dormant", "awakening", "active", "sovereign"}

PhaseRank ==
    [dormant   |-> 0,
     awakening |-> 1,
     active    |-> 2,
     sovereign |-> 3]

Bonded(c1, c2) == <<c1, c2>> \in bonds

Neighbors(c) == {n \in Components : Bonded(c, n)}

TotalEnergy == LET Sum[S \in SUBSET Components] ==
                     IF S = {} THEN 0
                     ELSE LET x == CHOOSE x \in S : TRUE
                          IN  energy[x] + Sum[S \ {x}]
               IN  Sum[Components]

ActiveCount == Cardinality({c \in Components :
                   phase[c] \in {"active", "sovereign"}})

(* ═══════════════════ Type Invariant ═══════════════════ *)

TypeOK ==
    /\ phase \in [Components -> Phases]
    /\ energy \in [Components -> 0..MaxEnergy]
    /\ bonds \subseteq (Components \X Components)
    /\ \A c \in Components : <<c, c>> \notin bonds          \* irreflexive
    /\ \A c1, c2 \in Components :                            \* symmetric
         Bonded(c1, c2) <=> Bonded(c2, c1)
    /\ sentinel \in {"clear", "watching", "alert"}

(* ═══════════════════ Safety Invariants ═══════════════════ *)

\* ZERO_BLEED
\* A sovereign component's influence does not reach unbonded components.
\* Formally: if c1 is sovereign and c2 is awakening, they must be bonded.
ZeroBleed ==
    \A c1, c2 \in Components :
        c1 /= c2 /\ phase[c1] = "sovereign" /\ phase[c2] = "awakening"
        => Bonded(c1, c2)

\* PHASE_CANCELLATION
\* Two bonded components cannot simultaneously be in the awakening phase.
\* Awakening interferes destructively across a bond.
PhaseCancellation ==
    \A c1, c2 \in Components :
        Bonded(c1, c2) =>
            ~(phase[c1] = "awakening" /\ phase[c2] = "awakening")

\* NOISE_FLOOR
\* Every component in the active or sovereign phase must carry
\* strictly positive energy.  The lattice does not run on empty.
NoiseFloor ==
    \A c \in Components :
        phase[c] \in {"active", "sovereign"} => energy[c] > 0

\* Combined safety property checked by TLC.
Safety == TypeOK /\ ZeroBleed /\ PhaseCancellation /\ NoiseFloor

(* ═══════════════════ Initial State ═══════════════════ *)

Init ==
    /\ phase    = [c \in Components |-> "dormant"]
    /\ energy   = [c \in Components |-> 1]
    /\ bonds    = {}
    /\ sentinel = "clear"

(* ═══════════════════ Actions ═══════════════════ *)

\* ── Awaken ──────────────────────────────────────
\* dormant → awakening
\* Guard: energy ≥ 1; no bonded neighbor is already awakening
\* (preserves PhaseCancellation).
Awaken(c) ==
    /\ phase[c] = "dormant"
    /\ energy[c] >= 1
    /\ \A n \in Neighbors(c) : phase[n] /= "awakening"
    \* ZeroBleed guard: no unbonded sovereign is active toward us
    /\ \A s \in Components :
         s /= c /\ phase[s] = "sovereign" => Bonded(s, c)
    /\ phase' = [phase EXCEPT ![c] = "awakening"]
    /\ UNCHANGED <<energy, bonds, sentinel>>

\* ── Activate ────────────────────────────────────
\* awakening → active
Activate(c) ==
    /\ phase[c] = "awakening"
    /\ energy[c] >= 1
    /\ phase' = [phase EXCEPT ![c] = "active"]
    /\ sentinel' = IF sentinel = "clear" THEN "watching" ELSE sentinel
    /\ UNCHANGED <<energy, bonds>>

\* ── Ascend ──────────────────────────────────────
\* active → sovereign
\* Requires energy ≥ 2, at least one bonded active neighbor,
\* and no unbonded component is in awakening (ZeroBleed).
Ascend(c) ==
    /\ phase[c] = "active"
    /\ energy[c] >= 2
    /\ \E n \in Neighbors(c) : phase[n] \in {"active", "sovereign"}
    /\ \A u \in Components :
         u /= c /\ ~Bonded(c, u) => phase[u] /= "awakening"
    /\ phase'  = [phase  EXCEPT ![c] = "sovereign"]
    /\ energy' = [energy EXCEPT ![c] = @ - 1]
    /\ sentinel' = "watching"
    /\ UNCHANGED bonds

\* ── Rest ────────────────────────────────────────
\* any non-dormant → dormant   (energy preserved)
Rest(c) ==
    /\ phase[c] /= "dormant"
    /\ phase' = [phase EXCEPT ![c] = "dormant"]
    /\ UNCHANGED <<energy, bonds, sentinel>>

\* ── Bond ────────────────────────────────────────
\* Create a symmetric lattice bond between c1 and c2.
\* Guard: must not create dual-awakening across the new bond.
Bond(c1, c2) ==
    /\ c1 /= c2
    /\ ~Bonded(c1, c2)
    /\ ~(phase[c1] = "awakening" /\ phase[c2] = "awakening")
    /\ bonds' = bonds \union {<<c1, c2>>, <<c2, c1>>}
    /\ UNCHANGED <<phase, energy, sentinel>>

\* ── Unbond ──────────────────────────────────────
\* Remove a bond.  Sovereign bonds are load-bearing: cannot unbond
\* if either endpoint is sovereign.
Unbond(c1, c2) ==
    /\ Bonded(c1, c2)
    /\ phase[c1] /= "sovereign"
    /\ phase[c2] /= "sovereign"
    /\ bonds' = bonds \ {<<c1, c2>>, <<c2, c1>>}
    /\ UNCHANGED <<phase, energy, sentinel>>

\* ── Transfer ────────────────────────────────────
\* Move one unit of energy between bonded components.
\* Structurally enforces ZeroBleed (only bonded pairs).
\* NoiseFloor guard: donor retains energy > 0 if active/sovereign.
Transfer(c1, c2) ==
    /\ Bonded(c1, c2)
    /\ energy[c1] >= 1
    /\ energy[c2] < MaxEnergy
    /\ phase[c1] \in {"active", "sovereign"} => energy[c1] >= 2
    /\ energy' = [energy EXCEPT ![c1] = @ - 1, ![c2] = @ + 1]
    /\ UNCHANGED <<phase, bonds, sentinel>>

\* ── SentinelScan ────────────────────────────────
\* The guardian evaluates overall lattice health.
SentinelScan ==
    /\ sentinel' =
         IF \A c \in Components : phase[c] = "dormant"
         THEN "clear"
         ELSE IF \E c \in Components : phase[c] = "sovereign"
              THEN "watching"
              ELSE "watching"
    /\ UNCHANGED <<phase, energy, bonds>>

(* ═══════════════════ Next-State Relation ═══════════════════ *)

Next ==
    \/ \E c \in Components :
         \/ Awaken(c)
         \/ Activate(c)
         \/ Ascend(c)
         \/ Rest(c)
    \/ \E c1, c2 \in Components :
         \/ Bond(c1, c2)
         \/ Unbond(c1, c2)
         \/ Transfer(c1, c2)
    \/ SentinelScan

(* ═══════════════════ Specification ═══════════════════ *)

Spec == Init /\ [][Next]_vars /\ WF_vars(Next)

(* ═══════════════════ Liveness ═══════════════════ *)

\* Under fairness, every component eventually reaches sovereign.
Liveness == \A c \in Components : <>(phase[c] = "sovereign")

(* ═══════════════════ Theorems (TLAPS) ═══════════════════ *)

THEOREM Thm_InitSafety     == Init => Safety
THEOREM Thm_InductiveSafety == TypeOK /\ Safety /\ Next => Safety'

====
