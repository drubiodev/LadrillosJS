/**
 * The compiler reuses the runtime's own parser, so it needs a DOM. In a browser
 * that is free; in Node — where Vite runs — one has to be installed first.
 *
 * `ladrillosjs/compiler` is imported only after the globals are in place, and
 * only once, because a second Window would hand back Nodes from a different
 * realm than the ones already-loaded modules close over.
 */
import type { emitComponent, parseComponent } from "ladrillosjs/compiler";

export interface Compiler
{
    parseComponent: typeof parseComponent;
    emitComponent: typeof emitComponent;
}

/** Globals the parse path reaches for. Kept explicit so a miss fails loudly. */
const NEEDED = [
    "DOMParser",
    "document",
    "Node",
    "Element",
    "HTMLElement",
    "HTMLTemplateElement",
    "DocumentFragment",
    "ShadowRoot",
] as const;

let loading: Promise<Compiler> | undefined;

/**
 * The parser fetches a component's external scripts, anchored against the
 * component URL — which here is a `file:` URL that Node's fetch refuses.
 */
function installFileFetch(): void
{
    const original = globalThis.fetch;

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) =>
    {
        const url =
            typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

        if (!url.startsWith("file:")) return original(input, init);

        const { readFile } = await import("node:fs/promises");
        const { fileURLToPath } = await import("node:url");

        try
        {
            return new Response(await readFile(fileURLToPath(url), "utf8"), { status: 200 });
        }
        catch
        {
            return new Response(null, { status: 404 });
        }
    };
}

async function installDOM(): Promise<void>
{
    if (typeof (globalThis as Record<string, unknown>)["DOMParser"] !== "undefined") return;

    let happyDom: typeof import("happy-dom");
    try
    {
        happyDom = await import("happy-dom");
    }
    catch
    {
        throw new Error(
            "@ladrillosjs/vite-plugin needs a DOM to parse components. " +
            "Install happy-dom, or run Vite in an environment that already provides DOMParser."
        );
    }

    const window = new happyDom.Window({ url: "http://localhost/" });
    const target = globalThis as Record<string, unknown>;
    const source = window as unknown as Record<string, unknown>;

    for (const name of NEEDED)
    {
        if (source[name] === undefined)
        {
            throw new Error(`happy-dom did not provide "${name}", which the parser needs.`);
        }
        target[name] ??= source[name];
    }
}

export function loadCompiler(): Promise<Compiler>
{
    loading ??= (async () =>
    {
        await installDOM();
        installFileFetch();
        const mod = await import("ladrillosjs/compiler");
        return { parseComponent: mod.parseComponent, emitComponent: mod.emitComponent };
    })();

    return loading;
}
