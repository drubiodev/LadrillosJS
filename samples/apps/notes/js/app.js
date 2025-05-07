import { addNote, notesStore } from "../stores/notesStore.js";

export default function () {
  this.save = () => {
    const { myNote } = this.state;
    const id = Math.floor(Math.random() * 1000);
    myNote.id = id;
    addNote(myNote);
    this.setState({ myNote: {} });
  };

  this.listen("loadNote", (id) => {
    notesStore.getState().notes.forEach((note) => {
      if (note.id === id) {
        this.setState({ myNote: note });
      }
    });
  });
}
