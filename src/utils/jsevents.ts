/**
 * List of inline event handler attributes to transform
 */
export const EVENT_ATTRIBUTES = [
  'onclick', 'ondblclick', 'onmousedown', 'onmouseup', 'onmouseover',
  'onmouseout', 'onmousemove', 'onmouseenter', 'onmouseleave',
  'onkeydown', 'onkeyup', 'onkeypress',
  'onfocus', 'onblur', 'onchange', 'oninput', 'onsubmit', 'onreset',
  'onscroll', 'onload', 'onerror',
  'ontouchstart', 'ontouchmove', 'ontouchend', 'ontouchcancel',
  'ondragstart', 'ondrag', 'ondragend', 'ondragenter', 'ondragleave',
  'ondragover', 'ondrop'
];

/**
 * Set form for O(1) membership checks on hot paths (per-attribute checks
 * while rendering loop rows).
 */
export const EVENT_ATTRIBUTE_SET = new Set(EVENT_ATTRIBUTES);
