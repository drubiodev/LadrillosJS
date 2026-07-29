/**
 * Trusted Types support for the framework's HTML sinks.
 *
 * Under a `require-trusted-types-for 'script'` CSP, assigning a plain string
 * to `innerHTML` or passing one to `DOMParser.parseFromString` throws a
 * TypeError. Both are unavoidable here — the whole premise is that a component
 * is an HTML file — so the strings are routed through a policy instead.
 *
 * The built-in policy is a pass-through, deliberately. Its input is the
 * component template the developer authored, not user input, and sanitizing it
 * would strip the very markup the framework exists to render. Its job is to
 * keep the framework usable under enforcement, not to sanitize. Applications
 * that build templates from untrusted input should supply their own sanitizing
 * policy via `configure({ trustedTypesPolicy })`.
 */

import { warn } from "../../utils/devWarnings";

/**
 * Structural stand-in for `TrustedTypePolicy`, whose lib types are only
 * present on newer DOM typings. `createHTML` returns a `TrustedHTML`, not a
 * string, so it is typed loosely and narrowed at the sink.
 */
export interface TrustedTypesPolicyLike
{
  createHTML(input: string): unknown;
}

/** Must be listed in the `trusted-types` CSP directive to be creatable. */
const POLICY_NAME = "ladrillosjs";

let configuredPolicy: TrustedTypesPolicyLike | null = null;
let builtinPolicy: TrustedTypesPolicyLike | null | undefined;

/** Backs `configure({ trustedTypesPolicy })`. */
export function setTrustedTypesPolicy(
  policy: TrustedTypesPolicyLike | null,
): void
{
  configuredPolicy = policy;
}

function getPolicy(): TrustedTypesPolicyLike | null
{
  if (configuredPolicy) return configuredPolicy;
  if (builtinPolicy !== undefined) return builtinPolicy;

  const factory = (globalThis as { trustedTypes?: { createPolicy?: unknown } })
    .trustedTypes;

  if (typeof factory?.createPolicy !== "function")
  {
    // No Trusted Types in this browser: sinks accept strings, nothing to do.
    builtinPolicy = null;
    return null;
  }

  try
  {
    builtinPolicy = (
      factory.createPolicy as (
        name: string,
        rules: { createHTML: (input: string) => string },
      ) => TrustedTypesPolicyLike
    )(POLICY_NAME, { createHTML: (input) => input });
  } catch
  {
    // Rejected by the `trusted-types` allowlist, or the name is taken.
    builtinPolicy = null;
    warn(
      `Could not create the "${POLICY_NAME}" Trusted Types policy. Add it to ` +
      `the trusted-types CSP directive, or pass an existing policy to ` +
      `configure({ trustedTypesPolicy }). Templates will be assigned as ` +
      `plain strings, which throws under require-trusted-types-for.`,
    );
  }

  return builtinPolicy;
}

/**
 * Converts template HTML into whatever the current sink will accept.
 *
 * Returns the input unchanged when Trusted Types is unavailable or no policy
 * could be created; there is no way to fabricate a TrustedHTML without one, so
 * the browser's own TypeError is left to surface.
 */
export function trustedHTML(html: string): string
{
  const policy = getPolicy();
  // TrustedHTML is not a string, but every sink that demands one accepts it.
  return policy ? (policy.createHTML(html) as string) : html;
}

/** Test seam: forget the cached built-in policy. */
export function resetTrustedTypesPolicy(): void
{
  configuredPolicy = null;
  builtinPolicy = undefined;
}
