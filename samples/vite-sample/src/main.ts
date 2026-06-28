import { registerComponent } from "ladrillosjs";

registerComponent("my-button", "../components/button.html");

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div style="display:flex; flex-direction:column; gap:1.5rem; padding:2rem; font-family:system-ui;">
    <section>
      <h3>Variants</h3>
      <div style="display:flex; gap:0.75rem; align-items:center;">
        <my-button label="Primary" variant="primary"></my-button>
        <my-button label="Secondary"></my-button>
        <my-button label="Ghost" variant="ghost"></my-button>
        <my-button label="Destructive" variant="destructive"></my-button>
      </div>
    </section>

    <section>
      <h3>Sizes</h3>
      <div style="display:flex; gap:0.75rem; align-items:center;">
        <my-button label="Small" variant="primary" size="sm"></my-button>
        <my-button label="Medium" variant="primary" size="md"></my-button>
        <my-button label="Large" variant="primary" size="lg"></my-button>
      </div>
    </section>

    <section>
      <h3>States</h3>
      <div style="display:flex; gap:0.75rem; align-items:center;">
        <my-button label="Disabled" variant="primary" is-disabled></my-button>
        <my-button label="Loading" variant="primary" is-loading></my-button>
        <my-button label="Loading (interruptible)" variant="secondary" is-loading is-interruptible></my-button>
      </div>
    </section>

    <section>
      <h3>Icons &amp; slots</h3>
      <div style="display:flex; gap:0.75rem; align-items:center;">
        <my-button label="Save" variant="primary"><span slot="icon">💾</span></my-button>
        <my-button label="Next" variant="secondary"><span slot="end">→</span></my-button>
        <my-button label="Settings" variant="ghost" is-icon-only><span slot="icon">⚙️</span></my-button>
      </div>
    </section>

    <section>
      <h3>Tooltip, form attrs &amp; click</h3>
      <div style="display:flex; gap:0.75rem; align-items:center;">
        <my-button label="Hover me" variant="secondary" tooltip="I am a tooltip"></my-button>
        <my-button id="counter-btn" label="Clicked 0" variant="primary"></my-button>
        <my-button label="Submit" variant="primary" type="submit" name="action" value="save"></my-button>
      </div>
    </section>
  </div>
`;

// onClick / clickAction works through native event bubbling from the shadow button.
let clicks = 0;
document.getElementById("counter-btn")?.addEventListener("click", (e) =>
{
      clicks++;
      (e.currentTarget as HTMLElement).setAttribute("label", `Clicked ${clicks}`);
});
