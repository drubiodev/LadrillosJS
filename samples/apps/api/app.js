import { registerComponent } from "../../../src/index.js";
registerComponent("card-component", "card.html");

const url = "https://api.restful-api.dev/objects";

async function callAPI() {
  const response = await fetch(url);

  const data = await response.json();

  var test = data.filter((d) => d.data?.price > 120);
  return test;
}

export default function () {
  callAPI().then((tech) => {
    console.log(tech);

    const ul = document.createElement("ul");
    ul.classList.add("phone-list");

    tech.forEach((item) => {
      const card = document.createElement("card-component");
      // assign the raw JS object to a property
      card.setAttribute("item", JSON.stringify(item));
      ul.appendChild(card);
    });

    this.setState({ phones: ul.outerHTML });
  });
}
