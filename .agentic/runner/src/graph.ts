/**
 * Minimal cyclic graph runtime (AGENT-WORKFLOW-DESIGN.md §5.2).
 * Cycles are legal; the recursion limit is the safety, not acyclicity.
 * Routers are pure functions over (state, visit counts) — unit-testable
 * without running a single agent. Nodes receive their visit index.
 */

export type NodeFn<S> = (state: S, visit: number) => Promise<S>;
export type RouterFn<S> = (
  state: S,
  visits: Readonly<Record<string, number>>,
) => string | null;

export interface AgentGraph<S> {
  readonly nodes: Readonly<Record<string, NodeFn<S>>>;
  /** Missing router for a node = the walk ends after that node. */
  readonly routers: Readonly<Record<string, RouterFn<S>>>;
}

export type GraphResult<S> =
  | { readonly ok: true; readonly state: S; readonly visits: Record<string, number> }
  | { readonly ok: false; readonly error: string; readonly state: S };

export async function runGraph<S>(
  graph: AgentGraph<S>,
  initial: S,
  opts: { readonly start: string; readonly recursionLimit?: number },
): Promise<GraphResult<S>> {
  const limit = opts.recursionLimit ?? 25;
  const visits: Record<string, number> = {};
  let state = initial;
  let current: string | null = opts.start;
  let steps = 0;

  while (current !== null) {
    const node = graph.nodes[current];
    if (!node) return { ok: false, error: `unknown node: ${current}`, state };
    if (++steps > limit) {
      return { ok: false, error: `recursion limit ${limit} exceeded at ${current}`, state };
    }
    const visit = (visits[current] ?? 0) + 1;
    visits[current] = visit;
    state = await node(state, visit);
    const router: RouterFn<S> | undefined = graph.routers[current];
    current = router ? router(state, visits) : null;
  }
  return { ok: true, state, visits };
}
