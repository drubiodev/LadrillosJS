import { registerComponent } from "../../../src/index.js";
registerComponent("card-component", "card.html");

const url = "https://api.sampleapis.com/beers/ale";

async function callAPI() {
  const response = await fetch(url);

  const data = await response.json();

  var test = data.filter((d) => d.rating?.average > 4.4);
  return test;
}

export default function () {
  this.setState({ beers: "loading..." });
  callAPI().then((beers) => {
    const ul = document.createElement("ul");
    ul.classList.add("phone-list");

    beers.forEach((item) => {
      const card = document.createElement("card-component");
      // assign the raw JS object to a property
      card.setAttribute("item", JSON.stringify(item));
      ul.appendChild(card);
    });

    this.setState({ beers: ul.outerHTML });
  });
}
