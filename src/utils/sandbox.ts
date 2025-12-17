/**
 * Blocked globals to prevent access to dangerous browser APIs
 * These will be shadowed with undefined in expression evaluation
 * NOTE: Excludes reserved words that can't be used as parameter names
 */
export const BLOCKED_GLOBALS = Object.freeze([
  // Global objects
  'window', 'document', 'globalThis', 'self', 'top', 'parent', 'frames',
  
  // Code execution
  'eval', 'Function', 'GeneratorFunction', 'AsyncFunction', 'AsyncGeneratorFunction',
  
  // Network
  'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'Request', 'Response',
  
  // Storage
  'localStorage', 'sessionStorage', 'indexedDB', 'caches',
  
  // Workers
  'Worker', 'SharedWorker', 'ServiceWorker',
  
  // Navigation & Location
  'navigator', 'location', 'history',
  
  // Dialogs & Windows
  'alert', 'confirm', 'prompt', 'open', 'close', 'print',
  
  // Messaging
  'postMessage', 'BroadcastChannel', 'MessageChannel',
  
  // Timers
  'setTimeout', 'setInterval', 'setImmediate', 'requestAnimationFrame', 
  'requestIdleCallback', 'queueMicrotask',
  
  // Prototype manipulation
  '__proto__',
  
  // Other dangerous APIs
  'Proxy', 'Reflect',
  
  // Crypto
  'crypto',
  
  // DOM manipulation
  'Element', 'Node', 'HTMLElement', 'DocumentFragment',
  'MutationObserver', 'IntersectionObserver', 'ResizeObserver',
  
  // Cookies
  'cookieStore',
]);

// Reserved words and keywords that cannot be used as parameter names
// These are blocked via strict mode instead
export const RESERVED_WORDS = new Set([
  'with', 'eval', 'arguments', 'constructor', 'prototype',
  'break', 'case', 'catch', 'continue', 'debugger', 'default',
  'delete', 'do', 'else', 'finally', 'for', 'function', 'if',
  'in', 'instanceof', 'new', 'return', 'switch', 'this', 'throw',
  'try', 'typeof', 'var', 'void', 'while', 'class', 'const',
  'enum', 'export', 'extends', 'import', 'super', 'implements',
  'interface', 'let', 'package', 'private', 'protected', 'public',
  'static', 'yield', 'null', 'true', 'false'
]);