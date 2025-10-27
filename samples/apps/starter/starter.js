import { randomNumber } from "./test.js";

let count = randomNumber();

const setCount = $reactive("count", count);

export const updateCount = (newCount) => {
  console.log("Updating count to:", newCount);
  setCount(newCount);
};
