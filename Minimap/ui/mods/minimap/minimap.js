console.log("loaded minimap.js");

var models = [];

var handlers = {};

loadScript("coui://ui/mods/minimap/unitInfoParser.js");
loadScript("coui://ui/mods/minimap/alertsManager.js");

ko.bindingHandlers.numericValue = {
	    init : function(element, valueAccessor, allBindings, data, context) {
	        var interceptor = ko.computed({
	            read: function() {
	                return ko.unwrap(valueAccessor());
	            },
	            write: function(value) {
	                if (!isNaN(value)) {
	                    valueAccessor()(parseFloat(value));
	                }                
	            },
	            disposeWhenNodeIsRemoved: element
	        });
	        
	        ko.applyBindingsToNode(element, { value: interceptor }, context);
	    }
	};

$(document).ready(function() {
	var unitSpecMapping = undefined;
	unitInfoParser.loadUnitTypeMapping(function(mapping) {
		unitSpecMapping = mapping;
	});
	
	var defProjection = "Azimuthal Equidistant";
	
	function MinimapModel(planet) {
		var self = this;
		var planetCameraId = planet.cameraId;
		var configStorageKey = "info.nanodesu.minimap.config"+planet.name+planetCameraId+planet.id;
		var loadConfig = function() {
			return decode(localStorage[configStorageKey]) || {};
		};
		var storeConfig = function(cfg) {
			localStorage[configStorageKey] = encode(cfg);
		};
		
		self.projectionKey = ko.observable(loadConfig().projection || defProjection);
		self.selectableProjections = ko.observableArray([]);
		for (var x in projections) {
			if (projections.hasOwnProperty(x)) {
				self.selectableProjections.push(x);
			}
		}
		self.projectionKey.subscribe(function(v) {
			var cfg = loadConfig();
			cfg.projection = v;;
			storeConfig(cfg);
		});
		self.selectableProjections.sort(function(left, right) {
			return left == right ? 0 : (left < right ? -1 : 1)
		});
		self.projection =  ko.computed(function() {
			return projections[self.projectionKey()] || projections[defProjection];
		});
		
		var graticule = d3.geo.graticule();
		var path = d3.geo.path().projection(self.projection());
		self.path = path;
		
		var svgElem =  undefined;
		self.svgId = "";

		self.acceptPathChange = function() {
			if (svgElem) {
				svgElem.selectAll("path").attr("d", path);
			}
		};
		
		
		self.dotSize = ko.computed({
			read: function() {
				return self.path.pointRadius();
			},
			write: function(value) {
				self.path.pointRadius(value);
				self.acceptPathChange();
				var cfg = loadConfig();
				cfg.dotSize = value;
				storeConfig(cfg);
			}
		});
		
		self.dotSize(loadConfig().dotSize || 4.5);
		
		self.rotation = ko.observable([0, 0]);
		
		self.projection().rotate(self.rotation());
		
		self.rotation.subscribe(function(v) {
			self.projection().rotate(v);
			self.acceptPathChange();
			var cfg = loadConfig();
			cfg.rotation = v;
			storeConfig(cfg);
		});

		var storedRotation = loadConfig().rotation; 
		if (storedRotation) {
			self.rotation(storedRotation);
		}
		
		self.projection.subscribe(function(p) {
			p.rotate(self.rotation());
			path.projection(p);
			self.acceptPathChange();
		});
		
		self.settingsVisible = ko.observable(false);
		
		var prepareSvg = function(targetDivId) {
			self.svgId = targetDivId;
			$('#minimap_div').prepend('<div style="width: '+width+'px;" class="minimapdiv" id="'+targetDivId+'"></div>');
			$('#'+targetDivId).append("<div class='minimap_head'>"+planet.name+" <input style='pointer-events: all;' type='checkbox' data-bind='checked: settingsVisible'/></div>");
			$('#'+targetDivId).append("<div class='minimap_config' " +
					"data-bind='visible: settingsVisible'>" +
					"Projection: <select data-bind='options: selectableProjections, value: projectionKey'></select>" +
					"<div>dotSize: <input type='number' step='0.5' data-bind='numericValue: dotSize'/> </div>"+
					"</div>");
			var svg = d3.select("#"+targetDivId).append("svg").attr("width", width).attr("height", height).attr("id", targetDivId+"-svg").attr('class', 'receiveMouse');
			$('#'+targetDivId+"-svg").attr('data-bind', "click: lookAtMinimap, event: {mousemove: movemouse, contextmenu: moveByMinimap, mouseleave: mouseleave}");
			var defs = svg.append("defs");
			defs.append("path").datum({type: "Sphere"}).attr("id", targetDivId+"-sphere").attr("d", path);
			var sphereId = "#"+targetDivId+"-sphere";
			defs.append("clipPath").attr("id", targetDivId+"-clip").append("use").attr("xlink:href", sphereId);
			svg.append("use").attr("class", "stroke").attr("xlink:href", sphereId);
			svg.append("use").attr("class", "fill").attr("xlink:href", sphereId);
			svg.append("path").datum(graticule).attr("class", "graticule").attr("clip-path", "url(#"+targetDivId+"-clip)").attr("d", path);
			return svg;
		};
		
		self.initForMap = function(map) {
			svgElem =  prepareSvg(map.id);
			var layers = ['land', 'sea', 'metal', 'spawns'];
			for (var i = 0; i < layers.length; i++) {
				var layer = layers[i];
				if (map[layer]) {
					svgElem.insert("path", ".graticule").datum(map[layer]).attr("class", layer+"").attr("d", path);
				} else {
					console.log("layer "+layer+" is not defined");
				}
			}
		};
		
		var lookAtByMinimapXY = function(x, y) {
			var ll = self.projection().invert([x, y]);
			if (ll) {
				var c = convertToCartesian(ll[1], ll[0]);
				api.camera.lookAt({planet_id: planetCameraId, location: {x: c[0], y: c[1], z: c[2]}, zoom: 'orbital'});
			}
		};
		
		var moveToByMiniMapXY = function(x, y, queue) {
			var ll = self.projection().invert([x, y]);
			if (ll) {
				var c = convertToCartesian(ll[1], ll[0]);
				var payload = {
					method: "moveSelected",
					arguments: [c[0], c[1], c[2], planetCameraId, queue],
				};
				api.Panel.message(api.Panel.parentId, 'runUnitCommand', payload);
			}
		}
		
		self.moveByMinimap = function(data, e) {
			moveToByMiniMapXY(e.offsetX, e.offsetY, e.shiftKey);
		};
		
		self.lookAtMinimap = function(data, e) {
			lookAtByMinimapXY(e.offsetX, e.offsetY);
		};
		
		self.showPreviewByMapXY = function(x, y) {
			var ll = self.projection().invert([x, y]);
			if (ll) {
				var c = convertToCartesian(ll[1], ll[0]);
				api.Panel.message(api.Panel.parentId, 'unit_alert.show_preview', {
					location: {
						x: c[0],
						y: c[1],
						z: c[2]
					}, 
					planet_id: planetCameraId,
					zoom: 'orbital'
				});
			}
		};
		
		self.movemouse = function(data, e) {
			if (e.altKey) {
				self.rotation([ λ(e.offsetX), φ(e.offsetY)]);
			}
			self.showPreviewByMapXY(e.offsetX, e.offsetY);
		}
		
		self.mouseleave = function(data, e) {
			api.Panel.message(api.Panel.parentId, 'unit_alert.hide_preview');
		};
		
		var dotIdSrc = 0;
		
		var nextDotId = function() {
			dotIdSrc++;
			return "dot_"+dotIdSrc+"_";
		};
		
		self.createDot = function(x, y, z, css) {
			var ll = convertToLonLan(x, y, z);
			var geojson = {
				    "type": "FeatureCollection",
				    "features": [
				        {
				            "type": "Feature",
				            "geometry": {
				                "type": "Point",
				                "coordinates": [
				                        ll[0],
				                        ll[1]
				                    
				                ]
				            }
				        }
				    ]
				};
			var id = nextDotId();
			svgElem.insert("path", ".graticule").datum(geojson).attr("class", css).attr("id", id).attr("d", path);
			return id;
		};
		
		self.createTemporaryDot = function(x, y, z, css, time) {
			var id = self.createDot(x, y, z, css);
			setTimeout(function() {
				$('#'+id).remove();
			}, time);
		};
		
		var removeMapping = {};
		
		function contains(ar, val) {
			return ar !== undefined && $.inArray(val, ar) !== -1;
		}
		
		self.handleAlert = function(alert) {
			var types = unitSpecMapping[alert.spec_id];
			if (alert.watch_type === 0) { // created
				if (contains(types, 'Structure')) {
					var dotId = self.createDot(alert.location.x, alert.location.y, alert.location.z, "building");
					removeMapping[alert.id] = dotId;
				}
			} else if (alert.watch_type === 2) { // destroyed
				if (contains(types, 'Structure')) {
					if (removeMapping[alert.id]) {
						$('#'+removeMapping[alert.id]).remove();
					}
				}
				self.createTemporaryDot(alert.location.x, alert.location.y, alert.location.z, 'destruction-warning', 10000);
			} else if (alert.watch_type === 4 || alert.watch_type === 6) { // sight || first_contact
				if (contains(types, 'Structure')) {
					self.createTemporaryDot(alert.location.x, alert.location.y, alert.location.z, 'enemy-building', 10000);
				} else {
					self.createTemporaryDot(alert.location.x, alert.location.y, alert.location.z, 'enemy-unit-warning', 10000);
				}
			} else if (alert.watch_type === 3) { // ping
				self.createTemporaryDot(alert.location.x, alert.location.y, alert.location.z, 'ping-warning-circle', 10000);
			}
		};
		
		self.handleAlerts = function(payload) {
			for (var i = 0; i < payload.list.length; i++) {
				var alert = payload.list[i];
				if (alert.planet_id === planetCameraId) { 
					self.handleAlert(alert);
				}
			}
		}
		
		self.initForMap(planet);
	}
	
	var initBySystem = function(sys) {
		for (var i = 0; i < sys.planets.length; i++) {
			var planet = sys.planets[i];
			var model = new MinimapModel(planet);
			ko.applyBindings(model, $('#'+model.svgId).get(0));
			models.push(model);
		}
		
		for (var i = 0; i < models.length; i++) {
			alertsManager.addListener(models[i].handleAlerts);
		}
	};
	
	handlers.celestial_data = function(payload) {
		var mapData = minimapSystems[payload.name];
		if (mapData) {
			initBySystem(mapData);
		} else {
			console.log("No minimap data available for map with name "+payload.name);
		}
	};
	
	handlers.setSize = function(size) {
		$('.body_panel').css('width', size);
	};
	
	app.registerWithCoherent(model, handlers);
	api.Panel.message(api.Panel.parentId, 'queryViewportSize');
});