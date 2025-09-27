import { RegexPatterns } from "../types/LadrilloTypes";

export const REGEX_PATTERNS: RegexPatterns = {
  bindings: /{([^}]+)}/g,
  comments: {
    js: /\/\*[\s\S]*?\*\/|\/\/.*$/gm,
    css: /\/\*[\s\S]*?\*\//g,
    html: /<!--[\s\S]*?-->/g,
  },
};
