const { promisify } = require("util");
const fetch = require("node-fetch");
const parser = promisify(require("xml2js").parseString);
const express = require("express");
const app = express();

let CACHE = {};

function setCacheData(data) {
  CACHE.data = data;
  CACHE.timestamp = Date.now();
}

function getCacheData() {
  let now = Date.now();
  let timeout = 10000 * 60 * 5; // 5 minutes
  if (CACHE.timestamp && now - CACHE.timestamp <= timeout) {
    console.log(">>> Cache Hit");
    return CACHE.data;
  }

  console.log(">>> Cache Miss");
  return null;
}

const PLACE_STYLE = {
  "#0": "Servicios de Salud",
  "#1": "Alimento y/o Suministros",
  "#2": "Refugio / Campamento"
};

async function getBatchGeoData() {
  let cacheHit = getCacheData();
  if (cacheHit) {
    return cacheHit;
  }

  let response = await fetch(
    "https://batchgeo.com/map/kml/de8ab2455315ad6fa4b05522d88c3ed6"
  );
  let body = await response.text();
  let data = await parser(body);

  let document = data.kml.Document[0];
  let name = document.name[0];
  let places = document.Placemark;

  let cleanData = places.map((place) => {
    return {
      need: PLACE_STYLE[place.styleUrl],
      address: place.address[0],
      name: place.name[0],
      location: place.Point[0].coordinates,
      data: place.ExtendedData[0].Data.filter(
        (d) => ["Necesidades", "Contactos"].indexOf(d.$.name) > -1
      ).map((d) => {
        return { key: d.$.name, value: d.value[0] };
      })
    };
  });

  setCacheData(cleanData);
  return cleanData;
}

app.get("/data.json", async (req, res) => {
  let data = await getBatchGeoData();
  res.json(data);
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Listening on port 3000...");
});