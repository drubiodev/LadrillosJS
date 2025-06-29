import { RegexPatterns } from "../types/LadrilloTypes";

export const REGEX_PATTERNS: RegexPatterns = {
  binding: /{([^}]+)}/g,
  eventHandler: /^on[a-z]+/i,
  functionCall: /^([a-zA-Z_$][0-9a-zA-Z_$]*)\s*\((.*)\)$/,
  arrowFunction: /^\([^)]*\)\s*=>/,
  inlineFunction: /\([^)]*\)\s*=>\s*([^;]+)/,
  htmlTags: /<[a-z][\s\S]*>/i,
  comments: {
    js: /\/\*[\s\S]*?\*\/|\/\/.*$/gm,
    css: /\/\*[\s\S]*?\*\//g,
    html: /<!--[\s\S]*?-->/g,
  },
  declarations: {
    function:
      /\bfunction\s+([a-zA-Z_$][0-9a-zA-Z_$]*)\s*\(([^)]*)\)\s*\{((?:[^{}]|\{(?:[^{}]|\{[^}]*\})*\})*)\}/g,
    arrowFunction:
      /\b(const|let|var)\s+([a-zA-Z_$][0-9a-zA-Z_$]*)\s*=\s*\(([^)]*)\)\s*=>\s*(.+)/g,
    variable: /\b(const|let|var)\s+([a-zA-Z_$][0-9a-zA-Z_$]*)\s*=\s*([^;]+)/g,
  },
};
