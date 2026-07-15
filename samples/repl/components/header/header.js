import { EVENTS } from "../../common/events.js";
import { EXAMPLE_NAMES } from "../../common/examples.js";

let names = EXAMPLE_NAMES;
let selected = EXAMPLE_NAMES[0];

// Read the value straight off the event: relying on `selected` here races
// the $bind sync and emits the previously-selected example.
function onExampleChange()
{
    $emit(EVENTS.EXAMPLE_SELECT, selected);
}

function run()
{
    $emit(EVENTS.RUN);
}
