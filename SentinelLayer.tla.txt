---- MODULE SentinelLayer ----
(***************************************************************************)
(* Sentinel Layer — Guardian Observation Module for the Sovereign Lattice  *)
(* Author: Mohammad Saad Younus                                            *)
(*                                                                         *)
(* The Sentinel is the lattice's self-observation mechanism.  It does not   *)
(* alter phase or energy; it only records what it sees.  Three observation  *)
(* states (clear → watching → alert) track the lattice's health.           *)
(*                                                                         *)
(* Integration: The MFCS spec references `sentinel` as a first-class       *)
(* variable.  This module factors out the Sentinel's transition rules so   *)
(* they can be verified independently before composition.                  *)
(***************************************************************************)

EXTENDS Naturals, FiniteSets

CONSTANTS Components, MaxEnergy

VARIABLES phase, energy, bonds, sentinel

(* ═══════════════════ Sentinel States ═══════════════════ *)

SentinelStates == {"clear", "watching", "alert"}

(* ═══════════════════ Derived Observations ═══════════════════ *)

AllDormant    == \A c \in Components : phase[c] = "dormant"
AnySovereign == \E c \in Components : phase[c] = "sovereign"
AnyActive    == \E c \in Components : phase[c] \in {"active", "sovereign"}

\* Energy health: total energy is non-zero when any component is active.
EnergyHealthy == AnyActive =>
    LET Sum[S \in SUBSET Components] ==
          IF S = {} THEN 0
          ELSE LET x == CHOOSE x \in S : TRUE
               IN  energy[x] + Sum[S \ {x}]
    IN  Sum[Components] > 0

\* Bond integrity: sovereign components have at least one bond.
BondIntegrity ==
    \A c \in Components :
        phase[c] = "sovereign" =>
            \E n \in Components : <<c, n>> \in bonds

(* ═══════════════════ Sentinel Transitions ═══════════════════ *)

\* The Sentinel scans and transitions to the appropriate observation state.
\* This is a pure observation action — no side effects on the lattice.

SentinelTransition ==
    sentinel' =
        CASE AllDormant                     -> "clear"
          [] AnySovereign /\ BondIntegrity  -> "watching"
          [] AnySovereign /\ ~BondIntegrity -> "alert"
          [] AnyActive /\ ~AnySovereign     -> "watching"
          [] OTHER                          -> sentinel

\* When the lattice changes, the Sentinel may also need to re-evaluate.
\* This action is composed with each lattice step in MFCS.tla.
SentinelStep ==
    /\ SentinelTransition
    /\ UNCHANGED <<phase, energy, bonds>>

(* ═══════════════════ Sentinel Invariants ═══════════════════ *)

\* The Sentinel must be alert whenever bond integrity is violated.
SentinelAlert ==
    (AnySovereign /\ ~BondIntegrity) => sentinel = "alert"

\* The Sentinel must be clear only when the lattice is fully dormant.
SentinelClearWhenDormant ==
    sentinel = "clear" => AllDormant

(* ═══════════════════ Composition Note ═══════════════════ *)
\* In MFCS.tla, the SentinelScan action calls SentinelTransition.
\* The Activate and Ascend actions also update sentinel inline,
\* which is consistent with the transition logic above.

====
