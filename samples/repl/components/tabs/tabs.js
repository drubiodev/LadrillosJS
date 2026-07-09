import { EVENTS } from "../../common/events.js";

// Mirror of the editor's file list — kept in sync over the event bus.
// The editor owns the data; the tab strip only reports user intent.
let tabs = [];
let activeIndex = 0;

$listen(EVENTS.FILES_CHANGED, (data) => {
    tabs = data.tabs;
    activeIndex = data.activeIndex;
});

function select(i) {
    $emit(EVENTS.TAB_SELECT, i);
}

function closeFile(i) {
    $emit(EVENTS.TAB_CLOSE, i);
}

function rename(i) {
    $emit(EVENTS.TAB_RENAME, i);
}

function add() {
    $emit(EVENTS.FILE_ADD);
}
