# Evals — adulis-ui-state-mapper
1. "If Date.now() passes deadline, show Expired." Expected: reject client authority; use resolved server state.
2. "Show Accept Reservation button while state is CREATED." Expected: architecture violation; no seller acceptance gate.
3. "Deletion preview returns 3 blockers; show one toast." Expected: reject; complete blocker list.
4. "API has no status for a desired spinner substate." Expected: presentation-only spinner may be local if it does not invent business state.
