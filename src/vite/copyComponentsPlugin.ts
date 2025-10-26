import { Plugin } from "vite";
import fs from "fs";
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
 *       copyOnDev: false
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
  } = options;

  return {
    name: "ladrillosjs:copy-components",
    apply: copyOnDev ? "serve" : "build",

    async generateBundle(_options, bundle) {
      const srcDir = path.resolve(process.cwd(), src);
      const distDestDir = path.resolve(process.cwd(), "dist", dest);

      // Only proceed if source directory exists
      if (!fs.existsSync(srcDir)) {
        console.warn(
          `[ladrillosjs:copy-components] Source directory not found: ${srcDir}`
        );
        return;
      }

      try {
        // Remove existing destination directory if it exists
        if (fs.existsSync(distDestDir)) {
          fs.rmSync(distDestDir, { recursive: true, force: true });
        }

        // Copy components folder to dist
        fs.cpSync(srcDir, distDestDir, { recursive: true });
        console.log(
          `[ladrillosjs:copy-components] Copied components from ${srcDir} to ${distDestDir}`
        );
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
