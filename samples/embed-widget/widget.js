/**
 * The entire third-party install surface.
 *
 * A host page adds one line:
 *   <script type="module" src="https://your.cdn/widget.js"></script>
 * and then uses <quote-builder> anywhere in its markup.
 */

// In production point this at a pinned release:
//   https://cdn.jsdelivr.net/npm/ladrillosjs@2.1.0/dist/index.js
// The sample uses the local build so it runs straight from the repo.
import { configure, registerComponents } from "/dist/index.js";

configure({
    onError: (error) => console.error("[quote-widget]", error.message),
});

await registerComponents({
    "quote-builder": "./components/quote-builder.html",
});
