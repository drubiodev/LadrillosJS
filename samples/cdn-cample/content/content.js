import { suggestions } from "./data.js";

const suggestionItems = suggestions;
const messages = __wrapReactiveArray([], __ladrillos_componentId);

function scrollToBottom() {
  requestAnimationFrame(() => {
    const messagesContainer = $refs.get("messagesContainer");
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  });
}

$listen("message:send", (event) => {
  messages.push({
    text: event.text,
    type: "user",
    sender: "Daniel",
    timestamp: new Date().toLocaleTimeString(),
  });

  scrollToBottom();

  setTimeout(() => {
    const botResponse = generateBotResponse(event.text);
    messages.push({
      text: botResponse,
      type: "bot",
      sender: "Co-Driver",
      timestamp: new Date().toLocaleTimeString(),
    });

    scrollToBottom();
  }, 2000);
});

function generateBotResponse(userMessage) {
  return `Co-Driver says: I received your message - "${userMessage}"`;
}
