import { RegexPatterns } from "../types/LadrilloTypes";

export const REGEX_PATTERNS: RegexPatterns = {
  comments: {
    js: /\/\*[\s\S]*?\*\/|\/\/.*$/gm,
    css: /\/\*[\s\S]*?\*\//g,
    html: /<!--[\s\S]*?-->/g,
  },
};
