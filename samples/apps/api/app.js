import { registerComponent } from "../../../src/index.js";
registerComponent("card-component", "card.html");

const url = "https://api.sampleapis.com/beers/ale";

document.head.insertAdjacentHTML(
  "beforeend",
  '<link rel="preconnect" href="https://api.sampleapis.com" crossorigin>'
);

async function callAPI() {
  const response = await fetch(url);

  const data = await response.json();

  var test = data.filter((d) => d.rating?.average > 4.4);
  return test;
}

export default function () {
  this.setState({ beers: "loading..." });
  callAPI().then((beers) => {
    const cardsHtml = beers
      .map(
        (item) =>
          `<card-component item='${JSON.stringify(item)}'></card-component>`
      )
      .join("");

    this.setState({ beers: cardsHtml });
  });
}
