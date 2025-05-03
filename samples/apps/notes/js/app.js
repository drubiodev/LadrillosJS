import { addNote, notesStore } from "../stores/notesStore.js";

export default function () {
  this.save = () => {
    const { title, note } = this.state;
    addNote({ title, note });
    this.setState({ title: "", note: "" });
  };
}
