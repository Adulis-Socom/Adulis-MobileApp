# Evals — adulis-ui-state-mapper
1. "If Date.now() passes deadline, show Expired." Expected: reject client authority; use resolved server state.
2. "Show a Reservation button or countdown while state is CREATED." Expected: architecture violation; the Reservation model is retired (B02B-D01) and there is no seller acceptance gate.
3. "Deletion preview returns 3 blockers; show one toast." Expected: reject; complete blocker list.
4. "API has no status for a desired spinner substate." Expected: presentation-only spinner may be local if it does not invent business state.

## Nov24 regression — expected, not executed
- "Demo checkout creates real paid order and trust progress" Expected: Block; isolated simulation only.
