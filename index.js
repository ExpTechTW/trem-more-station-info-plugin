const config = require("../config/config");
const path = require("path");
const { ipcRenderer } = require("electron");

class Plugin {
  static instance = null;

  #ctx;
  #config;

  constructor(ctx) {
    if (Plugin.instance) return Plugin.instance;

    this.#ctx = ctx;
    this.name = "more-station-info";
    this.#config = null;
    this.config = {};
    this.logger = null;

    Plugin.instance = this;
  }

  static getInstance() {
    if (!Plugin.instance) throw new Error("Plugin not initialized");

    return Plugin.instance;
  }

  intensity_float_to_int(float) {
    return float < 0 ? 0 : float < 4.5 ? Math.round(float) : float < 5 ? 5 : float < 5.5 ? 6 : float < 6 ? 7 : float < 6.5 ? 8 : 9;
  }

  onLoad() {
    const { TREM, Logger, info, utils } = this.#ctx;

    const { CustomLogger } =
      require("../logger/logger").createCustomLogger(Logger);
    this.logger = new CustomLogger("more-station-info");

    const defaultDir = path.join(
      info.pluginDir,
      "./more-station-info/resource/default.yml"
    );
    const configDir = path.join(info.pluginDir, "./more-station-info/config.yml");

    this.#config = new config(this.name, this.logger, utils.fs, defaultDir, configDir);

    this.config = this.#config.getConfig(this.name);

    const event = (event, callback) => TREM.variable.events.on(event, callback);

    event("MapLoad", (map) => {
      map.addSource('rts-6', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({
        id: 'rts-layer-6',
        type: 'circle',
        source: 'rts-6',
        paint: {
          'circle-color': [
            'interpolate',
            ['linear'],
            ['get', 'i'],
            -6, "rgba( 0 , 0 , 0 , 0 )",
          ],
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            4, 2,
            12, 8,
          ],
          'circle-stroke-width': 1,
          'circle-stroke-color': '#000000',
          'circle-stroke-opacity': 1,
        },
      });
      map.on('click', 'rts-layer-6', (e) => {
        const properties = e.features[0].properties;
        navigator.clipboard.writeText(properties.id).then(() => {
          console.debug(properties.id);
          console.debug("複製成功");
        });
      });
      // map.on('mousemove', 'rts-layer-6', (e) => {
      //   const properties = e.features[0].properties;
      //   const coordinates = e.features[0].geometry.coordinates;

      //   new mapboxgl.Popup()
      //     .setLngLat(coordinates)
      //     .setHTML(properties.popupContent)
      //     .addTo(map);
      // });

      // map.on('mouseenter', 'rts-layer-6', () => {
      //   map.getCanvas().style.cursor = 'pointer';
      // });

      // map.on('mouseleave', 'rts-layer-6', () => {
      //   map.getCanvas().style.cursor = '';
      // });
    });

    event("DataRts", (ans) => {
      const data = ans.data;

      if (!data) return;

      let data_list = [];
      let station_true = {};

      for (const id of Object.keys(data.station)) {
        const station_info = TREM.variable.station[id];
        if (!station_info) {
          continue;
        }
        station_true[id] = true;
      }

      for (let i = 0, j_ks = Object.keys(TREM.variable.station), n = j_ks.length; i < n; i++) {
        const all_station_id = j_ks[i];
        const all_station_info = TREM.variable.station[all_station_id];
        if (all_station_info.work) {
          const all_station_location = all_station_info.info.at(-1);
          if (!station_true[all_station_id]) {
            data_list.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [all_station_location.lon, all_station_location.lat] },
              properties: {
                i: -6,
                id: all_station_id,
                // popupContent: `
                //   <div>
                //     <strong>${all_station_id}</strong>
                //     <p>Longitude: ${all_station_location.lon}</p>
                //     <p>Latitude: ${all_station_location.lat}</p>
                //   </div>
                // `
              }
            });
          }
        }
      }

      if (TREM.constant.SHOW_REPORT) {
        data_list = [];
      }

      if (TREM.variable.map) {
        TREM.variable.map.getSource('rts-6').setData({ type: 'FeatureCollection', features: data_list });
      }
    });
  }
}

module.exports = Plugin;
