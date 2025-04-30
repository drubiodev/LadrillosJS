const save = () => {
  const { title, note } = this.state;
  console.log("Saving note:", title, note);

  this.setState({ title: "", note: "" });
};
