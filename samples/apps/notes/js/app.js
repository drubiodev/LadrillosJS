this.setState({ notes: [] });

const save = () => {
  const { title, note } = this.state;

  this.setState({
    notes: [...this.state.notes, { title, note }],
  });

  this.setState({ title: "", note: "" });
  this.emit("noteAdded", { notes: this.state.notes });
};
