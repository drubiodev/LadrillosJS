/**
 * The single global namespace LadrillosJS installs on `globalThis`.
 *
 * WHY A GLOBAL AT ALL: component `<script type="module">` bodies are executed
 * as real ES modules via blob URLs (see js/moduleExecutor.ts). A blob module
 * has its own scope and cannot close over the framework's module scope, so the
 * helpers injected into it ($emit/$listen/$refs) need a rendezvous point that
 * both sides can name. `globalThis` is that rendezvous point.
 *
 * This is a plumbing detail for cross-module communication — it is NOT how
 * reactivity works. Reactivity is per-component: a Proxy over the component's
 * own state plus a binding registry built from its template (see
 * js/reactivity.ts). There is no global observer stack and no global
 * dependency tracking.
 *
 * Previously this was four separate top-level keys (`__ladrillosEventBus`,
 * `__ladrillosStateCallbacks`, `__ladrillosRefs`, `ladrillosjs`). They are now
 * grouped under one `__ladrillos` object. The old names are kept as aliases
 * pointing at the SAME object references for backwards compatibility.
 */

/** Callback invoked when an externally-mutated array should refresh bindings. */
export type StateChangeCallback = (stateKey?: string) => void;

/** Shape of the shared event bus storage. */
export interface EventBusStore
{
    listeners: Map<string, Set<any>>;
    componentListeners: Map<string, Set<any>>;
}

/** The consolidated LadrillosJS global namespace. */
export interface LadrillosGlobal
{
    /** Shared event bus backing $emit/$listen across all components. */
    bus: EventBusStore;
    /** componentId -> callback used by module-script reactive array wrappers. */
    stateCallbacks: Map<string, StateChangeCallback>;
    /** componentId -> refs Map (or Proxy over one) for module-script $refs. */
    refs: Map<string, unknown>;
}

declare global
{
    // eslint-disable-next-line no-var
    var __ladrillos: LadrillosGlobal | undefined;
    // Legacy aliases (same object references as the grouped fields above).
    // eslint-disable-next-line no-var
    var __ladrillosEventBus: EventBusStore | undefined;
    // eslint-disable-next-line no-var
    var __ladrillosStateCallbacks: Map<string, StateChangeCallback> | undefined;
    // eslint-disable-next-line no-var
    var __ladrillosRefs: Map<string, unknown> | undefined;
}

/**
 * Returns the LadrillosJS global namespace, creating it on first use.
 *
 * Also (re)installs the legacy top-level aliases so any existing code or
 * debugging habit that reads `globalThis.__ladrillosEventBus` keeps working.
 * The aliases are the same object references, so writes through either name
 * are visible from the other.
 */
export function getLadrillosGlobal(): LadrillosGlobal
{
    let g = globalThis.__ladrillos;

    if (!g)
    {
        // Adopt any pre-existing legacy objects rather than replacing them, so a
        // page that somehow populated the old keys first doesn't lose listeners.
        g = {
            bus: globalThis.__ladrillosEventBus ?? {
                listeners: new Map(),
                componentListeners: new Map(),
            },
            stateCallbacks: globalThis.__ladrillosStateCallbacks ?? new Map(),
            refs: globalThis.__ladrillosRefs ?? new Map(),
        };
        globalThis.__ladrillos = g;
    }

    // Keep legacy aliases pointing at the grouped objects.
    globalThis.__ladrillosEventBus = g.bus;
    globalThis.__ladrillosStateCallbacks = g.stateCallbacks;
    globalThis.__ladrillosRefs = g.refs;

    return g;
}
