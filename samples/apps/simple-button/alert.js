let title = "Clicked";
let count = 0;

function updateName() {
  const title = this.querySelector("input").value;
  console.log(title);
  this.setState({ title });
}

this.p = this.querySelector("p");
// replace arrow fn with a named function
const increaseCount = () => {
  this.setState({ count: this.state.count + 1 });

  if (this.state.count >= 10) {
    this.p.textContent = "too many clicks";
  }
};

const increaseCount2 = () => {
  console.log(this);
  this.setState({ count: this.state.count + 1 });

  if (this.state.count >= 10) {
    this.p.textContent = "too many clicks";
  }
};

setTimeout(() => {
  console.log(this.state);
}, 1000);
