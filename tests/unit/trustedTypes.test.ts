import { describe, it, expect, afterEach } from "vitest";
import { configure } from "../../src/core/configure";
import { resetTrustedTypesPolicy } from "../../src/core/html/trustedTypes";
import { createWebComponentClass } from "../../src/core/component/webcomponent";
import { parseComponent } from "../../src/core/component/extract";

/**
 * happy-dom implements no Trusted Types, which is also the state of any
 * browser without it — so the pass-through path is what the other 281 tests
 * already cover. These install a fake factory to exercise the enforced path.
 */

let tag = 0;
const nextTag = (): string => `tt-${++tag}`;

interface FakeFactory
{
    names: string[];
    inputs: string[];
}

function installFakeTrustedTypes(
    createHTML: (input: string) => string = (input) => input,
    onCreatePolicy?: () => void,
): FakeFactory
{
    const record: FakeFactory = { names: [], inputs: [] };

    (globalThis as Record<string, unknown>).trustedTypes = {
        createPolicy(name: string, rules: { createHTML: (i: string) => string })
        {
            record.names.push(name);
            onCreatePolicy?.();
            return {
                createHTML: (input: string) =>
                {
                    record.inputs.push(input);
                    return createHTML(rules.createHTML(input));
                },
            };
        },
    };

    return record;
}

async function mount(source: string): Promise<HTMLElement>
{
    const tagName = nextTag();
    const component = await parseComponent(source, tagName);
    customElements.define(tagName, createWebComponentClass(component, true));
    const el = document.createElement(tagName);
    document.body.appendChild(el);
    await new Promise((resolve) => setTimeout(resolve, 30));
    return el;
}

const SOURCE = `<p id="out">hi</p><script>let x = 1;</script>`;

describe("trusted types", () =>
{
    afterEach(() =>
    {
        delete (globalThis as Record<string, unknown>).trustedTypes;
        resetTrustedTypesPolicy();
        configure({ trustedTypesPolicy: null });
    });

    it("creates one policy, named so it can be CSP-allowlisted", async () =>
    {
        const factory = installFakeTrustedTypes();

        await mount(SOURCE);
        await mount(SOURCE);

        expect(factory.names).toEqual(["ladrillosjs"]);
    });

    it("routes both HTML sinks through the policy", async () =>
    {
        const factory = installFakeTrustedTypes();

        await mount(SOURCE);

        // Once for DOMParser.parseFromString (whole component source, script
        // included) and once for the template innerHTML (markup only).
        expect(factory.inputs.some((i) => i.includes("<script>"))).toBe(true);
        expect(factory.inputs.some((i) => !i.includes("<script>"))).toBe(true);
    });

    it("renders what the policy returns, not what it was given", async () =>
    {
        installFakeTrustedTypes((html) => html.replace("hi", "sanitized"));

        const el = await mount(SOURCE);

        expect(el.shadowRoot!.getElementById("out")!.textContent).toBe("sanitized");
    });

    it("prefers a policy supplied through configure()", async () =>
    {
        const factory = installFakeTrustedTypes();
        configure({
            trustedTypesPolicy: {
                createHTML: (input: string) => input.replace("hi", "from-app"),
            },
        });

        const el = await mount(SOURCE);

        expect(factory.names).toEqual([]);
        expect(el.shadowRoot!.getElementById("out")!.textContent).toBe("from-app");
    });

    it("still renders when the policy name is rejected by CSP", async () =>
    {
        installFakeTrustedTypes(undefined, () =>
        {
            throw new TypeError("Policy \"ladrillosjs\" disallowed.");
        });

        const el = await mount(SOURCE);

        expect(el.shadowRoot!.getElementById("out")!.textContent).toBe("hi");
    });
});
