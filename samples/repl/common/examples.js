// Starter examples for the playground. Each example is an array of component
// files; the first entry is the mounted "root". The header lists them, the
// editor loads them — both import from here, so examples are easy to add.
export const EXAMPLES = {
    Counter: [
        {
            name: "demo-counter",
            code: `<div class="counter">
  <div class="count">{count}</div>
  <div class="row">
    <button onclick="count--">−</button>
    <button onclick="count = 0">reset</button>
    <button onclick="count++">+</button>
  </div>
  <p>double: {count * 2} · squared: {count * count}</p>
</div>

<script>
  let count = 0;
<\/script>

<style>
  .counter { text-align: center; font-family: system-ui; padding: 2rem; }
  .count { font-size: 4rem; font-weight: 800; color: #ff6b35; }
  .row { display: flex; gap: .5rem; justify-content: center; margin: 1rem 0; }
  button { padding: .5rem 1rem; border-radius: 8px; border: 1px solid #ccc;
           background: #fff; cursor: pointer; font-size: 1rem; }
  button:hover { background: #f0f2f5; }
  p { color: #65676b; }
</style>`,
        },
    ],

    "Todo list": [
        {
            name: "demo-todo",
            code: `<div class="todo">
  <h2>Todo ({items.length})</h2>
  <form $on:submit.prevent="add()">
    <input $bind="draft" placeholder="What needs doing?" />
    <button>Add</button>
  </form>

  <if condition="items.length === 0">
    <p class="empty">Nothing yet — add something above.</p>
  </if>
  <else>
    <ul>
      <for each="item in items" key="item.id">
        <li class="{item.done ? 'done' : ''}">
          <button class="check" onclick="toggle(item.id)">
            {item.done ? '☑' : '☐'}
          </button>
          <span>{item.text}</span>
          <button class="x" onclick="remove(item.id)">×</button>
        </li>
      </for>
    </ul>
  </else>
</div>

<script>
  let draft = "";
  let nextId = 1;
  let items = [];

  function add() {
    const text = draft.trim();
    if (!text) return;
    items = [...items, { id: nextId++, text, done: false }];
    draft = "";
  }

  function toggle(id) {
    items = items.map((i) => (i.id === id ? { ...i, done: !i.done } : i));
  }

  function remove(id) {
    items = items.filter((i) => i.id !== id);
  }
<\/script>

<style>
  .todo { font-family: system-ui; max-width: 420px; margin: 1.5rem auto; }
  h2 { color: #1c1e21; }
  form { display: flex; gap: .5rem; margin-bottom: 1rem; }
  form input { flex: 1; }
  input { padding: .5rem; border: 1px solid #ccd0d5; border-radius: 6px; }
  form button { padding: .5rem .9rem; border: 0; border-radius: 6px;
                background: #ff6b35; color: #fff; cursor: pointer; }
  ul { list-style: none; padding: 0; }
  li { display: flex; align-items: center; gap: .5rem;
       padding: .5rem; border-bottom: 1px solid #eee; }
  li span { flex: 1; }
  li.done span { text-decoration: line-through; color: #9198a1; }
  .check { background: transparent; border: 0; font-size: 1.2rem;
           cursor: pointer; padding: 0; }
  .x { background: transparent; border: 0; color: #f85149;
       font-size: 1.2rem; cursor: pointer; margin-left: auto; }
  .empty { color: #9198a1; }
</style>`,
        },
    ],

    "Directives (if / show / for)": [
        {
            name: "demo-directives",
            code: `<div class="demo">
  <section>
    <h3>if / else-if / else</h3>
    <div class="row">
      <button onclick="mode = 'loading'">loading</button>
      <button onclick="mode = 'success'">success</button>
      <button onclick="mode = 'idle'">idle</button>
    </div>
    <if condition="mode === 'loading'"><p>⏳ Loading…</p></if>
    <else-if condition="mode === 'success'"><p>✅ Done!</p></else-if>
    <else><p>📭 idle</p></else>
  </section>

  <section>
    <h3>show</h3>
    <button onclick="open = !open">toggle</button>
    <show condition="open">
      <nav><a href="#">Home</a> · <a href="#">About</a></nav>
    </show>
  </section>

  <section>
    <h3>for</h3>
    <button onclick="add()">+ add</button>
    <ul>
      <for each="(item, i) in items" key="item.id">
        <li>#{i + 1} — {item.name}
          <button onclick="remove(item.id)">×</button>
        </li>
      </for>
    </ul>
  </section>
</div>

<script>
  let mode = "idle";
  let open = false;
  let nextId = 3;
  let items = [
    { id: 1, name: "First" },
    { id: 2, name: "Second" },
  ];
  function add() { items = [...items, { id: nextId++, name: "Item " + nextId }]; }
  function remove(id) { items = items.filter((x) => x.id !== id); }
<\/script>

<style>
  .demo { font-family: system-ui; max-width: 460px; margin: 1rem auto; }
  section { padding: .75rem 0; border-bottom: 1px solid #eee; }
  h3 { margin: 0 0 .5rem; color: #1c1e21; }
  .row { display: flex; gap: .5rem; }
  button { padding: .35rem .7rem; border: 1px solid #ccd0d5; border-radius: 6px;
           background: #fff; cursor: pointer; }
  ul { padding-left: 1.1rem; }
</style>`,
        },
    ],

    "Two-way binding": [
        {
            name: "demo-form",
            code: `<div class="form">
  <h3>Live form binding</h3>
  <label>Name <input $bind="name" placeholder="Ada" /></label>
  <label>Color
    <select $bind="color">
      <option value="#1877f2">Blue</option>
      <option value="#e4405f">Pink</option>
      <option value="#2ecc71">Green</option>
    </select>
  </label>
  <label>Size {size}px <input type="range" min="16" max="72" $bind="size" /></label>

  <p class="preview" style="color: {color}; font-size: {size}px;">
    Hello, {name || "stranger"}!
  </p>
</div>

<script>
  let name = "";
  let color = "#1877f2";
  let size = 32;
<\/script>

<style>
  .form { font-family: system-ui; max-width: 380px; margin: 1.5rem auto;
          display: grid; gap: .75rem; }
  label { display: grid; gap: .25rem; font-size: .85rem; color: #65676b; }
  input, select { padding: .5rem; border: 1px solid #ccd0d5; border-radius: 6px; }
  .preview { font-weight: 800; text-align: center; margin-top: .5rem; }
</style>`,
        },
    ],

    "Props (parent → child)": [
        {
            name: "profile-page",
            code: `<div class="page">
  <h2>Team ({people.length})</h2>
  <div class="cards">
    <for each="person in people" key="person.name">
      <user-card
        name="{person.name}"
        role="{person.role}"
        status="{person.status}"
      ></user-card>
    </for>
  </div>
</div>

<script>
  // The parent owns the data and passes it down as attributes (props).
  let people = [
    { name: "Ada Lovelace", role: "Engineer", status: "online" },
    { name: "Alan Turing", role: "Researcher", status: "offline" },
    { name: "Grace Hopper", role: "Admiral", status: "online" },
  ];
<\/script>

<style>
  .page { font-family: system-ui; max-width: 460px; margin: 1.5rem auto; }
  h2 { color: #1c1e21; }
  .cards { display: grid; gap: .6rem; }
</style>`,
        },
        {
            name: "user-card",
            code: `<div class="card">
  <div class="avatar">{name.charAt(0)}</div>
  <div class="info">
    <strong>{name}</strong>
    <span class="role">{role}</span>
  </div>
  <span class="status {status === 'online' ? 'on' : 'off'}">{status}</span>
</div>

<script>
  // Attributes on <user-card ...> override these defaults.
  let name = "Unknown";
  let role = "—";
  let status = "offline";
<\/script>

<style>
  .card { display: flex; align-items: center; gap: .75rem; padding: .6rem .9rem;
          border: 1px solid #e4e6eb; border-radius: 10px; font-family: system-ui; }
  .avatar { width: 40px; height: 40px; border-radius: 50%; background: #ff6b35;
            color: #fff; display: grid; place-items: center; font-weight: 700; }
  .info { display: flex; flex-direction: column; flex: 1; }
  .role { color: #65676b; font-size: .85rem; }
  .status { font-size: .72rem; text-transform: uppercase; letter-spacing: .04em; }
  .status.on { color: #2ecc71; }
  .status.off { color: #9198a1; }
</style>`,
        },
    ],

    "Event bus (emit / listen)": [
        {
            name: "chat-panel",
            code: `<div class="chat">
  <h3>💬 Chat</h3>
  <form $on:submit.prevent="send()">
    <input $bind="draft" placeholder="Type a message…" />
    <button>Send</button>
  </form>

  <!-- A sibling component that lives in its own file -->
  <message-list></message-list>
</div>

<script>
  let draft = "";
  function send() {
    const text = draft.trim();
    if (!text) return;
    // Broadcast on the global event bus — no props needed.
    $emit("chat:message", { text, time: new Date().toLocaleTimeString() });
    draft = "";
  }
<\/script>

<style>
  .chat { font-family: system-ui; max-width: 420px; margin: 1.5rem auto; }
  h3 { color: #1c1e21; }
  form { display: flex; gap: .5rem; margin-bottom: 1rem; }
  input { flex: 1; padding: .5rem; border: 1px solid #ccd0d5; border-radius: 6px; }
  button { padding: .5rem .9rem; border: 0; border-radius: 6px;
           background: #ff6b35; color: #fff; cursor: pointer; }
</style>`,
        },
        {
            name: "message-list",
            code: `<div class="list">
  <if condition="messages.length === 0">
    <p class="empty">No messages yet — send one above.</p>
  </if>
  <else>
    <ul>
      <for each="msg in messages" key="msg.id">
        <li><span class="time">{msg.time}</span> {msg.text}</li>
      </for>
    </ul>
  </else>
</div>

<script>
  let messages = [];
  let nextId = 1;
  // Listen for events emitted anywhere in the app.
  $listen("chat:message", (data) => {
    messages = [...messages, { id: nextId++, ...data }];
  });
<\/script>

<style>
  .list { font-family: system-ui; max-width: 420px; margin: 0 auto; }
  ul { list-style: none; padding: 0; margin: 0; }
  li { padding: .5rem .75rem; border: 1px solid #eee; border-radius: 8px;
       margin-bottom: .4rem; }
  .time { color: #9198a1; font-size: .75rem; margin-right: .5rem; }
  .empty { color: #9198a1; }
</style>`,
        },
    ],
};

// Ordered list of example names for the picker.
export const EXAMPLE_NAMES = Object.keys(EXAMPLES);
