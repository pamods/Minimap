var width = 200;
var height = 200;
var λ = d3.scale.linear().domain([ 0, width ]).range([ -180, 180 ]);
var φ = d3.scale.linear().domain([ 0, height ]).range([ 90, -90 ]);

var convertToLonLan = function(x, y, z, r) {
	var r = r === undefined ? Math.sqrt(x * x + y * y + z * z) : r;
	var lat = 90 - (Math.acos(z / r)) * 180 / Math.PI;
	var lon = ((270 + (Math.atan2(y, x)) * 180 / Math.PI) % 360) - 180;
	return [ lon, lat ];
};

var convertToCartesian = function(lat, long, r) {
	var r = r === undefined ? 500 : r;
	lat *= Math.PI / 180;
	long *= Math.PI / 180;

	// "PA" Cartesian coordinates
	var x = r * Math.cos(lat) * Math.sin(long);
	var y = -r * Math.cos(lat) * Math.cos(long);
	var z = r * Math.sin(lat);

	return [ x, y, z ];
};

var projections = {

	"Winkel Tripel" : function(w, h) {
		return d3.geo.winkel3().scale(39 * (w / width)).translate(
				[ w / 2, h / 2 ]).precision(.1)
	},

	"Robinson" : function(w, h) {
		return d3.geo.robinson().scale(30 * (w / width)).translate(
				[ w / 2, h / 2 ]).precision(.1)
	},

	"Aitoff" : function(w, h) {
		return d3.geo.aitoff().scale(30 * (w / width)).translate(
				[ w / 2, h / 2 ]).precision(.1)
	},

	"Albers Equal-Area Conic" : function(w, h) {
		return d3.geo.albers().rotate([ 96, 0 ]).center([ -.6, 38.7 ])
				.parallels([ 29.5, 45.5 ]).scale(35 * (w / width)).translate(
						[ w / 2, h / 2 ]).precision(.1)
	},

	"Armadillo" : function(w, h) {
		return d3.geo.armadillo().scale(46 * (w / width)).translate([ w / 2, h / 2 ])
				.parallel(20).rotate([ -10, 0 ]).precision(.1)
	},

	"August Projection" : function(w, h) {
		return d3.geo.august().scale(18 * w / width)
				.translate([ w / 2, h / 2 ]).precision(.1)
	},

	"Lambert Azimuthal Equal-Area" : function(w, h) {
		return d3.geo.azimuthalEqualArea().clipAngle(180 - 1e-3).scale(
				45 * (w / width)).translate([ w / 2, h / 2 ]).precision(.1)
	},

	"Azimuthal Equidistant" : function(w, h) {
		return d3.geo.azimuthalEquidistant().scale(31 * (w / width)).translate(
				[ w / 2, h / 2 ]).clipAngle(180 - 1e-3).precision(.1)
	},

	"Baker Dinomic" : function(w, h) {
		return d3.geo.baker().scale(30 * (w / width)).translate(
				[ w / 2, h / 2 ]).precision(.1)
	},

	"Berghaus Star" : function(w, h) {
		return d3.geo.berghaus().rotate([ 20, -90 ]).clipAngle(180 - 1e-3)
				.scale(33 * (w / width)).translate([ w / 2, h * .55 ])
				.precision(.1)
	},

	"Boggs Eumorphic" : function(w, h) {
		return d3.geo.boggs().scale(30 * (w / width)).translate(
				[ w / 2, h / 2 ]).precision(.1)
	},

	"Bonne" : function(w, h) {
		return d3.geo.bonne().center([ 0, 27 ]).scale(42 * (w / width))
				.translate([ w / 2, h / 2 ]).precision(.1)
	},

	"Bromley" : function(w, h) {
		return d3.geo.bromley().scale(30 * (w / width)).translate(
				[ w / 2, h / 2 ]).precision(.1)
	},

	"Van der Grinten I" : function(w, h) {
		return d3.geo.vanDerGrinten().scale(30).translate(
				[ width / 2, height / 2 ]).precision(.1)
	},

	"Van der Grinten II" : function(w, h) {
		return d3.geo.vanDerGrinten2().scale(30 * (w / width)).translate(
				[ w / 2, h / 2 ]).precision(.1)
	},

	"Van der Grinten III" : function(w, h) {
		return d3.geo.vanDerGrinten3().scale(30 * (w / width)).translate(
				[ w / 2, h / 2 ]).precision(.1)
	},

	"Van der Grinten IV" : function(w, h) {
		return d3.geo.vanDerGrinten4().scale(30 * (w / width)).translate(
				[ w / 2, h / 2 ]).precision(.1)
	},

	"Waterman Butterfly" : function(w, h) {
		return d3.geo.polyhedron.waterman().rotate([ 20, 0 ]).scale(
				24 * (w / width)).translate([ w / 2, h / 2 ]).precision(.1)
	},

	"Gnomonic Butterfly" : function(w, h) {
		return d3.geo.polyhedron.butterfly().rotate([ 20, 0 ]).scale(
				24 * (w / width)).translate([ w / 2, h * .745 ]).precision(.1)
	},

	"Miller" : function(w, h) {
		return d3.geo.miller().scale(30 * (w / width)).translate(
				[ w / 2, h / 2 ]).precision(.1)
	},

	"Mercator" : function(w, h) {
		return d3.geo.mercator().scale(30 * (w / width)).translate(
				[ w / 2, h / 2 ]).precision(.1)
	},

	"Ginzburg IX" : function(w, h) {
		return d3.geo.ginzburg9().scale(35 * (w / width)).translate(
				[ w / 2, h / 2 ]).precision(.1)
	},

	"Gringorten Equal-Area" : function(w, h) {
		return d3.geo.gringorten().scale(45 * (w / width)).translate(
				[ w / 2, h / 2 ]).precision(.1)
	},

	"Eisenlohr" : function(w, h) {
		return d3.geo.eisenlohr().scale(15 * (w / width)).translate(
				[ w / 2, h / 2 ]).precision(.1)
	},

	"Equidistant Conic Projection" : function(w, h) {
		return d3.geo.conicEquidistant().center([ 0, 15 ]).scale(
				27 * (w / width)).translate([ w / 2, h / 2 ]).precision(.1)
	},

	"Guyou" : function(w, h) {
		return d3.geo.guyou().scale(30 * (w / width)).translate(
				[ w / 2, h / 2 ]).precision(.1)
	},

	"HEALPix" : function(w, h) {
		return d3.geo.healpix().scale(61 * (w / width)).translate(
				[ w / 2, h / 2 ]).precision(.1)
	},

	"Orthographic" : function(w, h) {
		return d3.geo.orthographic().scale(80 * (w / width)).translate(
				[ w / 2, h / 2 ]).clipAngle(90).precision(.1)
	},
};