import { addNote, notesStore } from "../stores/notesStore.js";

export default function () {
  const save = () => {
    const { title, note } = this.state;
    addNote({ title, note });
    this.setState({ title: "", note: "" });
  };

  this.setState({ save });
}
