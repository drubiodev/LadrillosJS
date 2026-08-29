import { readFile } from "node:fs/promises";
import { statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import MagicString from "magic-string";
import { parseAst, type Plugin } from "vite";
import { loadCompiler } from "./compiler";
import { scanRegistrations, type ComponentRef } from "./scan";

export interface LadrillosOptions
{
    /**
     * Package specifier the emitted artifacts import from. `ladrillosjs/csp` is
     * the entry with no `Function` in it, which is the whole point.
     */
    runtimeImport?: string;
    /**
     * Precompile during `vite serve` as well. Off by default so editing a
     * component stays a plain file reload; turn it on to develop against the
     * same CSP the production page will run under.
     */
    dev?: boolean;
    /** Turn "could not precompile this registration" from a warning into an error. */
    strict?: boolean;
}

const VIRTUAL_PREFIX = "\0ladrillos-artifact:";
const SCANNABLE = /\.[cm]?[jt]sx?(?:$|\?)/;

interface Resolved extends ComponentRef
{
    file: string;
}

/**
 * Resolves a registration path to a file on disk.
 *
 * At runtime these paths resolve against the *page* URL, not the module doing
 * the registering, and the two only coincide when the entry module sits at the
 * web root. Rather than pick a winner, try both and require exactly one to
 * exist — an ambiguous path is reported instead of guessed at.
 */
function resolveComponent(
    ref: ComponentRef,
    importer: string,
    root: string,
    publicDir: string,
): Resolved | string
{
    if (!/^\.{0,2}\//.test(ref.path))
    {
        return `"${ref.path}" is not a relative or root-absolute path`;
    }

    const candidates = ref.path.startsWith("/")
        ? [path.join(root, ref.path), path.join(publicDir, ref.path)]
        : [
            path.resolve(path.dirname(importer), ref.path),
            path.resolve(root, ref.path),
            path.resolve(publicDir, ref.path),
        ];

    const found = [...new Set(candidates)]
        .map((candidate) =>
        {
            try
            {
                if (statSync(candidate).isFile()) return candidate;
                const index = path.join(candidate, "index.html");
                return statSync(index).isFile() ? index : undefined;
            }
            catch
            {
                return undefined;
            }
        })
        .filter((candidate): candidate is string => candidate !== undefined);

    if (found.length === 0) return `no file found for "${ref.path}"`;
    if (found.length > 1)
    {
        return (
            `"${ref.path}" is ambiguous — it exists both next to the importer and at the ` +
            `project root. Make it unambiguous so the build and the browser agree.`
        );
    }

    return { ...ref, file: found[0] };
}

function artifactId(file: string, tagName: string): string
{
    return `${VIRTUAL_PREFIX}${encodeURIComponent(file)}?tag=${encodeURIComponent(tagName)}`;
}

/** `defineCompiled` defaults to shadow DOM, so only pass the flag when it differs. */
function defineCall(local: string, ref: ComponentRef): string
{
    return ref.useShadowDOM === false ? `${local}({useShadowDOM:false})` : `${local}()`;
}

export default function ladrillos(options: LadrillosOptions = {}): Plugin
{
    const runtimeImport = options.runtimeImport ?? "ladrillosjs/csp";
    const strict = options.strict ?? false;

    let root = process.cwd();
    let publicDir = path.resolve(root, "public");
    let active = true;

    return {
        name: "ladrillosjs",
        // Registrations are read as ESTree, which cannot represent TypeScript,
        // so this has to run after Vite's esbuild transform. `pre` demonstrably
        // breaks on a .ts entry.
        enforce: "post",

        configResolved(config)
        {
            root = config.root;
            publicDir = config.publicDir;
            active = config.command === "build" || options.dev === true;
        },

        resolveId(id)
        {
            return id.startsWith(VIRTUAL_PREFIX) ? id : null;
        },

        async load(id)
        {
            if (!id.startsWith(VIRTUAL_PREFIX)) return null;

            const artifact = id.slice(VIRTUAL_PREFIX.length);
            const [encodedFile, query] = [
                artifact.slice(0, artifact.indexOf("?")),
                artifact.slice(artifact.indexOf("?") + 1),
            ];
            const file = decodeURIComponent(encodedFile);
            const tagName = decodeURIComponent(
                new URLSearchParams(query).get("tag") ?? ""
            );

            if (!tagName) this.error(`Artifact request for ${file} carried no tag name.`);

            this.addWatchFile(file);

            const source = await readFile(file, "utf8");
            const { parseComponent, emitComponent } = await loadCompiler();

            const component = await parseComponent(
                source,
                tagName,
                pathToFileURL(file).href,
                { resolveStyleHrefs: false }
            );

            // Parsing needs a real file: URL to resolve external scripts against,
            // but sourcePath only ever surfaces in dev warnings — shipping it
            // would put the build machine's home directory in the bundle.
            component.sourcePath = path.relative(root, file);

            return emitComponent(component, { runtimeImport }).code;
        },

        async transform(code, id)
        {
            if (!active) return null;
            if (id.startsWith(VIRTUAL_PREFIX)) return null;
            if (!SCANNABLE.test(id) || id.includes("/node_modules/")) return null;
            // Cheap gate: parsing every module in the graph is not worth it.
            if (!code.includes("registerComponent")) return null;

            const { rewrites, skips } = scanRegistrations(parseAst(code, undefined, id));

            for (const skip of skips) report(this, id, skip.start, skip.reason);
            if (rewrites.length === 0) return null;

            const source = new MagicString(code);
            const imports: string[] = [];
            let next = 0;
            let changed = false;

            for (const rewrite of rewrites)
            {
                const resolved: Resolved[] = [];
                let failure: string | undefined;

                for (const ref of rewrite.components)
                {
                    const result = resolveComponent(ref, id, root, publicDir);
                    if (typeof result === "string")
                    {
                        failure = result;
                        break;
                    }
                    resolved.push(result);
                }

                if (failure !== undefined)
                {
                    report(this, id, rewrite.start, failure);
                    continue;
                }

                const calls = resolved.map((ref) =>
                {
                    const local = `__ljs_define_${next++}`;
                    imports.push(
                        `import ${local} from ${JSON.stringify(artifactId(ref.file, ref.name))};`
                    );
                    return defineCall(local, ref);
                });

                // registerComponents resolves to a result object callers may read,
                // so the batch form keeps that shape.
                const replacement =
                    rewrite.kind === "one"
                        ? calls[0] ?? "undefined"
                        : `(${[
                            ...calls,
                            JSON.stringify({
                                success: resolved.map((r) => r.name),
                                failed: [],
                                skipped: [],
                            }),
                        ].join(",")})`;

                source.overwrite(rewrite.start, rewrite.end, replacement);
                changed = true;
            }

            if (!changed) return null;

            source.prepend(`${imports.join("\n")}\n`);
            return { code: source.toString(), map: source.generateMap({ hires: true }) };
        },
    };

    function report(
        ctx: { warn: (message: string) => void; error: (message: string) => never; },
        id: string,
        position: number,
        reason: string
    ): void
    {
        const message =
            `Left a component registration for the runtime to handle: ${reason}. ` +
            `(${path.relative(root, id.split("?")[0])}, offset ${position}) ` +
            `The page will need script-src 'unsafe-eval' unless this is precompiled.`;

        if (strict) ctx.error(message);
        else ctx.warn(message);
    }
}

export { ladrillos };
