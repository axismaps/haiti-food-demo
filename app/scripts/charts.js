const Donut = function(){

/*
  example syntax:

  var donut = Donut()
    .data( [10,20,30] )
    .innerRadius( 50 )
    .outerRadius( 75 );
  d3.select( 'svg' )
    .append( 'g' )
    .call( donut );

  donut.data( [20,30,40] );  // update with new data

  donut.outerRadius( 100 ); // change size
*/

  var container,
    _g,
    _data,
    _outerRadius = 60,
    _innerRadius = 24,
    _offset = 5, //add a slight offset from the default position
    _valueFunc = function(d){ return d },
    _sortFunc,
    _colorFunc = function(){ return '#377eb8' },
    _strokeFunc = function(){ return '#fff' },
    _keyFunc,
    _transition = true,
    _duration = 750;

  var arc = d3.arc()
    .outerRadius(_outerRadius)
    .innerRadius(_innerRadius);

  var pie = d3.pie()
    .sort(null);

  var path;

  function dnut(g){
    container = g;
    create();
  }

  // data array
  dnut.data = function( d ){
    if ( !arguments.length ) return _data;
    _data = d;
    draw();
    return dnut;
  }

  dnut.outerRadius = function( r ){
    if ( !arguments.length ) return _outerRadius;
    _outerRadius = r;
    arc.outerRadius( r );
    if ( _g ) _g.attr( 'transform', 'translate(' + (_outerRadius + _offset) + ',' + (_outerRadius + _offset) + ')' );
    draw();
    return dnut;
  }

  dnut.innerRadius = function( r ){
    if ( !arguments.length ) return _innerRadius;
    _innerRadius = r;
    arc.innerRadius( r );
    draw();
    return dnut;
  }

  // value accessor function, e.g. function(d){ return d.immigrants }
  dnut.value = function( v ){
    if ( !arguments.length ) return _valueFunc;
    _valueFunc = v;
    pie.value( _valueFunc );
    draw();
    return dnut;
  }

  // sort function, e.g. function(a,b) {return (a.continent > b.continent) ? 1 : ((b.continent > a.continent) ? -1 : 0); }
  // note: for migration map it may be best to pre-sort data instead of using this
  dnut.sort = function( s ){
    if ( !arguments.length ) return _sortFunc;
    _sortFunc = s;
    pie.sort( _sortFunc );
    draw();
    return dnut;
  }

  // color function to determine 'fill' attr, e.g. function(d){ return colorScale(d.continent) }
  dnut.color = function( c ){
    if ( !arguments.length ) return _colorFunc;
    if (typeof c === 'function') _colorFunc = c;
    else _colorFunc = function () { return c };
    draw();
    return dnut;
  }

  // similar to above, but for stroke
  dnut.stroke = function( s ){
    if ( !arguments.length ) return _strokeFunc;
    _strokeFunc = s;
    draw();
    return dnut;
  }

  // key function for joining data, e.g. function(d){ return d.originName }
  dnut.key = function( k ){
    if ( !arguments.length ) return _keyFunc;
    _keyFunc = k;
    draw();
    return dnut;
  }

  dnut.attr = function( name, value ){
    if ( !path ) return null;
    if ( arguments.length == 1 ){
      var arr = [];
      path.each(function(){
        arr.push( d3.select(this).attr(name) );
      });
      return arr;
    }
    path
      .attr( name, value );
    path.select('path')
      .attr( name, value );
    path.classed( 'arc', true );
    path.select('path').classed( 'arc', true );
    return dnut;
  }

  dnut.transition = function( bool ){
    if ( !arguments.length ) return _transition;
    _transition = bool;
    return dnut;
  }

  dnut.duration = function( d ){
    if ( !arguments.length ) return _duration;
    _duration = d;
    return dnut;
  }

  function create(){
    if ( !container ) return;
    if ( _g ) _g.remove();
    _g = container.append( 'g' )
      .attr( 'class', 'donut' )
      .attr( 'transform', 'translate(' + (_outerRadius + _offset) + ',' + (_outerRadius + _offset) + ')' );
    path = _g.selectAll('a');
    draw();
  }

  function draw(){
    if ( !_g || !_data ) return;

    // http://bl.ocks.org/mbostock/5681842

    path = path.data(pie(_data), _keyFunc ? function(d){ return _keyFunc(d.data) } : undefined );

    path.exit().remove();

    path.enter().append('a')
        .append( 'path' )
        .each(function(d, i) { this._current = d; });

    path = _g.selectAll('a');

    path.select('path')
        .attr('fill',function(d){ return _colorFunc(d.data) })
        .attr('stroke',function(d){ return _strokeFunc(d.data) });
    if ( _transition ){
      path.select('path').transition()
        .style( 'display', 'block' )
        .duration( _duration )
        .attrTween('d', arcTween)
        .on('end',function(d){
          if ( !_valueFunc(d.data) ) d3.select(this).style('display','none');
        });
    } else {
      path.select('path')
        .each(function(d, i) { this._current = d; })
        .style( 'display', 'block' )
        .attr('d', arc)
        .style( 'display', function(d){
          if ( !_valueFunc(d.data) ) return 'none';
          return 'block';
        });
    }
        
  }

  function arcTween(d) {
    var i = d3.interpolate(this._current, d);
    this._current = i(0);
    return function(t) { return arc(i(t)); };
  }

  return dnut;
}

const Histogram = function (){
  var container,
    _g,
    _data,
    _maxHeight = 60,
    _minHeight = 5,
    _width = 200,
    _offset = 5, //add a slight offset from the default position
    _valueFunc = function(d){ return d },
    _colorFunc = function(){ return '#999' },
    _strokeFunc = function(){ return '#fff' },
    _keyFunc,
    _transition = true,
    _duration = 750;

  var heightScale = d3.scaleLinear()
    .range([0, _minHeight, _maxHeight]);

  var yScale = d3.scaleLinear()
    .range([_maxHeight, _maxHeight - _minHeight, 0]);

  var rect;

  var binWidth = 5;

  function histo(g){
    container = g;
    create();
  }

  // data array
  histo.data = function( d ){
    if ( !arguments.length ) return _data;
    _data = d;
    binWidth = Math.min(60, _width / d.length) - 2;
    const domain = [0].concat(d3.extent(_data, _valueFunc));
    heightScale.domain(domain);
    yScale.domain(domain);
    draw();
    return histo;
  }

  // value accessor function, e.g. function(d){ return d.immigrants }
  histo.value = function( v ){
    if ( !arguments.length ) return _valueFunc;
    _valueFunc = v;
    if (_data) {
      heightScale.domain(d3.extent(_data, _valueFunc));
      yScale.domain(d3.extent(_data, _valueFunc));
    }
    draw();
    return histo;
  }

  // sort function, e.g. function(a,b) {return (a.continent > b.continent) ? 1 : ((b.continent > a.continent) ? -1 : 0); }
  // note: for migration map it may be best to pre-sort data instead of using this
  histo.sort = function( s ){
    if ( !arguments.length ) return _sortFunc;
    _sortFunc = s;
    pie.sort( _sortFunc );
    draw();
    return histo;
  }

  // color function to determine 'fill' attr, e.g. function(d){ return colorScale(d.continent) }
  histo.color = function( c ){
    if ( !arguments.length ) return _colorFunc;
    if (typeof c === 'function') _colorFunc = c;
    else _colorFunc = function () { return c };
    draw();
    return histo;
  }

  // similar to above, but for stroke
  histo.stroke = function( s ){
    if ( !arguments.length ) return _strokeFunc;
    _strokeFunc = s;
    draw();
    return histo;
  }

  // key function for joining data, e.g. function(d){ return d.originName }
  histo.key = function( k ){
    if ( !arguments.length ) return _keyFunc;
    _keyFunc = k;
    draw();
    return histo;
  }

  histo.attr = function( name, value ){
    if ( !rect ) return null;
    if ( arguments.length == 1 ){
      var arr = [];
      rect.each(function(){
        arr.push( d3.select(this).attr(name) );
      });
      return arr;
    }
    rect
      .attr( name, value );
    
    return histo;
  }

  histo.transition = function( bool ){
    if ( !arguments.length ) return _transition;
    _transition = bool;
    return histo;
  }

  histo.duration = function( d ){
    if ( !arguments.length ) return _duration;
    _duration = d;
    return histo;
  }

  function create(){
    if ( !container ) return;
    if ( _g ) _g.remove();
    _g = container.append( 'g' )
      .attr( 'class', 'histogram' )
      .attr( 'transform', 'translate(' + _offset + ',' + _offset + ')');
    container.append('path')
      .attr('d', `M${_offset},${_maxHeight + _offset}H${_width}`)
      .attr('class', 'histogram-axis histogram-x-axis')
      .style('fill', 'none')
    container.append('path')
      .attr('d', `M${_offset},${_maxHeight + _offset}V-${_width}`)
      .attr('class', 'histogram-axis histogram-y-axis')
      .style('fill', 'none')
    rect = _g.selectAll('rect');
    draw();
  }

  function draw(){
    if ( !_g || !_data ) return;

    // http://bl.ocks.org/mbostock/5681842

    rect = rect.data(_data, _keyFunc ? function(d){ return _keyFunc(d) } : undefined );

    rect.exit().remove();

    rect.enter()
      .append( 'rect' )
      .attr('x', (d, i) => binWidth * i + 1)
      .attr('height', 0)
      .attr('y', _maxHeight);

    rect = _g.selectAll('rect');

    rect
      .attr('fill',function(d){ return _colorFunc(d) })
      .attr('stroke',function(d){ return _strokeFunc(d) });
    if ( _transition ){
      rect.transition()
        .style( 'display', 'block' )
        .duration( _duration )
        .attr('height', d => heightScale(_valueFunc(d)))
        .attr('y', d => yScale(_valueFunc(d)))
        .attr('x', (d, i) => binWidth * i + 1)
        .attr('width', binWidth)
        .on('end',function(d){
          if ( !_valueFunc(d) ) d3.select(this).style('display','none');
        });
    } else {
      rect
        .each(function(d, i) { this._current = d; })
        .style( 'display', 'block' )
        .attr('height', d => heightScale(_valueFunc(d)))
        .attr('y', d => yScale(_valueFunc(d)))
        .attr('x', (d, i) => binWidth * i + 1)
        .attr('width', binWidth)
        .style( 'display', function(d){
          if ( !_valueFunc(d) ) return 'none';
          return 'block';
        });
    }
        
  }

  return histo;
}