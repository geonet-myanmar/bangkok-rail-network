# Bangkok Rail Stations Web Map

A lightweight static web map that visualizes Bangkok-area public train stations from the open dataset in `Gusb3ll/thailand-public-train-data`.

- Map library: Leaflet (loaded via CDN)
- Basemap tiles: OpenStreetMap
- Data: station + line metadata JSON (stored in `data/`)

## Features

- Station markers plotted from dataset latitude/longitude
- Markers colored by line color
- Click marker to view station details popup
- Search by station name (TH/EN) or station ID
- Toggle visibility per line (BTS/MRT/SRT/etc.)

## Project Structure

- `index.html` – app shell
- `styles.css` – layout + UI styling
- `app.js` – data loading, rendering, filtering
- `data/data_transport_station.json` – stations dataset (copied from upstream)
- `data/data_transport_line.json` – line metadata (copied from upstream)

## Data Source

This project uses the rail station dataset from:

- https://github.com/Gusb3ll/thailand-public-train-data

Upstream repo license: **CC0-1.0** (public domain dedication). See the upstream repo `LICENSE` for details.

### Station schema

`data/data_transport_station.json` is an array of objects like:

- `stationId` (string)
- `name` (Thai)
- `nameEng` (English)
- `transportationId` (string/number-like id that links to a line)
- `geoLat`, `geoLng` (strings containing decimal degrees)

### Line schema

`data/data_transport_line.json` is an array of objects like:

- `id` (string/number-like)
- `name` (Thai)
- `nameEng` (English)
- `lineColorHex` (e.g. `#92D04E`)
- `service` (e.g. `BTS`, `MRT`, `SRT`)

## Run Locally

Because the app loads JSON via `fetch()`, you must serve it over HTTP (not `file://`).

### Using Python

From the project folder:

```bash
python -m http.server 8000
```

Then open:

- http://127.0.0.1:8000/

### Troubleshooting local run

- If you open `index.html` directly (file://), your browser will block `fetch()` and the map will show a “failed to load data” message.
- If port 8000 is in use, pick another port: `python -m http.server 5173`

## Publish on GitHub Pages

### 1) Create a GitHub repo

Create a new repository on GitHub (example name: `bangkok-rail-map`).

### 2) Push this project

From this project directory:

```bash
git init
git add .
git commit -m "Add Leaflet station web map"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

### 3) Enable GitHub Pages

On GitHub:

- `Settings` → `Pages`
- **Source**: “Deploy from a branch”
- **Branch**: `main`
- **Folder**: `/ (root)`
- Save

After ~1–3 minutes, your site will be available at:

- `https://<your-username>.github.io/<your-repo>/`

### Notes

- The map uses relative paths like `data/data_transport_station.json`, which works fine on GitHub Pages.
- Leaflet is loaded from a CDN; GitHub Pages requires no build step.

## Attribution / Terms

- This map uses OpenStreetMap tiles. The app includes the required OpenStreetMap attribution in the map UI.
- Leaflet is used under its open-source license.

## Customization

Common tweaks:

- Default view: adjust `DEFAULT_CENTER` / `DEFAULT_ZOOM` in `app.js`.
- Marker styling: adjust the `L.circleMarker` options in `app.js`.
- Basemap: change the tile URL in `app.js` (keep proper attribution for your tile provider).

## Updating the Data

If you want to refresh the datasets from the upstream repo, re-download:

- `data/data_transport_station.json`
- `data/data_transport_line.json`

Then commit and push the updated files.
