import { createStore } from "ladrillosjs";

export const notesStore = createStore({ notes: [] });

// helper to add a note
export function addNote(n) {
  const { notes } = notesStore.getState();
  notesStore.setState({ notes: [...notes, n] });
}
