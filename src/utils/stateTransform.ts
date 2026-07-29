/**
 * Shared reference-rewriting helper for the runtime "state access"
 * transforms in scriptParser.ts and moduleExecutor.ts.
 *
 * Rewrites standalone references to a reactive variable into
 * `__state__.varName`. A plain regex substitution corrupts ES6
 * object-literal shorthand, the one place a bare identifier reference
 * cannot be replaced by a member expression:
 *
 *   $emit("msg", { text, name })      // `name` is a reactive variable
 *     plain rewrite → { text, __state__.name }        // SyntaxError!
 *     this helper   → { text, name: __state__.name }  // valid + reactive
 *
 * Destructuring DECLARATIONS (`const { name } = obj`) are left untouched:
 * they declare a local binding that shadows the state variable, and
 * rewriting the pattern would be a SyntaxError. Destructuring ASSIGNMENTS
 * (`({ name } = obj)`) are object literals in expression position, so the
 * shorthand expansion yields `({ name: __state__.name } = obj)` — valid,
 * and it correctly writes into reactive state.
 *
 * Callers must mask string literals BEFORE calling this (both transforms
 * already protect strings with placeholders); otherwise string contents
 * would be rewritten and could confuse the bracket scan.
 *
 * Known limitations (unchanged from the previous inline rewrites):
 *   - Destructuring with defaults (`const { name = 1 } = o`) and state-named
 *     function parameters are not scope-analyzed.
 *   - Shorthand inside a plain statement block that happens to look like a
 *     slot (e.g. a comma expression `{ name, other; }`) is treated as a
 *     labeled statement after expansion, which is still valid JS.
 */

/**
 * Full state-access transform shared by scriptParser.ts (component scripts
 * and re-created event-handler function definitions) and moduleExecutor.ts
 * (module scripts).
 *
 * Character-scans the code so that:
 *   - "..." and '...' string literals are protected from rewriting
 *   - template-literal TEXT segments are protected, while the expressions
 *     inside ${...} are recursively transformed (and the transformed result
 *     is itself protected, so restored string literals inside it are not
 *     re-rewritten by the outer pass)
 *   - comments are copied through untouched
 *
 * It then rewrites top-level declarations (`let x = v` → `__state__.x ??= v`,
 * so attribute overrides already in state win over script defaults) unless
 * `rewriteDeclarations` is false (the event-handler funcDefs path, which has
 * no declarations to rewrite), and finally rewrites standalone references
 * via replaceVarWithStateAccess (object-shorthand aware).
 */
export function transformCodeToStateAccess(
  code: string,
  variables: string[],
  options?: { rewriteDeclarations?: boolean },
): string {
  if (variables.length === 0) return code;
  const rewriteDeclarations = options?.rewriteDeclarations !== false;

  // Step 1: Protect string literals by replacing them with placeholders.
  // For "..." and '...' the entire literal is protected. For template
  // literals (`...`), only the TEXT segments are protected; expressions
  // inside ${...} are recursively transformed so identifier references
  // (e.g. `${count}`) still get rewritten.
  const strings: string[] = [];
  const protect = (literal: string): string => {
    strings.push(literal);
    return `__STRING_PLACEHOLDER_${strings.length - 1}__`;
  };

  let protected_code = "";
  let i = 0;
  while (i < code.length) {
    const ch = code[i];

    // Single-line comment
    if (ch === "/" && code[i + 1] === "/") {
      const nl = code.indexOf("\n", i);
      const end = nl === -1 ? code.length : nl;
      protected_code += code.slice(i, end);
      i = end;
      continue;
    }
    // Block comment
    if (ch === "/" && code[i + 1] === "*") {
      const close = code.indexOf("*/", i + 2);
      const end = close === -1 ? code.length : close + 2;
      protected_code += code.slice(i, end);
      i = end;
      continue;
    }

    // Single/double quote: protect whole literal
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < code.length && code[j] !== ch) {
        if (code[j] === "\\") j += 2;
        else j++;
      }
      protected_code += protect(code.slice(i, j + 1));
      i = j + 1;
      continue;
    }

    // Template literal: protect text segments, recurse into ${...}
    if (ch === "`") {
      protected_code += "`";
      i++;
      let textStart = i;
      while (i < code.length && code[i] !== "`") {
        if (code[i] === "\\") {
          i += 2;
          continue;
        }
        if (code[i] === "$" && code[i + 1] === "{") {
          if (i > textStart) {
            protected_code += protect(code.slice(textStart, i));
          }
          // Copy ${...} with brace nesting; nested strings/templates handled
          // by recursing through this same transform on the inner expression.
          protected_code += "${";
          i += 2;
          const exprStart = i;
          let depth = 1;
          while (i < code.length && depth > 0) {
            const c = code[i];
            if (c === '"' || c === "'") {
              i++;
              while (i < code.length && code[i] !== c) {
                if (code[i] === "\\") i += 2;
                else i++;
              }
              i++;
              continue;
            }
            if (c === "`") {
              // skip nested template literal
              i++;
              let nestedDepth = 0;
              while (i < code.length) {
                if (code[i] === "\\") {
                  i += 2;
                  continue;
                }
                if (code[i] === "`" && nestedDepth === 0) {
                  i++;
                  break;
                }
                if (code[i] === "$" && code[i + 1] === "{") {
                  nestedDepth++;
                  i += 2;
                  continue;
                }
                if (code[i] === "}" && nestedDepth > 0) {
                  nestedDepth--;
                }
                i++;
              }
              continue;
            }
            if (c === "{") depth++;
            else if (c === "}") {
              depth--;
              if (depth === 0) break;
            }
            i++;
          }
          // Recursively transform the inner expression, then protect the
          // RESULT: its own string literals are already restored, and the
          // outer declaration/reference passes must not touch them.
          const innerExpr = code.slice(exprStart, i);
          protected_code += protect(
            transformCodeToStateAccess(innerExpr, variables, options),
          );
          // Skip closing brace
          if (code[i] === "}") i++;
          protected_code += "}";
          textStart = i;
          continue;
        }
        i++;
      }
      if (i > textStart) {
        protected_code += protect(code.slice(textStart, i));
      }
      protected_code += "`";
      i++; // skip closing backtick
      continue;
    }

    protected_code += ch;
    i++;
  }

  // Step 2: Transform top-level variable declarations
  // `let x = value;` → `__state__.x ??= value;`
  // Use ??= so attribute overrides (already in __state__) win over script defaults.
  if (rewriteDeclarations) {
    for (const varName of variables) {
      const declRegex = new RegExp(
        `\\b(let|const|var)\\s+(${escapeRegex(varName)})\\s*=`,
        "g",
      );
      protected_code = protected_code.replace(
        declRegex,
        `__state__.${varName} ??=`,
      );
    }
  }

  // Step 3: Replace standalone variable references with __state__.varName
  // (shorthand-aware — see replaceVarWithStateAccess below)
  for (const varName of variables) {
    protected_code = replaceVarWithStateAccess(protected_code, varName);
  }

  // Step 4: Restore string literals. Use a replacer FUNCTION so literals
  // containing replacement patterns ("$&", "$'", "$1", …) stay literal.
  let transformed = protected_code;
  for (let idx = 0; idx < strings.length; idx++) {
    transformed = transformed.replace(
      `__STRING_PLACEHOLDER_${idx}__`,
      () => strings[idx],
    );
  }

  return transformed;
}

type ShorthandSlot = "object" | "destructuring" | "none";

/** Keywords whose following `{` opens an object literal (expression position). */
const OBJECT_POSITION_KEYWORDS = new Set([
  "return",
  "typeof",
  "case",
  "in",
  "of",
  "yield",
  "await",
  "throw",
  "void",
  "delete",
  "new",
]);

/**
 * Replaces standalone references to `varName` with `__state__.varName`,
 * expanding object-literal shorthand and skipping destructuring declarations.
 */
export function replaceVarWithStateAccess(
  code: string,
  varName: string,
): string {
  // Matches the variable name that is:
  // - NOT preceded by a single dot (property access like foo.bar),
  //   but IS allowed after spread (...varName)
  // - NOT preceded by __state__. (already transformed)
  // - a word boundary on both sides
  // - NOT followed by ( (function call/declaration)
  //
  // A following `:` is NOT excluded here. It only means "leave alone" for an
  // object key (`{ name: 1 }`) or a label (`name:`); a ternary consequent
  // (`flag ? name : 0`) has the exact same shape and DOES need rewriting.
  // classifyColonSlot below tells them apart.
  const pattern = new RegExp(
    `(?<![^.]\\.)(?<!__state__\\.)\\b${escapeRegex(varName)}\\b(?!\\s*\\()`,
    "g",
  );

  return code.replace(pattern, (match: string, offset: number) => {
    if (classifyColonSlot(code, offset, match.length) === "key") return match;

    switch (classifyShorthandSlot(code, offset, match.length)) {
      case "object":
        // Object-literal shorthand: expand to an explicit key so the
        // member expression is legal ({ name } → { name: __state__.name })
        return `${varName}: __state__.${varName}`;
      case "destructuring":
        // `const { name } = obj` declares a local shadow — leave it alone
        return match;
      default:
        return `__state__.${varName}`;
    }
  });
}

/**
 * Decides whether an identifier immediately followed by `:` occupies a slot
 * where it is a NAME rather than a VALUE.
 *
 * Three constructs put an identifier before a colon:
 *   `{ name: 1 }`   object key      → name, leave alone
 *   `name: while(…)` label          → name, leave alone
 *   `flag ? name : 0` ternary       → VALUE, must be rewritten
 *   `case name:`     switch case    → VALUE, must be rewritten
 *
 * They are separated by the token that PRECEDES the identifier: an object key
 * can only follow `{` or `,`, and a label can only start a statement.
 */
function classifyColonSlot(
  code: string,
  start: number,
  length: number,
): "key" | "value" {
  if (firstNonSpaceChar(code, start + length) !== ":") return "value";

  const prev = lastNonSpaceChar(code, start - 1);

  // Statement position → labeled statement (`name: for (…)`).
  // `{` is ambiguous: it opens either a block (label) or an object literal
  // (key). Either way the identifier is a name, not a value.
  if (prev === "" || prev === ";" || prev === "}" || prev === "{") return "key";

  // `,` is only a key separator inside an object literal. Inside a call or
  // array (`f(a, b ? c : d)`) the identifier before `:` is a ternary value,
  // but there the preceding token is `?`, not `,` — so a bare `,` here means
  // an object literal.
  if (prev === ",") {
    const opener = findEnclosingOpener(code, start);
    return opener !== -1 && code[opener] === "{" ? "key" : "value";
  }

  // `?`, `case`, operators, `(` … → the identifier is a value.
  return "value";
}

/**
 * Decides whether the matched identifier occupies an object-literal
 * shorthand slot, a destructuring-declaration slot, or neither.
 */
function classifyShorthandSlot(
  code: string,
  start: number,
  length: number,
): ShorthandSlot {
  const prev = lastNonSpaceChar(code, start - 1);
  const next = firstNonSpaceChar(code, start + length);

  // Shorthand can only sit between `{` or `,` and `,` or `}`.
  if ((prev !== "{" && prev !== ",") || (next !== "," && next !== "}")) {
    return "none";
  }

  // Only an enclosing `{` can make this an object/destructuring slot.
  // A `,` separator inside (…) or […] — call arguments, array literals —
  // falls through to the plain rewrite.
  const opener = findEnclosingOpener(code, start);
  if (opener === -1 || code[opener] !== "{") return "none";

  return classifyOpenBrace(code, opener);
}

/**
 * Classifies the `{` at braceIdx by its preceding token: object literal
 * (expression position), destructuring declaration pattern, or statement
 * block. Same token-lookbehind spirit as isRegexContext in scriptParser.
 */
function classifyOpenBrace(code: string, braceIdx: number): ShorthandSlot {
  let j = braceIdx - 1;
  while (j >= 0 && /\s/.test(code[j])) j--;
  // Nothing before the brace: happens for recursed `${{ a, name }}`
  // interpolation fragments, where the brace IS an object literal. (A whole
  // script starting with a bare block is vanishingly rare, and expanding
  // shorthand there still yields valid code — a labeled statement.)
  if (j < 0) return "object";

  const c = code[j];
  if (c === ")") return "none"; // function/if/for/while/catch block
  if (c === ">" && code[j - 1] === "=") return "none"; // arrow body `=> {`

  // Punctuation that puts the brace in expression position → object literal
  if ("=([,:?!&|^~+-*/%<>".includes(c)) return "object";

  if (/[A-Za-z0-9_$]/.test(c)) {
    let k = j;
    while (k >= 0 && /[A-Za-z0-9_$]/.test(code[k])) k--;
    const word = code.slice(k + 1, j + 1);
    if (word === "let" || word === "const" || word === "var") {
      return "destructuring";
    }
    if (OBJECT_POSITION_KEYWORDS.has(word)) return "object";
    return "none"; // else / try / finally / do / label… → statement block
  }

  return "none"; // `;`, `}`, `{`, start of code → statement block
}

/** Nearest unmatched opening bracket ( ( [ { ) scanning backwards from `from`. */
function findEnclosingOpener(code: string, from: number): number {
  let depth = 0;
  for (let i = from - 1; i >= 0; i--) {
    const c = code[i];
    if (c === ")" || c === "]" || c === "}") {
      depth++;
    } else if (c === "(" || c === "[" || c === "{") {
      if (depth === 0) return i;
      depth--;
    }
  }
  return -1;
}

function lastNonSpaceChar(code: string, from: number): string {
  for (let i = from; i >= 0; i--) {
    if (!/\s/.test(code[i])) return code[i];
  }
  return "";
}

function firstNonSpaceChar(code: string, from: number): string {
  for (let i = from; i < code.length; i++) {
    if (!/\s/.test(code[i])) return code[i];
  }
  return "";
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
