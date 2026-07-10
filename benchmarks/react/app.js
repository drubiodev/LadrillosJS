/* global React, ReactDOM */
// Idiomatic React 18 implementation: hooks, keyed rows, memoized Row —
// the same shape as the official krausest "react-hooks" entry.
(() => {
  const { useState, useCallback, memo, createElement: h } = React;

  const Row = memo(function Row({ row, selected, onSelect, onRemove }) {
    return h(
      "div",
      { className: selected ? "row danger" : "row" },
      h("span", { className: "col-id" }, row.id),
      h(
        "span",
        { className: "col-label" },
        h("a", { onClick: () => onSelect(row.id) }, row.label)
      ),
      h(
        "span",
        { className: "col-remove" },
        h("a", { onClick: () => onRemove(row.id) }, "✕")
      )
    );
  });

  let apiRef = {};

  function App() {
    const [rows, setRows] = useState([]);
    const [selected, setSelected] = useState(0);

    const onSelect = useCallback((id) => setSelected(id), []);
    const onRemove = useCallback(
      (id) => setRows((rs) => rs.filter((r) => r.id !== id)),
      []
    );

    apiRef.create = (n) => setRows(window.__bench.buildData(n));
    apiRef.append = (n) => setRows((rs) => rs.concat(window.__bench.buildData(n)));
    apiRef.update = () =>
      setRows((rs) =>
        rs.map((r, i) => (i % 10 === 0 ? { id: r.id, label: r.label + " !!!" } : r))
      );
    apiRef.select = onSelect;
    apiRef.swap = () =>
      setRows((rs) => {
        if (rs.length <= 998) return rs;
        const next = rs.slice();
        const tmp = next[1];
        next[1] = next[998];
        next[998] = tmp;
        return next;
      });
    apiRef.remove = onRemove;
    apiRef.clear = () => {
      setRows([]);
      setSelected(0);
    };

    return h(
      "div",
      { className: "rows" },
      rows.map((row) =>
        h(Row, {
          key: row.id,
          row,
          selected: row.id === selected,
          onSelect,
          onRemove,
        })
      )
    );
  }

  const root = ReactDOM.createRoot(document.getElementById("app"));
  root.render(h(App));

  window.benchApi = apiRef;
  window.benchReady = true;
})();
