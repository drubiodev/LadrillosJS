/**
 * A {@link CodegenBackend} that serves functions produced ahead of time by
 * `@ladrillosjs/compiler`, so a build using it never needs `Function` and
 * therefore never needs `script-src 'unsafe-eval'`.
 *
 * CALLING CONVENTION
 *
 * The runtime invokes evaluators positionally against a preallocated argument
 * array it reuses across rows (see `createContextEvaluator` in scriptParser).
 * The positions are not knowable at build time: the parameter list is
 * `[...shadowedGlobals, ...Object.keys(state)]` and state keys depend on the
 * attributes a component is mounted with, which is why the runtime caches per
 * key-signature rather than per component.
 *
 * So an artifact declares its dependencies *by name* and this backend resolves
 * names to positions once, at compile time, when the runtime hands over the
 * parameter list. Per call there is then a fixed number of indexed reads and
 * no allocation.
 *
 * @see docs/22-csp-and-security.md
 */
import type { CodegenBackend, CompiledFn } from "./compiler";

/**
 * A precompiled template expression.
 *
 * `deps` names the values `fn` expects, in order. A dependency the runtime
 * does not supply arrives as `undefined`, which matches how the runtime
 * shadows globals.
 */
export interface EvaluatorArtifact
{
  deps: readonly string[];
  fn: CompiledFn;
}

/** A precompiled event handler or script body. Same convention as above. */
export interface FunctionArtifact
{
  deps: readonly string[];
  fn: CompiledFn;
}

export interface ArtifactTable
{
  evaluators?: Record<string, EvaluatorArtifact>;
  handlers?: Record<string, FunctionArtifact>;
  setups?: Record<string, FunctionArtifact>;
}

const evaluators = new Map<string, EvaluatorArtifact>();
const handlers = new Map<string, FunctionArtifact>();
const setups = new Map<string, FunctionArtifact>();

/** Registers artifacts emitted for one component. */
export function registerArtifacts(table: ArtifactTable): void
{
  if (table.evaluators)
  {
    for (const [key, artifact] of Object.entries(table.evaluators))
    {
      evaluators.set(key, artifact);
    }
  }
  if (table.handlers)
  {
    for (const [key, artifact] of Object.entries(table.handlers))
    {
      handlers.set(key, artifact);
    }
  }
  if (table.setups)
  {
    for (const [key, artifact] of Object.entries(table.setups))
    {
      setups.set(key, artifact);
    }
  }
}

export function clearArtifacts(): void
{
  evaluators.clear();
  handlers.clear();
  setups.clear();
}

export function hasArtifact(
  kind: "evaluator" | "handler" | "setup",
  key: string
): boolean
{
  const table =
    kind === "evaluator" ? evaluators : kind === "handler" ? handlers : setups;
  return table.has(key);
}

export class MissingArtifactError extends Error
{
  constructor(kind: string, key: string)
  {
    super(
      `[LadrillosJS] No precompiled ${kind} for ${JSON.stringify(key)}. ` +
      `This build cannot compile at runtime. Either the component was not ` +
      `processed by @ladrillosjs/compiler, or it is loaded from a path the ` +
      `compiler could not resolve statically.`
    );
    this.name = "MissingArtifactError";
  }
}

/**
 * Binds an artifact to the runtime's positional parameter list.
 *
 * Specialised for the common small arities so the hot path performs indexed
 * reads off `arguments` with no rest-parameter array and no scope object.
 */
function bind(artifact: FunctionArtifact, params: readonly string[]): CompiledFn
{
  const { deps, fn } = artifact;
  const idx: number[] = [];
  for (let i = 0; i < deps.length; i++)
  {
    idx.push(params.indexOf(deps[i]));
  }

  const read = (args: IArguments, at: number): unknown =>
    at < 0 ? undefined : args[at];

  switch (idx.length)
  {
    case 0:
      return function ()
      {
        return fn();
      };
    case 1: {
      const [a] = idx;
      return function ()
      {
        return fn(read(arguments, a));
      };
    }
    case 2: {
      const [a, b] = idx;
      return function ()
      {
        return fn(read(arguments, a), read(arguments, b));
      };
    }
    case 3: {
      const [a, b, c] = idx;
      return function ()
      {
        return fn(read(arguments, a), read(arguments, b), read(arguments, c));
      };
    }
    default:
      return function ()
      {
        const values = new Array(idx.length);
        for (let i = 0; i < idx.length; i++)
        {
          values[i] = read(arguments, idx[i]);
        }
        return fn.apply(null, values);
      };
  }
}

export const precompiledBackend: CodegenBackend = {
  name: "precompiled",

  compileEvaluator(params, expression)
  {
    const artifact = evaluators.get(expression);
    if (!artifact) throw new MissingArtifactError("evaluator", expression);
    return bind(artifact, params);
  },

  compileHandler(params, _body, _isAsync, key)
  {
    const artifact = handlers.get(key);
    if (!artifact) throw new MissingArtifactError("handler", key);
    return bind(artifact, params);
  },

  compileSetup(params, _body, key)
  {
    const artifact = setups.get(key);
    if (!artifact) throw new MissingArtifactError("setup", key);
    return bind(artifact, params);
  },
};
