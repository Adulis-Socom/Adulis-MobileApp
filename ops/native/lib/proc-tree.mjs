// The processes a verified process started. `all` is one snapshot of the host's processes as
// { ProcessId, ParentProcessId, c } where `c` is the creation time as an ISO string. A process counts as
// a child only if it was created after its parent: a stale parent id (the parent ended and its number was
// given to another process) never pulls an unrelated process into the tree.
export function descendants(all, root) {
  const at = new Map(all.map((p) => [p.ProcessId, p]));
  const top = at.get(root);
  if (!top) return [];
  const found = [];
  const queue = [top];
  const seen = new Set([root]);
  while (queue.length) {
    const parent = queue.shift();
    for (const p of all)
      if (p.ParentProcessId === parent.ProcessId && !seen.has(p.ProcessId) && p.c >= parent.c) {
        seen.add(p.ProcessId);
        found.push(p.ProcessId);
        queue.push(p);
      }
  }
  return found;
}
