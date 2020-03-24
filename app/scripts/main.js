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
  section: 10,
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
  maxZoom: maxZooms.section,
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

/*

*** DATA VARIABLES AND METHODS ***

*/

let measures;
let currentMeasure;
let currentMeasureName = 'hdvi';
let currentUnit = 'departement';
let hoveredUnit = null;

const apiBase = 'https://simast.herokuapp.com/v1/data/';

const cachedData = {};
let currentData = null;

const cachedGridData = {};
let currentGridData = null;

const cachedChartData = {};
let currentChartData = null;
const mainDonut = Donut()
  .value(d => d.count)
  .key(d => d.value)
  .sort((a, b) => b.value - a.value)
  .color(d => categoricalColors[d.value - 1]);
d3.select('.main-donut svg')
  .call(mainDonut);

const mainHistogram = Histogram()
  .value(d => d.count)
d3.select('.main-histogram svg')
  .call(mainHistogram);

let choroplethBreaks = [.1, .2, .3, .4];
const categoricalColors = d3.schemeSet3.concat(d3.schemeSet1);
const choroplethColors = d3.schemeBlues[5];
let fillStyle = '#ccc';

let filters = [];

const updateChoroplethLegend = () => {
  if (currentMeasure.type !== 'list') {
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
      .html((d, i) => i === choroplethBreaks.length ? '' : d3.format('.2~r')(d));
  } else {
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
}

const updateGrid = () => {
  gridSource.data = currentGridData;
  const allVals = currentGridData.features.map(f => f.properties.value);
  const extent = d3.extent(allVals);
  const scale = d3.scaleQuantize().domain(extent).range(choroplethColors).nice();
  choroplethBreaks = scale.thresholds();
  if (map.getLayer('grid')) map.removeLayer('grid');
  if (map.getSource('grid-source')) {
    map.removeSource('grid-source');
  }

  map.addSource('grid-source', gridSource);
  map.addLayer(gridLayer);

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
      // const indexedData = {};
      // Object.values(json).forEach((level) => {
      //   level.forEach((d) => {
      //     indexedData[d.id] = d;
      //   })

      // });
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

const requestData = () => {
  if (map.getZoom() >= 10) {
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
    if (!cachedChartData[measureName]) cachedChartData[measureName] = {};
    if (!id) cachedChartData[measureName].all = json;
    else cachedChartData[measureName][id] = json;
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
      .on('click', addFilter);

    d3.select('#chart-dropdown .dropdown-menu').selectAll('a')
      .data(measures)
      .enter()
      .append('a')
      .attr('class', 'dropdown-item')
      .attr('href', '#')
      .html(d => d.label)
      .on('click', addChart);

    currentMeasure = measures.find(d => d.key === 'hdvi');
    currentMeasureName = currentMeasure.key;
    updateMeasure(currentMeasure);
  });
}

const updateMeasure = (measure) => {
  currentMeasure = measure;
  currentMeasureName = measure.key;
  $('.filter-card').remove();
  filters = [];
  updateFilterDropdown();
  $('#measure-name').html(currentMeasure.label);
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
  if (unit === 'grid') {
    requestData();
  } else {
    map.setPaintProperty(currentUnit, 'fill-color', fillStyle);
  }
  
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
    showProbe([pageX, pageY], feature.properties.name, `${currentMeasure.label}: ${formatted}`);        
    
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
  
  $('#probe').hide();
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

const addFilter = (measure) => {
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

  $('<i>')
    .attr('class', 'fa fa-times')
    .appendTo(filterCard)
    .on('click', () => {
      removeFilter(measure.key);
    });

  if (measure.type !== 'list') {
    const subtitle = $('<h6>')
      .attr('class', 'card-subtitle text-muted text-center')
      .html(`${measure.min} – ${measure.max}`)
      .insertBefore(filterContent);
      
    $('<input>')
      .attr('class', 'slider')
      .appendTo(filterContent)
      .slider({
        min: measure.min,
        max: measure.max,
        value: [measure.min, measure.max],
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
      });

    filters.push({ key: measure.key, values: [['>=', measure.key, measure.min], ['<=', measure.key, measure.max]] });
  } else {
    d3.select(filterContent[0]).selectAll('div')
      .data(measure.values)
      .enter()
      .append('div')
      .attr('class', 'form-check')
      .append('label')
      .html(d => `<span>${d}</span>`)
      .insert('input', ':first-child')
      .attr('checked', 1)
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
      });

      filters.push({ key: measure.key, values: [['=', measure.key, d3.range(1, measure.values.length + 1)]] });
  }
  updateFilterDropdown();
};

const removeFilter = (key) => {
  filters = filters.filter(d => d.key !== key);
  $(`.filter-card[data-measure="${key}"]`).remove();
  updateFilterDropdown();
  requestData();
}

/*

*** CHART UI METHODS ***

*/

const addChart = (measure) => {
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

  $('<i>')
    .attr('class', 'fa fa-times')
    .appendTo(chartCard)
    .on('click', () => {
      removeChart(measure.key);
    });

  let chartData;

  const drawChart = () => {
    if (measure.type === 'list') {
      const donut = Donut()
        .value(d => d.count)
        .key(d => d.value)
        .sort((a, b) => b.value - a.value)
        .color(d => categoricalColors[d.value - 1])
        .data(chartData);

      d3.select(chartContent[0]).append('svg')
        .attr('width', 130)
        .attr('height', 130)
        .call(donut);
    } else {
      const histogram = Histogram()
        .value(d => d.count)
        .data(chartData);

      d3.select(chartContent[0]).append('svg')
        .attr('width', 270)
        .attr('height', 120)
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
    .addLayer(departementLayer, 'road-label')
    .addLayer(communeLayer, 'road-label')
    .addLayer(sectionLayer, 'road-label')
    .addLayer(departementLineLayer, 'road-label')
    .addLayer(communeLineLayer, 'road-label')
    .addLayer(sectionLineLayer, 'road-label')
    // mouse events
    .on('mousemove', 'departement', handleMousemove)
    .on('mouseout', 'departement', handleMouseout)
    .on('mousemove', 'commune', handleMousemove)
    .on('mouseout', 'commune', handleMouseout)
    .on('mousemove', 'section', handleMousemove)
    .on('mouseout', 'section', handleMouseout)
    // zoom event: update geography level
    .on('zoomend', () => {
      const z = map.getZoom();
      if (z <= maxZooms.departement && currentUnit !== 'departement') {
        updateUnit('departement');
      } else if (z > maxZooms.departement && z <= maxZooms.commune && currentUnit !== 'commune') {
        updateUnit('commune');
      } else if (z > maxZooms.commune && z <= maxZooms.section && currentUnit !== 'section') {
        updateUnit('section');
      } else if (z > maxZooms.section && currentUnit !== 'grid') {
        updateUnit('grid');
      }
    });

  getMeasures();

  $('#sidebar-nav .nav-link').click(function() {
    $('#sidebar-nav .nav-link').removeClass('active');
    $('.sidebar-content').removeClass('d-flex').addClass('d-none');
    $(this).addClass('active');
    const content = $(this).parent().attr('data-content');
    $(`#${content}`).removeClass('d-none').addClass('d-flex');
  });

  $('input.slider').slider({
    value: [2, 5]
  });
};

map.on('load', init);
