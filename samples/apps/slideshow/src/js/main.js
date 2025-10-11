import { registerComponent, registerComponents } from "ladrillosjs";

// Register shared components
registerComponents([
  { name: "code-block", path: "src/components/codeblock.html" },
  { name: "l-button-count", path: "src/components/button-count.html" },
]);

// Register main slideshow component
registerComponent("slide-show", "src/components/slide-show.html");
