// Hand-written direct DOM manipulation — the "speed of light" baseline.
(() => {
  const container = document.getElementById("rows");
  let rows = [];
  let selectedEl = null;
  const byId = new Map(); // id -> row element

  const template = document.createElement("template");
  template.innerHTML =
    '<div class="row"><span class="col-id"></span>' +
    '<span class="col-label"><a></a></span>' +
    '<span class="col-remove"><a>✕</a></span></div>';

  function makeRow(row) {
    const el = template.content.firstChild.cloneNode(true);
    el.firstChild.textContent = row.id;
    el.children[1].firstChild.textContent = row.label;
    byId.set(row.id, el);
    return el;
  }

  function renderAll() {
    byId.clear();
    selectedEl = null;
    const frag = document.createDocumentFragment();
    for (const row of rows) frag.appendChild(makeRow(row));
    container.textContent = "";
    container.appendChild(frag);
  }

  window.benchApi = {
    create(n) {
      rows = window.__bench.buildData(n);
      renderAll();
    },
    append(n) {
      const added = window.__bench.buildData(n);
      rows = rows.concat(added);
      const frag = document.createDocumentFragment();
      for (const row of added) frag.appendChild(makeRow(row));
      container.appendChild(frag);
    },
    update() {
      for (let i = 0; i < rows.length; i += 10) {
        rows[i].label += " !!!";
        byId.get(rows[i].id).children[1].firstChild.textContent = rows[i].label;
      }
    },
    select(id) {
      if (selectedEl) selectedEl.classList.remove("danger");
      selectedEl = byId.get(id);
      if (selectedEl) selectedEl.classList.add("danger");
    },
    swap() {
      if (rows.length <= 998) return;
      const tmp = rows[1];
      rows[1] = rows[998];
      rows[998] = tmp;
      const a = byId.get(rows[1].id);
      const b = byId.get(rows[998].id);
      const afterB = b.nextSibling;
      container.insertBefore(b, a);
      container.insertBefore(a, afterB);
    },
    remove(id) {
      rows = rows.filter((r) => r.id !== id);
      byId.get(id).remove();
      byId.delete(id);
    },
    clear() {
      rows = [];
      byId.clear();
      selectedEl = null;
      container.textContent = "";
    },
  };
  window.benchReady = true;
})();
