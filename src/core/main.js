export class Ladrillos {
  constructor() {
    this.components = {};
  }

  async registerComponent(name, path, useShadowDOM = true) {
    try {
      const component = await fetch(path).then((res) => res.text());

      // Parse the template, script and style
      const templateMatch = component.match(/<template>([\s\S]*?)<\/template>/);
      const scriptMatch = component.match(/<script>([\s\S]*?)<\/script>/);
      const styleMatch = component.match(/<style>([\s\S]*?)<\/style>/);

      if (!templateMatch) {
        console.error(`No template found in component: ${name}`);
        return;
      }
      const templateContent = templateMatch[1].trim();
      let scriptContent = scriptMatch ? scriptMatch[1].trim() : "";
      let styleContent = styleMatch ? styleMatch[1].trim() : "";

      this.components[name] = {
        template: templateContent,
        script: scriptContent,
        style: styleContent,
      };

      console.log(`Component ${name} registered successfully`);
    } catch (error) {
      console.error(`Failed to register component ${name}:`, error);
    }
  }
}
