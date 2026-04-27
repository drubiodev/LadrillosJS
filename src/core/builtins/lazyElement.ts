/**
 * <lazy> built-in element handler.
 *
 * Two modes:
 *   1. Inline content: <lazy margin="100px"><heavy /></lazy>
 *      Children are detached and re-inserted when the strategy fires.
 *   2. Component source: <lazy src="./chart.html" component="my-chart" idle></lazy>
 *      Registers the component lazily and replaces the placeholder with it.
 *
 * Strategy props (resolved in priority order):
 *   eager > interaction > media > delay > idle/idle-timeout > visible/margin/threshold
 *
 * A nested <template slot="placeholder"> can supply hold-while-loading content.
 *
 * Performance notes:
 *   - Children are moved to a detached DocumentFragment in one DOM op.
 *   - Strategy listeners only attach when the element is connected to the DOM.
 *   - Each <lazy> uses exactly one comment placeholder; no per-iteration cost.
 */

import {
    LazyStrategy,
    lazyOnVisible,
    lazyOnIdle,
    lazyOnDelay,
    lazyOnInteraction,
    lazyOnMedia,
    defaultLazyStrategy,
} from "../lazy/lazyStrategies";
import { warn } from "../../utils/devWarnings";

/**
 * Lazily import the framework's component registrar to avoid a circular
 * dependency: directiveProcessor → builtins/lazyElement → ladrillos →
 * component/webcomponent → directiveProcessor.
 */
async function registerComponentLazily(
    name: string,
    path: string,
): Promise<void> {
    const mod = await import("../ladrillos");
    return mod.ladrillos.registerComponent(name, path, true, false);
}

/**
 * Pick a LazyStrategy from the attributes on a <lazy> element.
 * Returns `null` for `eager` (= load immediately, no observation needed).
 */
export function resolveLazyStrategy(el: Element): LazyStrategy | null {
    if (el.hasAttribute("eager")) return null;

    // 1. interaction
    if (el.hasAttribute("interaction")) {
        const raw = (el.getAttribute("interaction") || "").trim();
        if (!raw) return lazyOnInteraction();
        const events = raw
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        // Cast: lazyOnInteraction's typed signature collapses to `string & string[]`
        // due to distributive conditional types. Both `string` and `string[]` are
        // valid runtime arguments per the implementation.
        const li = lazyOnInteraction as unknown as (
            events?: string | string[],
        ) => LazyStrategy;
        if (events.length === 1) return li(events[0]);
        return li(events);
    }

    // 2. media
    if (el.hasAttribute("media")) {
        const q = el.getAttribute("media") || "";
        return lazyOnMedia(q);
    }

    // 3. delay
    if (el.hasAttribute("delay")) {
        const ms = Number(el.getAttribute("delay")) || 0;
        return lazyOnDelay(ms);
    }

    // 4. idle / idle-timeout
    if (el.hasAttribute("idle") || el.hasAttribute("idle-timeout")) {
        const t = el.getAttribute("idle-timeout");
        return t ? lazyOnIdle(Number(t) || 10000) : lazyOnIdle();
    }

    // 5. visible / margin / threshold (default)
    const opts: IntersectionObserverInit = {};
    const margin = el.getAttribute("margin");
    if (margin) opts.rootMargin = margin;
    const threshold = el.getAttribute("threshold");
    if (threshold !== null) {
        const n = Number(threshold);
        if (!Number.isNaN(n)) opts.threshold = n;
    }
    if (Object.keys(opts).length > 0) return lazyOnVisible(opts);
    // Plain <lazy> with nothing → default visible strategy.
    return defaultLazyStrategy;
}

/**
 * Convert a path like "./components/heavy-chart.html" → "heavy-chart".
 */
function tagFromPath(path: string): string {
    const file =
        path
            .split(/[?#]/)[0]
            .split("/")
            .pop()
            ?.replace(/\.[^.]+$/, "") || path;
    return file
        .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
        .replace(/[_\s]+/g, "-")
        .toLowerCase();
}

/** Pull a `<template slot="placeholder">` out of `<lazy>` if present. */
function extractPlaceholder(lazyEl: Element): DocumentFragment | null {
    const tpl = lazyEl.querySelector(
        ':scope > template[slot="placeholder"]',
    ) as HTMLTemplateElement | null;
    if (!tpl) return null;
    tpl.remove();
    return tpl.content.cloneNode(true) as DocumentFragment;
}

/**
 * Process a single <lazy> element. Removes it from the DOM and replaces it
 * with a comment placeholder + (optional) placeholder content. Schedules the
 * actual content to swap in when the chosen strategy fires.
 */
export function processLazyElement(lazyEl: Element): void {
    const parent = lazyEl.parentNode;
    if (!parent) return;

    const strategy = resolveLazyStrategy(lazyEl);
    const src = lazyEl.getAttribute("src");
    const componentAttr = lazyEl.getAttribute("component");

    // Carry over attributes to the loaded element (excluding strategy props).
    const STRATEGY_ATTRS = new Set([
        "eager",
        "visible",
        "margin",
        "threshold",
        "idle",
        "idle-timeout",
        "delay",
        "interaction",
        "media",
        "src",
        "component",
    ]);

    // Anchor for re-insertion. Using a Comment lets us insert in O(1).
    const anchor = document.createComment(
        src ? ` <lazy src="${src}"> ` : ` <lazy> `,
    );
    parent.insertBefore(anchor, lazyEl);
    lazyEl.remove();

    // -------------------------------------------------------------------------
    // MODE A: src — register a component lazily and swap to <tag-name>
    // -------------------------------------------------------------------------
    if (src) {
        const tagName = (componentAttr || tagFromPath(src)).trim();
        if (!tagName.includes("-")) {
            warn(
                `<lazy src="${src}">: derived tag name "${tagName}" must contain a hyphen. ` +
                `Provide a 'component' attribute, e.g. <lazy src="${src}" component="my-thing">.`,
            );
            return;
        }

        const placeholder = extractPlaceholder(lazyEl);

        const swap = () => {
            const real = document.createElement(tagName);
            // Forward non-strategy attributes onto the loaded element.
            for (const attr of Array.from(lazyEl.attributes)) {
                if (!STRATEGY_ATTRS.has(attr.name)) {
                    real.setAttribute(attr.name, attr.value);
                }
            }
            anchor.parentNode?.replaceChild(real, anchor);
            // Anything we showed as placeholder is removed automatically because
            // we hold it in a fragment that's attached only between anchor and...
            // (see below: we track the placeholder nodes explicitly).
        };

        // Render placeholder content (if any) between anchor and a sentinel.
        let placeholderEnd: Comment | null = null;
        if (placeholder) {
            placeholderEnd = document.createComment(" /lazy-placeholder ");
            anchor.parentNode?.insertBefore(placeholderEnd, anchor.nextSibling);
            anchor.parentNode?.insertBefore(placeholder, placeholderEnd);
        }

        const trigger = async () => {
            try {
                // Register if not already registered (idempotent at app level).
                if (!customElements.get(tagName)) {
                    await registerComponentLazily(tagName, src);
                }
                // Remove placeholder nodes between anchor and placeholderEnd.
                if (placeholderEnd) {
                    let n = anchor.nextSibling;
                    while (n && n !== placeholderEnd) {
                        const next = n.nextSibling;
                        n.parentNode?.removeChild(n);
                        n = next;
                    }
                    placeholderEnd.parentNode?.removeChild(placeholderEnd);
                }
                swap();
            } catch (e) {
                warn(
                    `<lazy src="${src}"> failed to load: ${(e as Error).message}`,
                );
            }
        };

        if (!strategy) {
            // eager
            void trigger();
            return;
        }

        // Use anchor (a Comment) as the observable target — but observers need an
        // Element. Insert a zero-size sentinel <span style="display:contents">
        // for IntersectionObserver / interaction listeners to attach to.
        const sentinel = document.createElement("span");
        sentinel.setAttribute("data-lazy-sentinel", "");
        sentinel.style.display = "contents";
        anchor.parentNode?.insertBefore(sentinel, anchor.nextSibling);

        let teardown: (() => void) | void;
        const fire = () => {
            teardown?.();
            sentinel.remove();
            void trigger();
        };
        teardown = strategy(fire, sentinel);
        return;
    }

    // -------------------------------------------------------------------------
    // MODE B: inline content — show children when strategy fires
    // -------------------------------------------------------------------------
    const placeholder = extractPlaceholder(lazyEl);

    // Detach inline children into a fragment in one shot.
    const content = document.createDocumentFragment();
    while (lazyEl.firstChild) content.appendChild(lazyEl.firstChild);

    // Insert placeholder content between anchor and end-sentinel so we can
    // remove it cleanly when content swaps in.
    const end = document.createComment(" /lazy ");
    anchor.parentNode?.insertBefore(end, anchor.nextSibling);
    if (placeholder) {
        anchor.parentNode?.insertBefore(placeholder, end);
    }

    const reveal = () => {
        // Remove placeholder content (everything between anchor and end).
        let n = anchor.nextSibling;
        while (n && n !== end) {
            const next = n.nextSibling;
            n.parentNode?.removeChild(n);
            n = next;
        }
        // Insert real content in one DOM op.
        end.parentNode?.insertBefore(content, end);
    };

    if (!strategy) {
        reveal();
        return;
    }

    const sentinel = document.createElement("span");
    sentinel.setAttribute("data-lazy-sentinel", "");
    sentinel.style.display = "contents";
    anchor.parentNode?.insertBefore(sentinel, anchor.nextSibling);

    let teardown: (() => void) | void;
    const fire = () => {
        teardown?.();
        sentinel.remove();
        reveal();
    };
    teardown = strategy(fire, sentinel);
}

/**
 * Find and process all top-level <lazy> elements in `host`. <lazy> elements
 * inside <for> templates are skipped; they get processed when the loop
 * renders each iteration via processLazyElement on the cloned content.
 */
export function scanLazyElements(host: HTMLElement | ShadowRoot): void {
    // Snapshot once — processing mutates the DOM.
    const lazyEls = Array.from(host.querySelectorAll("lazy"));
    for (const el of lazyEls) {
        if (isInsideForElement(el)) continue;
        processLazyElement(el);
    }
}

function isInsideForElement(el: Element): boolean {
    let p: Element | null = el.parentElement;
    while (p) {
        if (p.tagName === "FOR") return true;
        p = p.parentElement;
    }
    return false;
}
