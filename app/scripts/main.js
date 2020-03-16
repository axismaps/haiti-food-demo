/* global mapboxgl */
/* global $ */

/*

*** MAP VARIABLES ***

*/

mapboxgl.accessToken = 'pk.eyJ1IjoiYXhpc21hcHMiLCJhIjoieUlmVFRmRSJ9.CpIxovz1TUWe_ecNLFuHNg';
const extent = new mapboxgl.LngLatBounds(
  [-75.4580336168, 17.0309927434],
  [-70.6248732164, 20.9156839055]
);

const maxZooms = {
  departement: 8,
  commune: 9,
  section: 24,
};

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/light-v10',
  minZoom: 4,
  maxZoom: 12,
  maxBounds: extent,
  bounds: extent,
});

const nav = new mapboxgl.NavigationControl();
map.addControl(nav, 'top-left');

const geoSource = {
  type: 'vector',
  url: 'mapbox://axismaps.0px6eqw0'
};

const departementsLayer = {
  id: 'departement',
  source: 'haiti',
  'source-layer': 'departments',
  type: 'fill',
  minzoom: 0,
  maxzoom: maxZooms.departement,
  paint: {
    'fill-color': '#ccc',
    'fill-opacity': .5
  }
};

const departementsLineLayer = {
  id: 'departement-line',
  source: 'haiti',
  'source-layer': 'departments',
  type: 'line',
  minzoom: 0,
  maxzoom: maxZooms.departement,
  paint: {
    'line-color': '#ccc',
  }
};

const communesLayer = {
  id: 'commune',
  source: 'haiti',
  'source-layer': 'communes',
  type: 'fill',
  minzoom: maxZooms.departement,
  maxzoom: maxZooms.commune,
  paint: {
    'fill-color': '#ccc',
    'fill-opacity': .5
  }
};

const communesLineLayer = {
  id: 'commune-line',
  source: 'haiti',
  'source-layer': 'communes',
  type: 'line',
  minzoom: maxZooms.departement,
  maxzoom: maxZooms.commune,
  paint: {
    'line-color': '#ccc',
  }
};

const sectionsLayer = {
  id: 'section',
  source: 'haiti',
  'source-layer': 'sections',
  type: 'fill',
  minzoom: maxZooms.commune,
  paint: {
    'fill-color': '#ccc',
    'fill-opacity': .5
  }
};

const sectionsLineLayer = {
  id: 'section-line',
  source: 'haiti',
  'source-layer': 'sections',
  type: 'line',
  minzoom: maxZooms.commune,
  paint: {
    'line-color': '#ccc',
  }
};

/*

*** DATA VARIABLES AND METHODS ***

*/

let currentMeasure = 'hdvi';
let currentUnit = 'departement';

const apiBase = 'https://simast.herokuapp.com/v1/data/query/';

const cachedData = {};
let currentData = null;

const choroplethBreaks = [.1, .2, .3, .4];
const choroplethColors = ['#eff3ff','#bdd7e7','#6baed6','#3182bd','#08519c'];

const updateMap = () => {
  let idProp;
  if (currentUnit === 'departement') idProp = 'ID_Dep';
  if (currentUnit === 'commune') idProp = 'id_com';
  if (currentUnit === 'section') idProp = 'ID_Section';

  const mapData = {};
  Object.values(currentData).forEach((d) => {
    mapData[d[currentUnit].toString().replace(/0(?!$)/g, '')] = d[currentMeasure];
  });
  const fillStyle = ['case',
    ['==', ['get', ['to-string', ['get', idProp]], ['literal', mapData]], null], '#ccc',
    ['<', ['get', ['to-string', ['get', idProp]], ['literal', mapData]], choroplethBreaks[0]], choroplethColors[0],
    ['<', ['get', ['to-string', ['get', idProp]], ['literal', mapData]], choroplethBreaks[1]], choroplethColors[1],
    ['<', ['get', ['to-string', ['get', idProp]], ['literal', mapData]], choroplethBreaks[2]], choroplethColors[2],
    ['<', ['get', ['to-string', ['get', idProp]], ['literal', mapData]], choroplethBreaks[3]], choroplethColors[3],
    choroplethColors[4]
  ];

  map.setPaintProperty(currentUnit, 'fill-color', fillStyle);
};

const requestData = () => {
  if (cachedData[currentMeasure] && cachedData[currentMeasure][currentUnit]) {
    currentData = cachedData[currentMeasure][currentUnit];
    updateMap();
  } else {
    d3.json(`${apiBase}${currentMeasure}/${currentUnit}`, {
      method: 'POST'
    }).then((json) => { 
      if (!cachedData[currentMeasure]) cachedData[currentMeasure] = {};
      const indexedData = {};
      json.forEach((d) => {
        indexedData[d[currentUnit]] = d;
      });
      cachedData[currentMeasure][currentUnit] = indexedData;
      currentData = indexedData;
      updateMap();
    });
  }
}

const updateMeasure = (measure) => {
  currentMeasure = measure;
  $('#measure-name').html(currentMeasure);
  requestData();
};

const updateUnit = (unit) => {
  currentUnit = unit;
  requestData();
}

$('#measure-dropdown .dropdown-item').on('click', function selectMeasure() {
  updateMeasure($(this).attr('data-value'));
});

/*

*** PROBE METHODS ***

*/

const showProbe = (position, title, content) => {
  if (title) {
    $('#probe-title').html(title);
  } else {
    $('#probe-title').html('');
  }

  if (content) {
    $('#probe-content').html(content);
  } else {
    $('#probe-content').html('');
  }

  if (position[0] > window.innerWidth / 2) {
    $('#probe')
      .css({
        left: 'auto',
        right: `${window.innerWidth - position[0]}px`
      });
  } else {
    $('#probe')
      .css({
        right: 'auto',
        left: `${position[0]}px`
      });
  }

  if (position[1] > 200) {
    $('#probe')
      .css({
        top: 'auto',
        bottom: `${window.innerHeight - position[1]}px`
      });
  } else {
    $('#probe')
      .css({
        bottom: 'auto',
        top: `${position[1]}px`
      });
  }

  $('#probe').show();
};

const hideProbe = () => {
  $('#probe').hide();
}

/*

*** INITIALIZATION AND EVENTS ***

*/

const init = () => {
  map.addSource('haiti', geoSource)
    .addLayer(departementsLayer)
    .addLayer(communesLayer)
    .addLayer(sectionsLayer)
    .addLayer(departementsLineLayer)
    .addLayer(communesLineLayer)
    .addLayer(sectionsLineLayer)
    // probe mouse events
    .on('mousemove', 'departement', (e) => {
      if (e.features.length) {
        const feature = e.features[0];
        const { pageX, pageY } = e.originalEvent;
        showProbe([pageX, pageY], feature.properties.Departemen);        
      }
    })
    .on('mouseout', 'departement', hideProbe)
    .on('mousemove', 'commune', (e) => {
      if (e.features.length) {
        const feature = e.features[0];
        const { pageX, pageY } = e.originalEvent;
        showProbe([pageX, pageY], feature.properties.Commune);        
      }
    })
    .on('mouseout', 'commune', hideProbe)
    .on('mousemove', 'section', (e) => {
      if (e.features.length) {
        const feature = e.features[0];
        const { pageX, pageY } = e.originalEvent;
        showProbe([pageX, pageY], feature.properties.NAME_Sec);        
      }
    })
    .on('mouseout', 'section', hideProbe)
    // zoom event: update geography level
    .on('zoomend', () => {
      const z = map.getZoom();
      if (z <= maxZooms.departement && currentUnit !== 'departement') {
        updateUnit('departement');
      } else if (z > maxZooms.departement && z <= maxZooms.commune && currentUnit !== 'commune') {
        updateUnit('commune');
      } else if (z > maxZooms.commune && currentUnit !== 'section') {
        updateUnit('section');
      } 
    });

    requestData();
};

map.on('load', init);
