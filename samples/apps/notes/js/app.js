import { addNote, notesStore } from "../stores/notesStore.js";

export default function () {
  this.save = () => {
    const { title, note } = this.state;
    const id = Math.floor(Math.random() * 1000);
    addNote({ id, title, note });
    this.setState({ title: "", note: "" });
  };

  this.listen("loadNote", (id) => {
    notesStore.getState().notes.forEach((note) => {
      if (note.id === id) {
        this.setState({ title: note.title, note: note.note });
      }
    });
  });
}
