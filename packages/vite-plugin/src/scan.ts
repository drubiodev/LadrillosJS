/**
 * Finds `registerComponent` / `registerComponents` calls whose arguments are
 * static enough to precompile.
 *
 * Anything dynamic — a computed path, a spread, a variable — is reported as
 * skipped rather than rewritten. That is the safe direction: a call left alone
 * still works, it just falls back to fetching and parsing at runtime.
 */

export interface ComponentRef
{
    name: string;
    path: string;
    useShadowDOM?: boolean;
}

export interface Rewrite
{
    start: number;
    end: number;
    /** `registerComponents` has to keep returning a result object. */
    kind: "one" | "many";
    components: ComponentRef[];
}

export interface Skip
{
    start: number;
    reason: string;
}

export interface ScanResult
{
    rewrites: Rewrite[];
    skips: Skip[];
}

type Node = Record<string, unknown>;

const SINGLE = "registerComponent";
const BATCH = "registerComponents";

/** Namespaces the framework is reached through. */
const NAMESPACES = new Set(["ladrillosjs", "ladrillos"]);

function isNode(value: unknown): value is Node
{
    return typeof value === "object" && value !== null && typeof (value as Node)["type"] === "string";
}

function literal(node: unknown): string | boolean | number | null | undefined
{
    if (!isNode(node)) return undefined;
    const type = node["type"];
    if (type === "Literal" || type === "StringLiteral" || type === "BooleanLiteral" || type === "NumericLiteral")
    {
        return node["value"] as string | boolean | number | null;
    }
    // A single-quasi template literal is still a constant string.
    if (type === "TemplateLiteral")
    {
        const expressions = node["expressions"] as unknown[] | undefined;
        const quasis = node["quasis"] as Node[] | undefined;
        if (expressions?.length === 0 && quasis?.length === 1)
        {
            const cooked = (quasis[0]["value"] as Node | undefined)?.["cooked"];
            if (typeof cooked === "string") return cooked;
        }
    }
    return undefined;
}

/** Which framework call this is, if any. */
function calleeName(callee: unknown): string | undefined
{
    if (!isNode(callee)) return undefined;

    if (callee["type"] === "Identifier")
    {
        const name = callee["name"] as string;
        return name === SINGLE || name === BATCH ? name : undefined;
    }

    if (callee["type"] === "MemberExpression" && callee["computed"] !== true)
    {
        const object = callee["object"];
        const property = callee["property"];
        if (!isNode(object) || !isNode(property)) return undefined;
        if (object["type"] !== "Identifier") return undefined;
        if (!NAMESPACES.has(object["name"] as string)) return undefined;
        const name = property["name"] as string;
        return name === SINGLE || name === BATCH ? name : undefined;
    }

    return undefined;
}

function propertyKey(property: Node): string | undefined
{
    if (property["computed"] === true) return undefined;
    const key = property["key"];
    if (!isNode(key)) return undefined;
    if (key["type"] === "Identifier") return key["name"] as string;
    const value = literal(key);
    return typeof value === "string" ? value : undefined;
}

/** Reads one entry of a `registerComponents` array or record. */
function readConfig(node: unknown, name?: string): ComponentRef | string
{
    if (typeof node === "string") return { name: name!, path: node };
    if (!isNode(node)) return "entry is not an object";
    if (node["type"] !== "ObjectExpression") return "entry is not an object literal";

    const properties = node["properties"] as unknown[] | undefined;
    if (!properties) return "entry has no properties";

    const ref: Partial<ComponentRef> = name === undefined ? {} : { name };

    for (const raw of properties)
    {
        if (!isNode(raw) || raw["type"] !== "Property") return "entry uses a spread";
        const key = propertyKey(raw);
        if (key === undefined) return "entry has a computed key";

        const value = literal(raw["value"]);

        if (key === "name" || key === "path")
        {
            if (typeof value !== "string") return `"${key}" is not a string literal`;
            ref[key] = value;
        }
        else if (key === "useShadowDOM")
        {
            if (typeof value !== "boolean") return `"useShadowDOM" is not a boolean literal`;
            ref.useShadowDOM = value;
        }
        else if (key === "lazy")
        {
            // Precompiling would define the element up front, which is the
            // opposite of what lazy asked for.
            if (value !== false) return "component is lazy";
        }
        else
        {
            return `unknown option "${key}"`;
        }
    }

    if (!ref.name) return "missing name";
    if (!ref.path) return "missing path";
    return ref as ComponentRef;
}

function readBatch(argument: unknown): ComponentRef[] | string
{
    if (!isNode(argument)) return "argument is not static";

    if (argument["type"] === "ArrayExpression")
    {
        const elements = (argument["elements"] as unknown[]) ?? [];
        const refs: ComponentRef[] = [];
        for (const element of elements)
        {
            const ref = readConfig(element);
            if (typeof ref === "string") return ref;
            refs.push(ref);
        }
        return refs;
    }

    if (argument["type"] === "ObjectExpression")
    {
        const properties = (argument["properties"] as unknown[]) ?? [];
        const refs: ComponentRef[] = [];
        for (const raw of properties)
        {
            if (!isNode(raw) || raw["type"] !== "Property") return "record uses a spread";
            const key = propertyKey(raw);
            if (key === undefined) return "record has a computed key";

            const shorthandPath = literal(raw["value"]);
            const ref =
                typeof shorthandPath === "string"
                    ? readConfig(shorthandPath, key)
                    : readConfig(raw["value"], key);

            if (typeof ref === "string") return ref;
            refs.push(ref);
        }
        return refs;
    }

    return "argument is not an array or record literal";
}

function readSingle(args: unknown[]): ComponentRef | string
{
    const name = literal(args[0]);
    const path = literal(args[1]);

    if (typeof name !== "string") return "name is not a string literal";
    if (typeof path !== "string") return "path is not a string literal";

    const ref: ComponentRef = { name, path };

    if (args.length > 2)
    {
        const useShadowDOM = literal(args[2]);
        if (typeof useShadowDOM !== "boolean") return "useShadowDOM is not a boolean literal";
        ref.useShadowDOM = useShadowDOM;
    }

    if (args.length > 3 && literal(args[3]) !== false) return "component is lazy";
    if (args.length > 4) return "unexpected extra arguments";

    return ref;
}

export function scanRegistrations(ast: unknown): ScanResult
{
    const rewrites: Rewrite[] = [];
    const skips: Skip[] = [];
    const seen = new Set<unknown>();

    const visit = (node: unknown): void =>
    {
        if (Array.isArray(node))
        {
            for (const child of node) visit(child);
            return;
        }
        if (!isNode(node) || seen.has(node)) return;
        seen.add(node);

        if (node["type"] === "CallExpression")
        {
            const which = calleeName(node["callee"]);
            if (which !== undefined)
            {
                const start = node["start"] as number;
                const end = node["end"] as number;
                const args = (node["arguments"] as unknown[]) ?? [];

                if (args.some((a) => isNode(a) && a["type"] === "SpreadElement"))
                {
                    skips.push({ start, reason: "call uses a spread" });
                }
                else if (which === SINGLE)
                {
                    const ref = readSingle(args);
                    if (typeof ref === "string") skips.push({ start, reason: ref });
                    else rewrites.push({ start, end, kind: "one", components: [ref] });
                }
                else
                {
                    const refs = args.length === 1 ? readBatch(args[0]) : "expected one argument";
                    if (typeof refs === "string") skips.push({ start, reason: refs });
                    else rewrites.push({ start, end, kind: "many", components: refs });
                }
            }
        }

        for (const key of Object.keys(node))
        {
            if (key === "type" || key === "start" || key === "end") continue;
            visit(node[key]);
        }
    };

    visit(ast);

    rewrites.sort((a, b) => a.start - b.start);
    return { rewrites, skips };
}
