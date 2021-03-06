/* global mapboxgl */
/* global $ */


function getUrlVars() {
  var vars = {};
  var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m,key,value) {
      vars[key] = value;
  });
  return vars;
}

const urlParams = getUrlVars();

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
  section: 10,
  grid: 12
};

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/light-v10',
  minZoom: 4,
  maxZoom: 14,
  maxBounds: extent,
  bounds: extent,
});

map.scrollZoom.disable();
map.doubleClickZoom.disable();

const geoSource = {
  type: 'vector',
  url: 'mapbox://axismaps.ciifdnvd'
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
    'fill-opacity': .5,
    'fill-outline-color': '#ccc'
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
    'line-color': '#000',
    'line-opacity': [
      'case',
      ['boolean', ['feature-state', 'hover'], false],
      1,
      0
    ]
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
    'fill-opacity': .5,
    'fill-outline-color': '#ccc'
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
    'line-color': '#000',
    'line-opacity': [
      'case',
      ['boolean', ['feature-state', 'hover'], false],
      1,
      0
    ]
  }
};

const sectionLayer = {
  id: 'section',
  source: 'haiti',
  'source-layer': 'section',
  type: 'fill',
  minzoom: maxZooms.commune,
  maxzoom: maxZooms.section,
  paint: {
    'fill-color': '#ccc',
    'fill-opacity': .5,
    'fill-outline-color': '#ccc'
  }
};

const sectionLineLayer = {
  id: 'section-line',
  source: 'haiti',
  'source-layer': 'section',
  type: 'line',
  minzoom: maxZooms.commune,
  paint: {
    'line-color': '#000',
    'line-opacity': [
      'case',
      ['boolean', ['feature-state', 'hover'], false],
      1,
      0
    ]
  }
};

const gridSource = {
  type: 'geojson',
  data: {
    type: 'FeatureCollection',
    features: [],
  }
};

const gridLayer = {
  id: 'grid',
  source: 'grid-source',
  type: 'circle',
  minzoom: maxZooms.section,
  maxzoom: maxZooms.grid,
  paint: {
    'circle-radius': [
      'sqrt',
      ['get', 'count']
    ],
    'circle-opacity': .75,
    'circle-stroke-color': '#fff',
    'circle-stroke-width': 1
  }
};

const pointSource = {
  type: 'geojson',
  data: {
    type: 'FeatureCollection',
    features: [],
  }
};

const pointLayer = {
  id: 'points',
  source: 'point-source',
  type: 'circle',
  minzoom: maxZooms.grid,
  paint: {
    'circle-radius': 5,
    'circle-stroke-color': '#fff',
    'circle-stroke-width': 1
  }
};

/*

*** DATA VARIABLES AND METHODS ***

*/

let measures;
let currentMeasure;
let currentMeasureName = 'hdvi';
let currentUnit = 'departement';
let hoveredUnit = null;
let hoveredStateId = null;

const apiBase = 'https://simast.herokuapp.com/v1/data/';

const cachedData = {};
let currentData = null;

const cachedGridData = {};
let currentGridData = null;

const cachedPointData = {};
let currentPointData = null;

const tableData = {};
let currentTableData = [];

const cachedChartData = {};
let currentChartData = null;
const mainDonut = Donut()
  .value(d => d.count)
  .key(d => d.value)
  .sort((a, b) => b.value - a.value)
  .color(d => categoricalColors[d.value - 1])
  .on('mousemove', (d) => {
    const { pageX, pageY } = d3.event;
    showProbe([pageX, pageY], currentMeasure.values[d.data.value - 1], d3.format(',')(d.data.count)); 
  })
  .on('mouseout', () => { $('#probe').hide() });
d3.select('.main-donut svg')
  .call(mainDonut);

const mainHistogram = Histogram()
  .value(d => d.count)
  .on('mousemove', (d) => {
    const { pageX, pageY } = d3.event;
    showProbe([pageX, pageY], d.label, d3.format(',')(d.count)); 
  })
  .on('mouseout', () => { $('#probe').hide() });
d3.select('.main-histogram svg')
  .call(mainHistogram);

let choroplethBreaks = [.1, .2, .3, .4];
const categoricalColors = d3.schemeSet3.concat(d3.schemeSet1);
const choroplethColors = d3.schemeBlues[5];
let fillStyle = '#ccc';

let filters = [];

const updateChoroplethLegend = () => {
  if (currentMeasure.type !== 'list') {
    $('#map-legend').css('max-height', '');
    let swatches = d3.select('#map-legend').selectAll('.legend-swatch')
      .data(choroplethBreaks.concat(null))
    const newSwatches = swatches.enter()
      .insert('div', '.main-histogram')
      .attr('class', 'legend-swatch')
    newSwatches.append('div').attr('class', 'swatch');
    newSwatches.append('div').attr('class', 'dash');
    newSwatches.append('span');
    swatches.exit().remove();

    swatches = d3.select('#map-legend').selectAll('.legend-swatch')
      .classed('categorical', false)
    swatches.select('div')
      .style('background-color', (d, i) => choroplethColors[i]);
    swatches.select('span')
      .html((d, i) => i === choroplethBreaks.length ? '' : d3.format('.2~r')(d));
  } else {
    $('#map-legend').css('max-height', `${Math.max(35 * currentMeasure.values.length / 2, 150)}px`);
    let swatches = d3.select('#map-legend').selectAll('.legend-swatch')
      .data(currentMeasure.values)
    const newSwatches = swatches.enter()
      .append('div')
      .attr('class', 'legend-swatch');
    newSwatches.append('div').attr('class', 'swatch');
    newSwatches.append('div').attr('class', 'dash');
    newSwatches.append('span');
    swatches.exit().remove();

    swatches = d3.select('#map-legend').selectAll('.legend-swatch')
      .classed('categorical', true)
    swatches.select('div.swatch')
      .style('background-color', (d, i) => categoricalColors[i]);
    swatches.select('span')
      .html(d => d);
  }  
}

[['>=', 'latitude', 19.70650777862447], ['>=', 'longitude', -72.8842700396045], ['<=', 'latitude', 19.851242477803638], ['<=', 'longitude', -72.72428163628379]]

const updatePoints = () => {
  map.getSource('point-source').setData(currentPointData);

  const scale = d3.scaleQuantize().domain([currentMeasure.min, currentMeasure.max]).range(choroplethColors).nice();
  choroplethBreaks = scale.thresholds();

  map.on('mousemove', 'points', (e) => {
    if (e.features.length) {
      const features = [...e.features];
      const feature = features[0];
      const { pageX, pageY } = e.originalEvent;
      const valText = currentMeasure.type === 'list' ? currentMeasure.values[feature.properties.value - 1] : d3.format('.2~r')(feature.properties.value);
      showProbe([pageX, pageY], currentMeasure.label, valText);   
    }
  }).on('mouseout', 'points', handleMouseout);

  if (currentMeasure.type !== 'list') {
    const fill = ['case',
      ['==', ['get', 'value'], null], '#ccc',
      ['<', ['get', 'value'], choroplethBreaks[0]], choroplethColors[0],
      ['<', ['get', 'value'], choroplethBreaks[1]], choroplethColors[1],
      ['<', ['get', 'value'], choroplethBreaks[2]], choroplethColors[2],
      ['<', ['get', 'value'], choroplethBreaks[3]], choroplethColors[3],
      choroplethColors[4]
    ];
    const maxVal = Math.sqrt(currentMeasure.max);
    map.setPaintProperty('points', 'circle-color', fill)
      .setPaintProperty('points', 'circle-radius', ['*', ['/', ['sqrt', ['get', 'value']], maxVal], 40]);
  } else {
    const fill = ['case',
      ['==', ['get', 'value'], null], '#ccc'
    ];
    currentMeasure.values.forEach((value, i) => {
      if (i >= categoricalColors.length) return; // for now just skip an excessive number of categories
      fill.push(['==', ['get', 'value'], i + 1], categoricalColors[i]);
    });
    fill.push('#ccc');
    map.setPaintProperty('points', 'circle-color', fill)
      .setPaintProperty('points', 'circle-radius', 10);
  }
  updateChoroplethLegend();
};

const updateGrid = () => {
  const allVals = currentGridData.features.map(f => f.properties.value);
  const extent = d3.extent(allVals);
  const scale = d3.scaleQuantize().domain(extent).range(choroplethColors).nice();
  choroplethBreaks = scale.thresholds();

  map.getSource('grid-source').setData(currentGridData);

  map.on('mousemove', 'grid', (e) => {
    if (e.features.length) {
      const features = [...e.features];
      features.sort((a, b) => a.properties.count - b.properties.count);
      const feature = features[0];
      const { pageX, pageY } = e.originalEvent;
      const valText = currentMeasure.type === 'list' ? currentMeasure.values[feature.properties.value - 1] : `Value: ${d3.format('.2~r')(feature.properties.value)}`;
      showProbe([pageX, pageY], feature.properties.name, `${valText}<br>Count: ${d3.format(',')(feature.properties.count)}`);      
    }
  }).on('mouseout', 'grid', handleMouseout);

  if (currentMeasure.type !== 'list') {
    const fill = ['case',
      ['==', ['get', 'value'], null], '#ccc',
      ['<', ['get', 'value'], choroplethBreaks[0]], choroplethColors[0],
      ['<', ['get', 'value'], choroplethBreaks[1]], choroplethColors[1],
      ['<', ['get', 'value'], choroplethBreaks[2]], choroplethColors[2],
      ['<', ['get', 'value'], choroplethBreaks[3]], choroplethColors[3],
      choroplethColors[4]
    ];

    map.setPaintProperty('grid', 'circle-color', fill);
  } else {
    const fill = ['case',
      ['==', ['get', 'value'], null], '#ccc'
    ];
    currentMeasure.values.forEach((value, i) => {
      if (i >= categoricalColors.length) return; // for now just skip an excessive number of categories
      fill.push(['==', ['get', 'value'], i + 1], categoricalColors[i]);
    });
    fill.push('#ccc');
    map.setPaintProperty('grid', 'circle-color', fill);
  }
  updateChoroplethLegend();
}

const updateMap = () => {
  if (currentUnit === 'points') {
    map.setPaintProperty('section', 'fill-color', '#ccc');
    updatePoints();
    return;
  }
  if (currentUnit === 'grid') {
    map.setPaintProperty('section', 'fill-color', '#ccc');
    updateGrid();
    return;
  }
  let idProp = 'id';

  const mapData = {};
  const allVals = [];
  Object.values(currentData).forEach((d) => {
    mapData[d.id] = d.value;
    allVals.push(d.value);
  });

  if (currentMeasure.type !== 'list') {
    const extent = d3.extent(allVals);
    const scale = d3.scaleQuantize().domain(extent).range(choroplethColors).nice();
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
  }
  updateChoroplethLegend();
};

const updateChart = () => {
  if (!currentChartData) return;
  if (currentMeasure.type === 'list') {
    mainDonut.data(currentChartData);
    $('.main-donut').show();
    $('.main-histogram').hide();
  } else {
    mainHistogram.data(currentChartData);
    $('.main-donut').hide();
    $('.main-histogram').show();
  }
}

const requestChoroplethData = () => {
  if (!filters.length && cachedData[currentMeasureName]) {
    currentData = cachedData[currentMeasureName];
    updateMap();
  } else {
    $('#loading').show();
    const filterBody = filters.reduce((flatArray, filter) => flatArray.concat(filter.values), []);
    d3.json(`${apiBase}query/${currentMeasureName}`, {
      method: 'POST',
      headers: {
        'Content-type': 'application/json; charset=UTF-8'
      },
      body: filterBody.length ? JSON.stringify(filterBody) : null
    }).then((json) => { 
      const indexedData = {};
      Object.values(json).forEach((level) => {
        level.forEach((d) => {
          indexedData[d.id] = d;
        })

      });
      if (!filters.length) {
        if (!cachedData[currentMeasureName]) cachedData[currentMeasureName] = {};
        cachedData[currentMeasureName] = indexedData;
      }
      
      currentData = indexedData;
      updateMap();
      $('#loading').hide();
    });
  }
}

const requestGridData = () => {
  if (!filters.length && cachedGridData[currentMeasureName]) {
    currentGridData = cachedGridData[currentMeasureName];
    updateMap();
  } else {
    $('#loading').show();
    const filterBody = filters.reduce((flatArray, filter) => flatArray.concat(filter.values), []);
    d3.json(`${apiBase}grid/${currentMeasureName}/0.025`, {
      method: 'POST',
      headers: {
        'Content-type': 'application/json; charset=UTF-8'
      },
      body: filterBody.length ? JSON.stringify(filterBody) : null
    }).then((json) => { 
      json.features.sort((a,b) => b.properties.count - a.properties.count);
      if (!filters.length) {
        if (!cachedGridData[currentMeasureName]) cachedGridData[currentMeasureName] = {};
        cachedGridData[currentMeasureName] = json;
      }
      currentGridData = json;
      
      // currentData = indexedData;
      updateMap();
      $('#loading').hide();
    });
  }
}

const requestPointData = () => {
    $('#loading').show();
    const boundsArray = [];
    const bounds = map.getBounds().toArray();
    boundsArray.push(['>=', 'longitude', bounds[0][0]]);
    boundsArray.push(['>=', 'latitude', bounds[0][1]]);
    boundsArray.push(['<=', 'longitude', bounds[1][0]]);
    boundsArray.push(['<=', 'latitude', bounds[1][1]]);
    const filterBody = filters.reduce((flatArray, filter) => flatArray.concat(filter.values), [])
      .concat(boundsArray);
    d3.json(`${apiBase}points/${currentMeasureName}`, {
      method: 'POST',
      headers: {
        'Content-type': 'application/json; charset=UTF-8'
      },
      body: filterBody.length ? JSON.stringify(filterBody) : null
    }).then((json) => { 
      currentPointData = json;
      updateMap();
      $('#loading').hide();
    });
}

const requestData = () => {
  if (map.getZoom() >= maxZooms.grid) {
    requestPointData();
  } else if (map.getZoom() >= maxZooms.section) {
    requestGridData();
  } else {
    requestChoroplethData();
  }
};

const requestChartData = (measureName = currentMeasureName, id) => {
  // store these before request, on the off chance they change before completion
  const unit = currentUnit;
  return d3.json(`${apiBase}chart/${measureName}`, {
    method: 'POST',
    headers: {
      'Content-type': 'application/json; charset=UTF-8'
    },
    body: id ? JSON.stringify([['=', unit, id]]) : null
  }).catch(console.log)
  .then((json) => {
    const measure = measures.find(m => m.key === measureName);
    const data = json.map((d, i) => Object.assign({
      label: measure.type === 'list' ?
        d.value : (i === json.length - 1 ? `${d.value}+` : `${d.value} – ${json[i + 1].value}`)
    }, d));
    if (!filters.length && !cachedChartData[measureName]) cachedChartData[measureName] = {};
    if (!filters.length && !id) cachedChartData[measureName].all = data;
    else if (!filters.length) cachedChartData[measureName][id] = data;
    return data;
  });
};

const requestTableData = (unit) => {
  const filterBody = filters.reduce((flatArray, filter) => flatArray.concat(filter.values), []);
  $('#table-loading').show();
  return d3.json(`${apiBase}table/${currentMeasureName}/${unit || currentUnit}`, {
    method: 'POST',
    headers: {
      'Content-type': 'application/json; charset=UTF-8',
    },
    body: filterBody.length ? JSON.stringify(filterBody) : null
  }).catch(console.log)
  .then((json) => {
    const numColummns = d3.max(Object.values(json).map(d => d.length));
    const cols = ['Name'].concat(Object.values(json).find(d => d.length === numColummns)
      .map(d => currentMeasure.type === 'list' ? currentMeasure.values[d.value - 1] : d.value));
    
    const headers = d3.select('#table thead tr').selectAll('th')
      .data(cols);
    
    headers.enter().append('th')
      .append('div');

    headers.exit().remove();

    d3.select('#table thead tr').selectAll('th').each(function(d, i) {
      let title;
      if (currentMeasure.type === 'list' || i === 0) {
        title = d;
      } else if (i === cols.length - 1) title = `${d}+`;
      else title = `${d}–${cols[i + 1]}`;
      d3.select(this).select('div').html(title).attr('title', title);
    });

    const rows = Object.entries(json).map(([id, data]) => [id].concat(data));
    const names = map.querySourceFeatures('haiti', {sourceLayer: unit || currentUnit})
      .reduce((indexed, feature) => {
        indexed[feature.properties.id] = feature.properties.name;
        return indexed;
      }, {});
    
    const tableRows = d3.select('#table tbody').selectAll('tr')
      .data(rows, d => d[0]);

    tableRows.enter()
      .append('tr');

    tableRows.exit().remove();

    cells = d3.selectAll('#table tbody tr')
      .selectAll('td')
      .data(d => d)
      .join('td')
      .html((d, i) => i === 0 ? names[d] : d3.format(',')(d.count));

    $('#table-loading').hide();

    return json;
  });
};

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
      .on('click', updateMeasure);

    d3.select('#filter-dropdown .dropdown-menu').selectAll('a')
      .data(measures)
      .enter()
      .append('a')
      .attr('class', 'dropdown-item')
      .attr('href', '#')
      .html(d => d.label)
      .on('click', (d) => { addFilter(d) });

    d3.select('#chart-dropdown .dropdown-menu').selectAll('a')
      .data(measures)
      .enter()
      .append('a')
      .attr('class', 'dropdown-item')
      .attr('href', '#')
      .html(d => d.label)
      .on('click', (d) => { addChart(d) });

    currentMeasure = measures.find(d => d.key === 'hdvi');
    currentMeasureName = currentMeasure.key;
    
    const charts = urlParams['charts'];
    if (charts) {
      const ids = charts.split(',');
      ids.forEach((id) => {
        const measure = measures.find(m => m.key.toLowerCase() === decodeURIComponent(id).toLowerCase());
        if (measure) addChart(measure, false);
      })
    }

    const urlFilters = urlParams['filters'];
    if (urlFilters) {
      const parsedFilters = [];
      const filts = urlFilters.split(';');
      filts.forEach((f) => {
        const decoded = decodeURIComponent(f);
        const commas = decoded.match(/,/g);
        if (!commas) {
          addFilter(measures.find(m => m.key === decoded), false);
          return;
        }
        if (commas.length < 2) {
          return;
        };
        const firstComma = decoded.indexOf(',');
        const firstArg = decoded.substring(0, firstComma);
        const secondComma = decoded.indexOf(',', firstComma + 1);
        const secondArg = decoded.substring(firstComma + 1, secondComma);
        try {
          const parsed = JSON.parse(`["${firstArg}", "${secondArg}", ${decoded.substring(secondComma + 1)}]`);
          parsedFilters.push(parsed);
        } catch (e) {
          console.log(e);
        }
      });
      const filtersByKey = {};
      parsedFilters.forEach(f => {
        const [operator, key, value] = f;
        if (!filtersByKey[key]) filtersByKey[key] = [];
        filtersByKey[key].push([operator, value]);
      });
      Object.entries(filtersByKey).forEach(([key, initialValues]) => {
        addFilter(measures.find(m => m.key === key), false, initialValues);
      });
    }

    updateMeasure(currentMeasure, true);
  });
}

const updateMeasure = (measure, retainFilters = false) => {
  currentMeasure = measure;
  currentMeasureName = measure.key;
  if (!retainFilters) {
    $('.filter-card').remove();
    filters = [];
    updateFilterDropdown();
  }
  
  $('#measure-name').html(currentMeasure.label);
  requestTableData();
  requestData();
  if (cachedChartData[currentMeasureName]) {
    currentChartData = cachedChartData[currentMeasureName].all;
    updateChart();
  } else {
    requestChartData().then((json) => {
      currentChartData = json;
      updateChart();
    });
  }
  
};

const updateUnit = (unit) => {
  currentUnit = unit;
  if (unit === 'grid' || unit == 'points') {
    requestData();
    $('#table').hide();
  } else {
    map.setPaintProperty(currentUnit, 'fill-color', fillStyle);
    $('#table').show();
    requestTableData();
  }
  map.resize();
}

/*

*** PROBE METHODS ***

*/

const handleMousemove = (e) => {
  if (currentUnit === 'grid') return;
  if (e.features.length) {
    const feature = e.features[0];
    const { pageX, pageY } = e.originalEvent;
    const d = currentData[feature.properties.id];
    let formatted;
    if (d === undefined) formatted = 'N/A';
    else {
      if (currentMeasure.type === 'list') {
        formatted = currentMeasure.values[Math.round(d.value) - 1];
      } else {
        formatted = d3.format('.2~r')(d.value);
      }
    }

    if (hoveredStateId) {
      map.setFeatureState(
        { source: 'haiti', sourceLayer: `${currentUnit}`, id: hoveredStateId },
        { hover: false }
      );
    }
    hoveredStateId = feature.id;
    map.setFeatureState(
      { source: 'haiti', sourceLayer: `${currentUnit}`, id: hoveredStateId },
      { hover: true }
    );
    showProbe([pageX, pageY], feature.properties.name, `<strong>${currentMeasure.label}:</strong> ${formatted}`);        
    
    // get chart data
    if (hoveredUnit !== feature.properties.id) {
      hoveredUnit = feature.properties.id;
      if (!currentData[feature.properties.id]) {
        // no data. return to overview chart
        hoveredUnit = null;
        if (!cachedChartData[currentMeasureName]) return;
        currentChartData = cachedChartData[currentMeasureName].all;
        updateChart();
      } else if (!cachedChartData[currentMeasureName] || !cachedChartData[currentMeasureName][hoveredUnit]) {
        // need to fetch chart data for this unit
        requestChartData(currentMeasureName, hoveredUnit).then((json) => {
          // hover may have changed by now; only draw chart if still current
          if (hoveredUnit === feature.properties.id) {
            currentChartData = json;
            updateChart();
          }
        });
      } else {
        // chart data has previously been cached
        currentChartData = cachedChartData[currentMeasureName][hoveredUnit];
        updateChart();
      }
    }
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

const handleMouseout = () => {
  hoveredUnit = null;
  if (cachedChartData[currentMeasureName]) {
    currentChartData = cachedChartData[currentMeasureName].all;
    updateChart();
  }
  if (hoveredStateId) {
    map.setFeatureState(
      { source: 'haiti', sourceLayer: `${currentUnit}`, id: hoveredStateId },
      { hover: false }
    );
  }
  hoveredStateId = null;
  
  $('#probe').hide();
}

const handleClick = (e) => {
  const [feature] = e.features;
  map.fitBounds(turf.bbox(feature.geometry), { maxZoom: maxZooms[currentUnit] + 0.1 });
}

/*

*** FILTER METHODS ***

*/

const updateFilterDropdown = () => {
  d3.selectAll('#filter-dropdown .dropdown-item')
    .style('display', (d) => {
      if (currentMeasure.key === d.key) return 'none';
      if (filters.find(f => f.key === d.key)) return 'none';
      return 'block';
    })
};

const addFilter = (measure, closeable = true, initialValues) => {
  if (!measure) return;
  const filterCard = $('<div>')
    .attr('class', 'card filter-card small d-flex flex-column my-3 px-2 pb-2 pt-3')
    .attr('data-measure', measure.key)
    .appendTo('#filters .sidebar-content-inner');

  $('<h6>')
    .attr('class', 'card-title pr-3')
    .html(measure.label)
    .appendTo(filterCard);

  const filterContent = $('<div>')
    .attr('class', 'filter-content d-flex flex-column justify-content-center')
    .appendTo(filterCard);

  if (closeable) {
    $('<i>')
      .attr('class', 'fa fa-times')
      .appendTo(filterCard)
      .on('click', () => {
        removeFilter(measure.key);
      });
  }
  
  if (measure.type !== 'list') {
    const values = [measure.min, measure.max];
    if (initialValues) {
      const min = initialValues.find(v => v[0] === '>' || v[0] === '>=');
      if (min) values[0] = min[1];
      const max = initialValues.find(v => v[0] === '<' || v[0] === '<=');
      if (max) values[1] = max[1];
    }
    const subtitle = $('<h6>')
      .attr('class', 'card-subtitle text-muted text-center')
      .html(`${values[0]} – ${values[1]}`)
      .insertBefore(filterContent);
      
    $('<input>')
      .attr('class', 'slider')
      .appendTo(filterContent)
      .slider({
        min: measure.min,
        max: measure.max,
        value: values,
        ticks: [measure.min, measure.max],
        ticks_labels: [measure.min, measure.max],
        tooltip: 'always',
        tooltip_split: true
      })
      .on('change', (e) => {
        const { value } = e;
        subtitle.html(value.newValue.join(' – '));
      })
      .on('slideStop', (e) => {
        const { value } = e;
        const filter = filters.find(f => f.key === measure.key);
        if (!filter) return;
        filter.values = [['>=', measure.key, value[0]], ['<=', measure.key, value[1]]];
        requestData();
        requestTableData();
      });

    filters.push({ key: measure.key, values: [['>=', measure.key, values[0]], ['<=', measure.key, values[1]]] });
  } else {
    let values = d3.range(1, measure.values.length + 1);
    if (initialValues) {
      values = initialValues[0][1];
    }
    d3.select(filterContent[0]).selectAll('div')
      .data(measure.values)
      .enter()
      .append('div')
      .attr('class', 'form-check')
      .append('label')
      .html(d => `<span>${d}</span>`)
      .insert('input', ':first-child')
      .attr('checked', (d, i) => values.includes(i + 1) ? 1 : null)
      .attr('type', 'checkbox')
      .attr('class', 'form-check-input')
      .on('change', () => {
        const filter = filters.find(f => f.key === measure.key);
        if (!filter) return;
        const vals = [];
        d3.select(filterContent[0]).selectAll('div.form-check input')
          .each(function(d, i) {
            if (this.checked) {
              vals.push(i + 1);
            }
          });
        if (vals.length) {
          filter.values = [['=', measure.key, vals]];
        } else {
          filter.values = [['=', measure.key, d3.range(1, measure.values.length + 1)]];
        }
        requestData();
        requestTableData();
      });

      filters.push({ key: measure.key, values: [['=', measure.key, values]] });
  }
  updateFilterDropdown();
};

const removeFilter = (key) => {
  filters = filters.filter(d => d.key !== key);
  $(`.filter-card[data-measure="${key}"]`).remove();
  updateFilterDropdown();
  requestData();
  requestTableData();
}

/*

*** CHART UI METHODS ***

*/

const addChart = (measure, closeable = true) => {
  const chartCard = $('<div>')
    .attr('class', 'card chart-card small d-flex flex-column my-3 px-2 pb-2 pt-3')
    .attr('data-measure', measure.key)
    .appendTo('#charts .sidebar-content-inner');

  $('<h6>')
    .attr('class', 'card-title pr-3')
    .html(measure.label)
    .appendTo(chartCard);

  const chartContent = $('<div>')
    .attr('class', 'filter-content d-flex flex-column justify-content-center')
    .appendTo(chartCard);

  if (closeable) {
    $('<i>')
      .attr('class', 'fa fa-times')
      .appendTo(chartCard)
      .on('click', () => {
        removeChart(measure.key);
      });
  }
  
  let chartData;

  const drawChart = () => {
    if (measure.type === 'list') {
      const donut = Donut()
        .value(d => d.count)
        .key(d => d.value)
        .sort((a, b) => b.value - a.value)
        .color(d => categoricalColors[d.value - 1])
        .data(chartData)
        .on('mousemove', (d) => {
          const { pageX, pageY } = d3.event;
          showProbe([pageX, pageY], measure.values[d.data.value - 1], d3.format(',')(d.data.count)); 
        })
        .on('mouseout', () => { $('#probe').hide() });

      d3.select(chartContent[0]).append('svg')
        .attr('width', 130)
        .attr('height', 130)
        .attr('class', 'align-self-center')
        .call(donut);

      const legend = d3.select(chartContent[0]).append('div')
        .attr('class', 'chart-legend d-flex flex-column flex-wrap');

      let swatches = legend.selectAll('.legend-swatch')
        .data(measure.values)
      const newSwatches = swatches.enter()
        .append('div')
        .attr('class', 'legend-swatch categorical')
      newSwatches.append('div')
        .attr('class', 'swatch')
        .style('background-color', (d, i) => categoricalColors[i])
      newSwatches.append('div').attr('class', 'dash')
      newSwatches.append('span').html(d => d);
      swatches.exit().remove();
    } else {
      const histogram = Histogram()
        .value(d => d.count)
        .data(chartData)
        .on('mousemove', (d) => {
          const { pageX, pageY } = d3.event;
          showProbe([pageX, pageY], d.label, d3.format(',')(d.count)); 
        })
        .on('mouseout', () => { $('#probe').hide() });

      d3.select(chartContent[0]).append('svg')
        .attr('width', 270)
        .attr('height', 100)
        .call(histogram);
    }
  }

  if (cachedChartData[measure.key]) {
    chartData =  cachedChartData[measure.key].all;
    drawChart();
  } else {
    requestChartData(measure.key)
      .then((json) => {
        chartData = json;
        drawChart();
      });
  }
}

const removeChart = (key) => {
  $(`.chart-card[data-measure="${key}"]`).remove();
}
  
/*

*** INITIALIZATION AND EVENTS ***

*/

const init = () => {
  map.addSource('haiti', geoSource)
    .addSource('grid-source', gridSource)
    .addSource('point-source', pointSource)
    .addLayer(departementLayer, 'road-label')
    .addLayer(communeLayer, 'road-label')
    .addLayer(sectionLayer, 'road-label')
    .addLayer(departementLineLayer, 'road-label')
    .addLayer(communeLineLayer, 'road-label')
    .addLayer(sectionLineLayer, 'road-label')
    .addLayer(gridLayer, 'road-label')
    .addLayer(pointLayer, 'road-label')
    // mouse events
    .on('mousemove', 'departement', handleMousemove)
    .on('mouseout', 'departement', handleMouseout)
    .on('click', 'departement', handleClick)
    .on('mousemove', 'commune', handleMousemove)
    .on('mouseout', 'commune', handleMouseout)
    .on('click', 'commune', handleClick)
    .on('mousemove', 'section', handleMousemove)
    .on('mouseout', 'section', handleMouseout)
    .on('click', 'section', handleClick)
    // zoom event: update geography level
    .on('zoomend', () => {
      const z = map.getZoom();
      if (z <= maxZooms.departement && currentUnit !== 'departement') {
        updateUnit('departement');
      } else if (z > maxZooms.departement && z <= maxZooms.commune && currentUnit !== 'commune') {
        updateUnit('commune');
      } else if (z > maxZooms.commune && z <= maxZooms.section && currentUnit !== 'section') {
        updateUnit('section');
      } else if (z > maxZooms.section && z <= maxZooms.grid && currentUnit !== 'grid') {
        updateUnit('grid');
      } else if (z > maxZooms.grid && currentUnit !== 'points') {
        updateUnit('points');
      }
    })
    .on('moveend', () => {
      if (currentUnit === 'points') requestData();
    });

  getMeasures();

  $('#sidebar-nav .nav-link').click(function() {
    $('#sidebar-nav .nav-link').removeClass('active');
    $('.charts, .filters').removeClass('d-flex').addClass('d-none');
    $(this).addClass('active');
    const content = $(this).parent().attr('data-content');
    $(`.${content}`).addClass('d-flex');
  });

  $('input.slider').slider({
    value: [2, 5]
  });

  $('.zoom .dropdown-item').click((e) => {
    map.zoomTo($(e.target).attr('data-zoom'));
  })
};

map.on('load', init);
