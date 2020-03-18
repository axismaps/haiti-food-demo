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

const departementLayer = {
  id: 'departement',
  source: 'haiti',
  'source-layer': 'departement',
  type: 'fill',
  minzoom: 0,
  maxzoom: maxZooms.departement,
  paint: {
    'fill-color': '#ccc',
    'fill-opacity': .5
  }
};

const departementLineLayer = {
  id: 'departement-line',
  source: 'haiti',
  'source-layer': 'departement',
  type: 'line',
  minzoom: 0,
  maxzoom: maxZooms.departement,
  paint: {
    'line-color': '#ccc',
  }
};

const communeLayer = {
  id: 'commune',
  source: 'haiti',
  'source-layer': 'commune',
  type: 'fill',
  minzoom: maxZooms.departement,
  maxzoom: maxZooms.commune,
  paint: {
    'fill-color': '#ccc',
    'fill-opacity': .5
  }
};

const communeLineLayer = {
  id: 'commune-line',
  source: 'haiti',
  'source-layer': 'commune',
  type: 'line',
  minzoom: maxZooms.departement,
  maxzoom: maxZooms.commune,
  paint: {
    'line-color': '#ccc',
  }
};

const sectionLayer = {
  id: 'section',
  source: 'haiti',
  'source-layer': 'section',
  type: 'fill',
  minzoom: maxZooms.commune,
  paint: {
    'fill-color': '#ccc',
    'fill-opacity': .5
  }
};

const sectionLineLayer = {
  id: 'section-line',
  source: 'haiti',
  'source-layer': 'section',
  type: 'line',
  minzoom: maxZooms.commune,
  paint: {
    'line-color': '#ccc',
  }
};

/*

*** DATA VARIABLES AND METHODS ***

*/

let measures;
let currentMeasure;
let currentMeasureName = 'hdvi';
let currentUnit = 'departement';

const apiBase = 'https://simast.herokuapp.com/v1/data/query/';

const cachedData = {};
let currentData = null;

let choroplethBreaks = [.1, .2, .3, .4];
const categoricalColors = d3.schemeSet3;
const choroplethColors = d3.schemeBlues[5];
let fillStyle = '#ccc';

const updateChoroplethStyle = () => {

}

const updateMap = () => {
  let idProp = 'id';

  const mapData = {};
  const allVals = [];
  Object.values(currentData).forEach((d) => {
    mapData[d.id] = d.value;
    allVals.push(d.value);
  });

  if (currentMeasure.type !== 'list') {
    const extent = d3.extent(allVals);
    const scale = d3.scaleQuantize().domain(d3.extent(allVals)).range(choroplethColors).nice();
    choroplethBreaks = scale.thresholds();
    fillStyle = ['case',
      ['==', ['get', ['to-string', ['get', idProp]], ['literal', mapData]], null], '#ccc',
      ['<', ['get', ['to-string', ['get', idProp]], ['literal', mapData]], choroplethBreaks[0]], choroplethColors[0],
      ['<', ['get', ['to-string', ['get', idProp]], ['literal', mapData]], choroplethBreaks[1]], choroplethColors[1],
      ['<', ['get', ['to-string', ['get', idProp]], ['literal', mapData]], choroplethBreaks[2]], choroplethColors[2],
      ['<', ['get', ['to-string', ['get', idProp]], ['literal', mapData]], choroplethBreaks[3]], choroplethColors[3],
      choroplethColors[4]
    ];

    map.setPaintProperty(currentUnit, 'fill-color', fillStyle);

    const swatches = d3.select('#map-legend').selectAll('.legend-swatch')
      .data(choroplethBreaks.concat(null))
    swatches.enter()
      .append('div')
      .attr('class', 'legend-swatch')
      .append('span');
    swatches.exit().remove();

    d3.select('#map-legend').selectAll('.legend-swatch')
      .classed('categorical', false)
      .style('background-color', (d, i) => choroplethColors[i])
      .select('span')
      .html((d, i) => i === choroplethBreaks.length ? '' : d3.format('2~r')(d));
  } else {
    fillStyle = ['case',
      ['==', ['get', ['to-string', ['get', idProp]], ['literal', mapData]], null], '#ccc'
    ];

    currentMeasure.values.forEach((value, i) => {
      if (i >= categoricalColors.length) return; // for now just skip an excessive number of categories
      fillStyle.push(['==', ['round', ['get', ['to-string', ['get', idProp]], ['literal', mapData]]], i + 1], categoricalColors[i]);
    });
    fillStyle.push('#ccc');

    map.setPaintProperty(currentUnit, 'fill-color', fillStyle);

    const swatches = d3.select('#map-legend').selectAll('.legend-swatch')
      .data(currentMeasure.values)
    swatches.enter()
      .append('div')
      .attr('class', 'legend-swatch')
      .append('span');
    swatches.exit().remove();

    d3.select('#map-legend').selectAll('.legend-swatch')
      .classed('categorical', true)
      .style('background-color', (d, i) => categoricalColors[i])
      .select('span')
      .html(d => d);
  }
};

const requestData = () => {
  if (cachedData[currentMeasureName]) {
    currentData = cachedData[currentMeasureName];
    updateMap();
  } else {
    $('#loading').show();
    d3.json(`${apiBase}${currentMeasureName}`, {
      method: 'POST'
    }).then((json) => { 
      if (!cachedData[currentMeasureName]) cachedData[currentMeasureName] = {};
      const indexedData = {};
      Object.values(json).forEach((level) => {
        level.forEach((d) => {
          indexedData[d.id] = d;
        })

      })
      cachedData[currentMeasureName] = indexedData;
      currentData = indexedData;
      updateMap();
      $('#loading').hide();
    });
  }
}

const getMeasures = () => {
  d3.json('https://simast.herokuapp.com/v1/data/fields').then((json) => {
    measures = json;
    d3.select('#measure-dropdown .dropdown-menu').selectAll('a')
      .data(measures)
      .enter()
      .append('a')
      .attr('class', 'dropdown-item')
      .attr('href', '#')
      .html(d => d.label)
      .on('click', (d) => { updateMeasure(d); });

    currentMeasure = measures.find(d => d.key === 'hdvi');
    currentMeasureName = currentMeasure.key;
    updateMeasure(currentMeasure);
  });
}

const updateMeasure = (measure) => {
  currentMeasure = measure;
  currentMeasureName = measure.key;
  $('#measure-name').html(currentMeasure.label);
  requestData();
};

const updateUnit = (unit) => {
  currentUnit = unit;
  map.setPaintProperty(currentUnit, 'fill-color', fillStyle);
}

/*

*** PROBE METHODS ***

*/

const handleMousemove = (e) => {
  if (e.features.length) {
    const feature = e.features[0];
    const { pageX, pageY } = e.originalEvent;
    showProbe([pageX, pageY], feature.properties.name);        
  }
}

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
    .addLayer(departementLayer)
    .addLayer(communeLayer)
    .addLayer(sectionLayer)
    .addLayer(departementLineLayer)
    .addLayer(communeLineLayer)
    .addLayer(sectionLineLayer)
    // probe mouse events
    .on('mousemove', 'departement', handleMousemove)
    .on('mouseout', 'departement', hideProbe)
    .on('mousemove', 'commune', handleMousemove)
    .on('mouseout', 'commune', hideProbe)
    .on('mousemove', 'section', handleMousemove)
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

    getMeasures();
};

map.on('load', init);
