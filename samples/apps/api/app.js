import { registerComponent } from "ladrillosjs";
registerComponent("card-component", "card.html");

const url = "https://api.sampleapis.com/beers/ale";

async function callAPI() {
  const response = await fetch(url);
  const data = await response.json();

  // Filter items based on rating and image validity
  const filteredData = await Promise.all(
    data.map(async (item) => {
      return new Promise((resolve) => {
        checkImage(item.image, (isValid) => {
          if (isValid && item.rating?.average > 4.4) {
            resolve(item);
          } else {
            resolve(null); // Exclude invalid items
          }
        });
      });
    })
  );

  // Remove null values from the result
  return filteredData.filter((item) => item !== null);
}

function checkImage(url, callback) {
  const img = new Image();
  img.onload = () => callback(true); // Image loaded successfully
  img.onerror = () => callback(false); // Image failed to load
  img.src = url;
}

export default function () {
  this.setState({ beers: "loading..." });

  callAPI().then((beers) => {
    const cardsHtml = beers
      .map((item) => {
        return `<card-component data-item="${this.stringify(
          item
        )}"></card-component>`;
      })
      .join("");

    this.setState({ beers: cardsHtml });
  });
}
