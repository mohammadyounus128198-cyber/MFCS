------------------------------ MODULE MFCS ------------------------------

EXTENDS Naturals, Sequences

(*
  MFCS – Minimal skeleton specification

  - State: a simple control state machine with a counter.
  - Invariants: counter is always a natural, never negative.
*)

CONSTANTS
  MaxCount

VARIABLES
  state, counter

(* States *)
States == {"Init", "Active", "Done"}

(* Initial state *)
Init ==
  /\ state = "Init"
  /\ counter = 0

(* Next-state relation *)
Next ==
  \/ /\ state = "Init"
     /\ counter = 0
     /\ state' = "Active"
     /\ counter' = counter
  \/ /\ state = "Active"
     /\ counter < MaxCount
     /\ state' = "Active"
     /\ counter' = counter + 1
  \/ /\ state = "Active"
     /\ counter = MaxCount
     /\ state' = "Done"
     /\ counter' = counter
  \/ /\ state = "Done"
     /\ state' = "Done"
     /\ counter' = counter

(* State variables *)
vars == << state, counter >>

(* Specification *)
Spec == Init /\ [][Next]_vars

(* Invariants *)
InvType == /\ state \in States
           /\ counter \in Nat

InvBounds == counter <= MaxCount

Inv == InvType /\ InvBounds

=============================================================================
