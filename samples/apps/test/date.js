import { formatDate, formatTime } from "./setDates.js";

export default function () {
  const now = new Date();
  this.setState({
    formattedDate: formatDate(now),
    formattedTime: formatTime(now),
  });
  console.log(this.state);
}
