let title = "Clicked"; // changed const → let
let count = 0; // changed const → let

function updateName() {
  title = this.value;
}
const p = this.querySelector("p");
// replace arrow fn with a named function
const increaseCount = () => {
  this.setState({ count: this.state.count + 1 });

  if (this.state.count >= 10) {
    p.textContent = "too many clicks";
  }
};

setTimeout(() => {
  console.log(this.state);
}, 1000);
