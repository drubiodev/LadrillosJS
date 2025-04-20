const title = "Clicked";
const count = 0;

const p = this.querySelector("p");

function updateName() {
  title = this.value;
}

const increaseCount = () => {
  count++;

  if (count >= 10) {
    p.textContent = "to many clicks";
  }
};
