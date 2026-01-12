/* global L */

const DATASETS = {
  stations: "data/data_transport_station.json",
  lines: "data/data_transport_line.json",
};

const DEFAULT_CENTER = [13.7563, 100.5018]; // Bangkok
const DEFAULT_ZOOM = 11;

function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function safeColor(hex) {
  if (!hex) return "#6ea8fe";
  const s = String(hex).trim();
  if (/^#[0-9a-f]{6}$/i.test(s)) return s;
  return "#6ea8fe";
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2), value);
    } else {
      node.setAttribute(key, String(value));
    }
  }
  for (const child of children) node.append(child);
  return node;
}

async function loadJson(path) {
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error(`Failed to load ${path}: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

function createPopupHtml({ station, line }) {
  const lineName = line?.nameEng || line?.name || "Unknown line";
  const service = line?.service || "";

  const title = `${station.nameEng || station.name || "Station"}`;
  const subtitle = station.nameEng && station.name ? station.name : "";

  const rows = [
    ["Station ID", station.stationId],
    ["Line", lineName],
    service ? ["Service", service] : null,
    ["Lat", station.geoLat],
    ["Lng", station.geoLng],
  ].filter(Boolean);

  const rowHtml = rows
    .map(
      ([k, v]) =>
        `<div style="display:flex; gap:8px; justify-content:space-between;">
          <div style="color:#6b7280;">${k}</div>
          <div style="font-variant-numeric: tabular-nums;">${v ?? ""}</div>
        </div>`
    )
    .join("");

  return `
    <div style="min-width: 220px;">
      <div style="font-weight: 700; font-size: 14px;">${title}</div>
      ${subtitle ? `<div style="color:#6b7280; margin: 2px 0 8px;">${subtitle}</div>` : `<div style="margin-top: 8px;"></div>`}
      <div style="display:grid; gap:6px;">${rowHtml}</div>
    </div>
  `;
}

function buildIndex(stations, lines) {
  const lineById = new Map(lines.map((l) => [String(l.id), l]));
  const stationsPrepared = [];

  for (const station of stations) {
    const lat = Number.parseFloat(station.geoLat);
    const lng = Number.parseFloat(station.geoLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const line = lineById.get(String(station.transportationId)) || null;
    const key = `${station.stationId}::${station.transportationId}`;

    stationsPrepared.push({
      key,
      station,
      line,
      lat,
      lng,
      searchText: [
        station.stationId,
        station.name,
        station.nameEng,
        line?.name,
        line?.nameEng,
        line?.service,
      ]
        .map(normalizeText)
        .filter(Boolean)
        .join(" "),
    });
  }

  return { lineById, stationsPrepared };
}

function main() {
  const map = L.map("map", { zoomControl: true }).setView(
    DEFAULT_CENTER,
    DEFAULT_ZOOM
  );

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  const ui = {
    search: document.getElementById("search"),
    clear: document.getElementById("clear"),
    showAll: document.getElementById("showAll"),
    results: document.getElementById("results"),
    lineFilters: document.getElementById("lineFilters"),
    summary: document.getElementById("summary"),
  };

  let state = {
    lineLayers: new Map(),
    lineCheckboxes: new Map(),
    markerIndex: new Map(),
    stationsPrepared: [],
  };

  function setSummary(text) {
    ui.summary.textContent = text;
  }

  function ensureLineVisible(lineId) {
    const checkbox = state.lineCheckboxes.get(lineId);
    const layer = state.lineLayers.get(lineId);
    if (!checkbox || !layer) return;

    if (!checkbox.checked) {
      checkbox.checked = true;
      layer.addTo(map);
    }
  }

  function showResults(items, query) {
    ui.results.replaceChildren();

    if (!query) return;

    const max = 12;
    const shown = items.slice(0, max);

    if (shown.length === 0) {
      ui.results.append(
        el("div", {
          class: "muted",
          text: "No matches. Try another spelling.",
        })
      );
      return;
    }

    for (const item of shown) {
      const stationName = item.station.nameEng || item.station.name || "";
      const stationNameTh =
        item.station.nameEng && item.station.name ? item.station.name : "";
      const lineName = item.line?.nameEng || item.line?.name || "Unknown line";

      ui.results.append(
        el(
          "div",
          {
            class: "result",
            onclick: () => {
              ensureLineVisible(String(item.station.transportationId));
              map.flyTo([item.lat, item.lng], Math.max(map.getZoom(), 14), {
                duration: 0.6,
              });
              const marker = state.markerIndex.get(item.key);
              if (marker) marker.openPopup();
            },
          },
          [
            el("div", { class: "result__top" }, [
              el("div", { text: stationName }),
              el("div", { class: "badge", text: item.station.stationId }),
            ]),
            stationNameTh ? el("div", { class: "muted", text: stationNameTh }) : el("div"),
            el("div", { class: "muted", text: lineName }),
          ]
        )
      );
    }

    if (items.length > max) {
      ui.results.append(
        el("div", {
          class: "muted",
          text: `Showing ${max} of ${items.length} matches`,
        })
      );
    }
  }

  function applySearch(query) {
    const q = normalizeText(query);
    if (!q) {
      ui.results.replaceChildren();
      return;
    }

    const matches = state.stationsPrepared
      .filter((s) => s.searchText.includes(q))
      .slice(0, 80);

    showResults(matches, q);
  }

  function setAllLinesVisible(visible) {
    for (const [lineId, layer] of state.lineLayers.entries()) {
      const checkbox = state.lineCheckboxes.get(lineId);
      if (!checkbox) continue;

      checkbox.checked = visible;
      if (visible) layer.addTo(map);
      else map.removeLayer(layer);
    }
  }

  function wireUi() {
    ui.search.addEventListener("input", () => applySearch(ui.search.value));

    ui.clear.addEventListener("click", () => {
      ui.search.value = "";
      ui.results.replaceChildren();
      ui.search.focus();
    });

    ui.showAll.addEventListener("click", () => {
      setAllLinesVisible(true);
    });
  }

  function renderFilters({ lines, stationsPrepared }) {
    ui.lineFilters.replaceChildren();

    const countsByLine = new Map();
    for (const s of stationsPrepared) {
      const id = String(s.station.transportationId);
      countsByLine.set(id, (countsByLine.get(id) || 0) + 1);
    }

    const linesSorted = [...lines]
      .map((l) => ({ ...l, id: String(l.id) }))
      .filter((l) => (countsByLine.get(String(l.id)) || 0) > 0)
      .sort(
        (a, b) => a.service.localeCompare(b.service) || a.id.localeCompare(b.id)
      );

    for (const line of linesSorted) {
      const lineId = String(line.id);
      const color = safeColor(line.lineColorHex);
      const count = countsByLine.get(lineId) || 0;

      const checkbox = el("input", {
        type: "checkbox",
        checked: "checked",
        "aria-label": `Toggle ${line.nameEng || line.name}`,
      });

      checkbox.addEventListener("change", () => {
        const layer = state.lineLayers.get(lineId);
        if (!layer) return;
        if (checkbox.checked) layer.addTo(map);
        else map.removeLayer(layer);
      });

      state.lineCheckboxes.set(lineId, checkbox);

      ui.lineFilters.append(
        el("div", { class: "filter" }, [
          checkbox,
          el("div", {
            class: "swatch",
            style: `background:${color}`,
          }),
          el("div", { class: "filter__meta" }, [
            el("div", {
              class: "filter__name",
              text: line.nameEng || line.name || `Line ${lineId}`,
            }),
            el("div", {
              class: "filter__sub",
              text: `${line.service || ""}${line.service ? " • " : ""}${count} stations`,
            }),
          ]),
        ])
      );
    }
  }

  function addStationsToMap({ stationsPrepared }) {
    const bounds = [];

    const byLine = new Map();
    for (const s of stationsPrepared) {
      const lineId = String(s.station.transportationId);
      if (!byLine.has(lineId)) byLine.set(lineId, []);
      byLine.get(lineId).push(s);
    }

    for (const [lineId, items] of byLine.entries()) {
      const line = items[0]?.line;
      const color = safeColor(line?.lineColorHex);

      const layer = L.layerGroup();

      for (const item of items) {
        const marker = L.circleMarker([item.lat, item.lng], {
          radius: 6,
          color,
          weight: 2,
          fillColor: color,
          fillOpacity: 0.75,
        });

        marker.bindPopup(createPopupHtml(item), { closeButton: true });
        marker.addTo(layer);

        state.markerIndex.set(item.key, marker);
        bounds.push([item.lat, item.lng]);
      }

      state.lineLayers.set(lineId, layer);
      layer.addTo(map);
    }

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }

  async function boot() {
    try {
      setSummary("Loading datasets…");
      const [stations, lines] = await Promise.all([
        loadJson(DATASETS.stations),
        loadJson(DATASETS.lines),
      ]);

      const { stationsPrepared } = buildIndex(stations, lines);
      state.stationsPrepared = stationsPrepared;

      const lineIdsWithStations = new Set(
        stationsPrepared.map((s) => String(s.station.transportationId))
      );
      const linesWithStations = lines.filter((l) =>
        lineIdsWithStations.has(String(l.id))
      );

      wireUi();
      renderFilters({ lines: linesWithStations, stationsPrepared });
      addStationsToMap({ stationsPrepared });

      setSummary(
        `${stationsPrepared.length} stations • ${linesWithStations.length} lines`
      );
    } catch (err) {
      console.error(err);
      setSummary("Failed to load data.");
      ui.results.replaceChildren(
        el("div", {
          class: "muted",
          text:
            "Could not load the JSON files. Run a local server (not file://) and refresh.",
        })
      );
    }
  }

  boot();
}

main();
