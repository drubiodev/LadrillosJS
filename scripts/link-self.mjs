/**
 * Links the repo into its own node_modules as "ladrillosjs".
 *
 * The Vite plugin resolves the framework the way a consumer does — `import
 * ("ladrillosjs/compiler")` through Node — so the packages and samples in this
 * repo need that specifier to point at the built dist. npm workspaces link
 * workspace packages to each other but not the root package, hence this.
 */
import { symlinkSync, mkdirSync, existsSync, lstatSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const link = resolve(root, "node_modules", "ladrillosjs");

mkdirSync(dirname(link), { recursive: true });

if (existsSync(link) || lstatSync(link, { throwIfNoEntry: false }))
{
    unlinkSync(link);
}

symlinkSync(root, link, "dir");
console.log("linked ladrillosjs -> .");
