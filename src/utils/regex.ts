type RegexPatterns = {
  bindings: RegExp;
};

export const REGEX_PATTERNS: RegexPatterns = {
  bindings: /{([^}]+)}/g,
};
