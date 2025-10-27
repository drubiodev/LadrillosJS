import { randomNumber } from "./test.js";

let count = randomNumber();

export const updateCount = (newCount) => {
  console.log("Updating count to:", newCount);
  count = newCount;
};
