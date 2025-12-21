import { LadrillosComponent } from "../../types";

const parser = new DOMParser();

export async function parseComponent(
  source: string,
  name: string,
  componentUrl?: string
): Promise<LadrillosComponent> {
  const doc = parseHTML(source);

  // get scripts
  const scriptEls = Array.from(doc.querySelectorAll("script"));

  // Collect inline scripts (with content)
  const inlineScripts = scriptEls
    .filter((s) => !s.src)
    .map((s) => {
      const content = (s.textContent ?? "").trim();
      const type = s.getAttribute("type");
      return { content, type };
    })
    .filter((s) => s.content.length > 0);

  // Detect Vite-transformed module scripts (html-proxy)
  // These are inline scripts that Vite extracted to external files
  const viteProxyScripts = scriptEls.filter((s) => {
    const src = s.getAttribute("src") || "";
    return src.includes("html-proxy") && s.getAttribute("type") === "module";
  });

  // Fetch content from Vite proxy scripts
  const fetchedScripts = await Promise.all(
    viteProxyScripts.map(async (s) => {
      const src = s.getAttribute("src") || "";
      try {
        const response = await fetch(src);
        if (response.ok) {
          const content = await response.text();
          return { content: content.trim(), type: "module" };
        }
      } catch (e) {
        // Silently fail - script will be skipped
      }
      return null;
    })
  );

  // Combine inline scripts with fetched Vite proxy scripts
  const scripts = [
    ...inlineScripts,
    ...fetchedScripts.filter(
      (s): s is { content: string; type: string } =>
        s !== null && s.content.length > 0
    ),
  ];

  // Filter out Vite-injected scripts and proxy scripts for external scripts list
  const externalScripts = scriptEls
    .filter((s) => {
      if (!s.src) return false;
      const src = s.getAttribute("src") || "";
      // Skip Vite client and proxy scripts
      if (src.includes("@vite/client")) return false;
      if (src.includes("html-proxy")) return false;
      return true;
    })
    .map((s) => {
      const type = s.getAttribute("type");
      let src = s.src;

      // If the parser keeps a relative src, resolve it against the component URL.
      if (componentUrl) {
        try {
          src = new URL(
            s.getAttribute("src") ?? s.src,
            componentUrl
          ).toString();
        } catch {
          // ignore resolution errors; keep original
        }
      }

      // Check if the script has the 'external' attribute
      // These scripts should be loaded as-is without framework processing
      const external = s.hasAttribute("external");

      return { src, type, external };
    })
    .filter((s) => s.src.length > 0);

  scriptEls.forEach((s) => s.remove());

  // get external stylesheets (<link rel="stylesheet">)
  const linkEls = Array.from(doc.querySelectorAll('link[rel="stylesheet"]'));
  const externalStyles = linkEls
    .map((l) => {
      let href = l.getAttribute("href") || "";
      const rel = l.getAttribute("rel") || "stylesheet";

      // Resolve relative URLs against component URL
      if (componentUrl && href && !href.startsWith("http")) {
        try {
          href = new URL(href, componentUrl).toString();
        } catch {
          // ignore resolution errors; keep original
        }
      }

      return { href, rel };
    })
    .filter((l) => l.href.length > 0);
  linkEls.forEach((l) => l.remove());

  // get styles
  const styleEls = Array.from(doc.querySelectorAll("style"));
  const styles = styleEls
    .map((s) => s.textContent ?? "")
    .join("\n")
    .trim();
  styleEls.forEach((s) => s.remove());

  // Get template content
  // <template> elements have special handling - content is in .content property
  const templateEl = doc.querySelector("template");
  let html: string;

  if (templateEl) {
    // Clone the template content and serialize it
    const tempDiv = document.createElement("div");
    tempDiv.appendChild(templateEl.content.cloneNode(true));
    html = tempDiv.innerHTML.trim();
  } else {
    // Fallback to body innerHTML
    html = doc.body.innerHTML.trim();
  }

  return {
    tagName: name,
    template: html,
    scripts,
    externalScripts,
    externalStyles,
    styles: styles,
    sourcePath: componentUrl,
    lazy: false,
  };
}

function parseHTML(source: string): Document {
  return parser.parseFromString(source, "text/html");
}
