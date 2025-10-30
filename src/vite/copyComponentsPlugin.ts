import { Plugin } from "vite";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";

export interface CopyComponentsOptions {
  /**
   * Source directory containing components to copy
   * @default 'components'
   */
  src?: string;
  /**
   * Destination directory in the dist folder
   * @default 'components'
   */
  dest?: string;
  /**
   * Whether to copy during development
   * @default false
   */
  copyOnDev?: boolean;
  /**
   * Whether to process component module scripts
   * @default true
   */
  processScripts?: boolean;
}

/**
 * Process component HTML files to transform module scripts
 */
async function processComponentScripts(dir: string): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const filePath = path.resolve(dir, entry.name);

    if (entry.isDirectory()) {
      await processComponentScripts(filePath);
    } else if (entry.name.endsWith(".html")) {
      let content = await fs.readFile(filePath, "utf-8");

      // Transform module scripts to work with window scope
      content = content.replace(
        /<script type="module">([\s\S]*?)<\/script>/g,
        (match, scriptContent) => {
          // Transform bare module specifiers to window references
          let transformedCode = scriptContent
            .replace(
              /import\s+\*\s+as\s+(\w+)\s+from\s+["']ladrillosjs["']/g,
              "const $1 = window.ladrillosjs;"
            )
            .replace(
              /import\s+\{\s*([^}]+)\s*\}\s+from\s+["']ladrillosjs["']/g,
              "const { $1 } = window.ladrillosjs;"
            )
            .replace(
              /import\s+(\w+)\s+from\s+["']ladrillosjs["']/g,
              "const $1 = window.ladrillosjs.default;"
            );

          // Create a wrapper that uses a shared promise for library loading
          return `<script>
(async () => {
  try {
    // Use a shared promise to avoid multiple components polling independently
    if (!window.__ladrillosPromise__) {
      if (window.ladrillosjs) {
        // Library already loaded, resolve immediately
        window.__ladrillosPromise__ = Promise.resolve(window.ladrillosjs);
      } else {
        // Set up a one-time promise that waits for library to load
        window.__ladrillosPromise__ = new Promise((resolve) => {
          // Quick check first
          if (window.ladrillosjs) {
            resolve(window.ladrillosjs);
            return;
          }
          
          // Use a short timeout (libraries load almost instantly)
          const timeout = setTimeout(() => {
            if (!window.ladrillosjs) {
              throw new Error('LadrillosJS failed to load');
            }
            clearInterval(interval);
            resolve(window.ladrillosjs);
          }, 100);
          
          // Fallback polling as safety net
          const interval = setInterval(() => {
            if (window.ladrillosjs) {
              clearTimeout(timeout);
              clearInterval(interval);
              resolve(window.ladrillosjs);
            }
          }, 5);
        });
      }
    }
    
    // Wait for the shared promise
    await window.__ladrillosPromise__;
    
    // Execute the component script
    (async () => {
${transformedCode}
    })();
  } catch (error) {
    console.error('Failed to execute component module:', error);
  }
})();
</script>`;
        }
      );

      await fs.writeFile(filePath, content);
    }
  }
}

/**
 * Vite plugin for copying component files to the dist folder during build
 *
 * @example
 * ```typescript
 * import { defineConfig } from 'vite';
 * import { copyComponentsPlugin } from 'ladrillosjs/vite';
 *
 * export default defineConfig({
 *   plugins: [
 *     copyComponentsPlugin({
 *       src: 'components',
 *       dest: 'components',
 *       copyOnDev: false,
 *       processScripts: true
 *     })
 *   ]
 * });
 * ```
 */
export function copyComponentsPlugin(
  options: CopyComponentsOptions = {}
): Plugin {
  const {
    src = "components",
    dest = "components",
    copyOnDev = false,
    processScripts = true,
  } = options;

  return {
    name: "ladrillosjs:copy-components",
    apply: copyOnDev ? "serve" : "build",

    async generateBundle(_options, bundle) {
      const srcDir = path.resolve(process.cwd(), src);
      const distDestDir = path.resolve(process.cwd(), "dist", dest);

      // Only proceed if source directory exists
      if (!fsSync.existsSync(srcDir)) {
        console.warn(
          `[ladrillosjs:copy-components] Source directory not found: ${srcDir}`
        );
        return;
      }

      try {
        // Remove existing destination directory if it exists
        if (fsSync.existsSync(distDestDir)) {
          fsSync.rmSync(distDestDir, { recursive: true, force: true });
        }

        // Copy components folder to dist
        fsSync.cpSync(srcDir, distDestDir, { recursive: true });
        console.log(
          `[ladrillosjs:copy-components] Copied components from ${srcDir} to ${distDestDir}`
        );

        // Process component scripts if enabled
        if (processScripts) {
          await processComponentScripts(distDestDir);
          console.log(
            `[ladrillosjs:copy-components] Processed component scripts in ${distDestDir}`
          );
        }
      } catch (error) {
        console.error(
          `[ladrillosjs:copy-components] Error copying components:`,
          error
        );
        throw error;
      }
    },
  };
}

export default copyComponentsPlugin;
