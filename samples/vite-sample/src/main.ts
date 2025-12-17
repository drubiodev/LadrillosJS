import "./style.css";
import viteLogo from "/vite.svg";
import { registerComponent } from "ladrillosjs";

registerComponent("my-component", "../components/counter.html",false);

  const lSrc = "https://raw.githubusercontent.com/drubiodev/LadrillosJS/refs/heads/main/LadrillosJS.jpg"

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div>
    <a href="https://vite.dev" target="_blank">
      <img src="${viteLogo}" class="logo" alt="Vite logo" />
    </a>
    <a href="https://drubiodev.github.io/ladrillosjs-site/" target="_blank">
      <img src="${lSrc}" class="logo vanilla" alt="TypeScript logo" />
    </a>
    <h1>Vite + LadrillosJS</h1>
    <div class="card">
      <my-component count="0"></my-component>
    </div>
    <p class="read-the-docs">
      Click on the Vite and LadrillosJS logos to learn more
    </p>
  </div>
`;
