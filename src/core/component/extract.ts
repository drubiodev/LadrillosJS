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
  const scripts = scriptEls
    .filter((s) => !s.src)
    .map((s) => {
      const content = (s.textContent ?? "").trim();
      const type = s.getAttribute("type");
      return { content, type };
    })
    .filter((s) => s.content.length > 0);

  const externalScripts = scriptEls
    .filter((s) => !!s.src)
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

      return { src, type };
    })
    .filter((s) => s.src.length > 0);

  scriptEls.forEach((s) => s.remove());

  // get styles
  const styleEls = Array.from(doc.querySelectorAll("style"));
  const styles = styleEls
    .map((s) => s.textContent ?? "")
    .join("\n")
    .trim();
  styleEls.forEach((s) => s.remove());

  const html = doc.body.innerHTML.trim();

  return {
    tagName: name,
    template: html,
    scripts,
    externalScripts,
    styles: styles,
    sourcePath: componentUrl,
    lazy: false,
  };
}

function parseHTML(source: string): Document {
  return parser.parseFromString(source, "text/html");
}
