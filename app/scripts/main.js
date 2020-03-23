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
let hoveredUnit = null;

const apiBase = 'https://simast.herokuapp.com/v1/data/';

const cachedData = {};
let currentData = null;

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
      .html((d, i) => i === choroplethBreaks.length ? '' : d3.format('.2~r')(d));
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

const updateChart = () => {
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

const requestData = () => {
  if (!filters.length && cachedData[currentMeasureName]) {
    currentData = cachedData[currentMeasureName];
    updateMap();
  } else {
    $('#loading').show();
    const filterBody = filters.reduce((flatArray, filter) => flatArray.concat(filter.values), []);
    d3.json(`${apiBase}/query/${currentMeasureName}`, {
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
};

const requestChartData = (id) => {
  // store these before request, on the off chance they change before completion
  const unit = currentUnit;
  const measure = currentMeasureName;
  return d3.json(`${apiBase}/chart/${currentMeasureName}`, {
    method: 'POST',
    headers: {
      'Content-type': 'application/json; charset=UTF-8'
    },
    body: id ? JSON.stringify([['=', unit, id]]) : null
  }).then((json) => {
    if (!cachedChartData[measure]) cachedChartData[measure] = {};
    if (!id) cachedChartData[measure].all = json;
    else cachedChartData[measure][id] = json;
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
  map.setPaintProperty(currentUnit, 'fill-color', fillStyle);
}

/*

*** PROBE METHODS ***

*/

const handleMouseover = (e) => {
  if (e.features.length) {
    const feature = e.features[0];
    hoveredUnit = feature.properties.id;
    if (!cachedChartData[currentMeasureName] || !cachedChartData[currentMeasureName][hoveredUnit]) {
      requestChartData(hoveredUnit);
    }
  }
}

const handleMousemove = (e) => {
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
  hoveredUnit = null;
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
    .on('mouseover', 'departement', handleMouseover)
    .on('mousemove', 'departement', handleMousemove)
    .on('mouseout', 'departement', hideProbe)
    .on('mouseover', 'commune', handleMouseover)
    .on('mousemove', 'commune', handleMousemove)
    .on('mouseout', 'commune', hideProbe)
    .on('mouseover', 'section', handleMouseover)
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
