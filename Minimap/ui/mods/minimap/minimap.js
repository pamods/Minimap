console.log("loaded minimap.js");

var models = [];
var handlers = {};

loadScript("coui://ui/mods/minimap/unitInfoParser.js");
loadScript("coui://ui/mods/minimap/alertsManager.js");

(function() {
	var initDefaultConfig = function() {
		var makeDefaultConfig = function(key, value) {
			if (localStorage[key] === undefined) {
				localStorage[key] = value;
			}
		};
		
		// default configs for the ranked maps
		
		// map 1v1 1-1-6
		makeDefaultConfig('info.nanodesu.minimap.configOsiris0p-id-0', '{"dotSize":"2","projection":"Winkel Tripel","rotation":[136.8,0],"geo-dots":"2.5","spawns-dots":"3.5","metal-dots":"3","others-dots":"3.7","width":"320","height":"200"}');
		
		// map "1v1 1-3-8"
		makeDefaultConfig('info.nanodesu.minimap.configOdin0p-id-0', '{"dotSize":2.5,"rotation":[108,-0.9000000000000057],"projection":"Winkel Tripel","geo-dots":"2.4","spawns-dots":4,"metal-dots":4,"others-dots":4,"width":"320"}');
		makeDefaultConfig('info.nanodesu.minimap.configYmir12639p-id-12639', '{"dotSize":4,"projection":"Winkel Tripel","rotation":[-162,0],"geo-dots":"2.6","spawns-dots":"4","metal-dots":"3","others-dots":"3.2","height":"130"}');
		
		// map 1v1 1-2-6
		makeDefaultConfig('info.nanodesu.minimap.configHephaestus0p-id-0', '{"geo-dots":"2.7","spawns-dots":"4","metal-dots":"2.7","others-dots":2,"width":"320","rotation":[59.400000000000006,1.7999999999999972]}');
	};

	initDefaultConfig();
}());


$(document).ready(function() {
	var unitSpecMapping = undefined;
	unitInfoParser.loadUnitTypeMapping(function(mapping) {
		unitSpecMapping = mapping;
	});
	
	var defProjection = "Winkel Tripel";
	
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
		
		var makeStoreSubscriber = function(name) {
			return function(v) {
				var cfg = loadConfig();
				cfg[name] = v;
				storeConfig(cfg);
			};
		};
		
		self.projectionKey.subscribe(makeStoreSubscriber('projection'));
		self.selectableProjections.sort(function(left, right) {
			return left == right ? 0 : (left < right ? -1 : 1)
		});
		
		self.width = ko.observable(loadConfig().width || width);
		self.height = ko.observable(loadConfig().height || height);
		
		self.width.subscribe(makeStoreSubscriber('width'));
		self.height.subscribe(makeStoreSubscriber('height'));
		
		self.projection =  ko.computed(function() {
			var c = projections[self.projectionKey()] || projections[defProjection];
			return c(self.width(), self.height());
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
		
		var makeStoringPathObservable = function(name) {
			var obs = ko.observable();
			obs.subscribe(function(value) {
				self.acceptPathChange();
				var cfg = loadConfig();
				cfg[name] = value;
				storeConfig(cfg);
			});
			obs(loadConfig()[name] || 2);
			return obs;
		};
		
		self.geoDotSize = makeStoringPathObservable("geo-dots");
		self.spawnDotSize = makeStoringPathObservable("spawns-dots");
		self.metalDotSize = makeStoringPathObservable("metal-dots");
		self.othersDotSize = makeStoringPathObservable("others-dots");
		
		self.path.pointRadius(function(o) {
			if (o && o.properties && o.properties.type) {
				var t = o.properties.type;
				switch (t) {
				case "spawns":
					return self.spawnDotSize();
				case "metal":
					return self.metalDotSize();
				case "sea":
				case "land":
					return self.geoDotSize();
				}
				
			}
			return self.othersDotSize();
		});
		
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
			$('#minimap_div').prepend('<div class="minimapdiv" id="'+targetDivId+'"></div>');
			$('#'+targetDivId).append("<div class='minimap_head'>"+planet.name+" <input style='pointer-events: all;' type='checkbox' data-bind='checked: settingsVisible'/></div>");
			$('#'+targetDivId).append("<div class='minimap_config' " +
					"data-bind='visible: settingsVisible'>" +
					"Projection: <select data-bind='options: selectableProjections, value: projectionKey'></select>" +
					"<div>geo: <input style='width: 40px' type='number' step='0.1' data-bind='value: geoDotSize'/> " +
					"spawns: <input style='width: 40px' type='number' step='0.1' data-bind='value: spawnDotSize'/> <br/> " +
					" metal: <input style='width: 40px' type='number' step='0.1' data-bind='value: metalDotSize'/> " +
					"others: <input style='width: 40px' type='number' step='0.1' data-bind='value: othersDotSize'/> <br/>" +
					" width: <input style='width: 60px' type='number' step='10' data-bind='value: width'/> " +
					" height: <input style='width: 60px' type='number' step='10' data-bind='value: height'/> " +
					" </div>"+
					"</div>");
			var svg = d3.select("#"+targetDivId).append("svg").attr("width", self.width()).attr("height", self.height()).attr("id", targetDivId+"-svg").attr('class', 'receiveMouse');
			$('#'+targetDivId+"-svg").attr('data-bind', "click: lookAtMinimap, event: {mousemove: movemouse, contextmenu: moveByMinimap, mouseleave: mouseleave}, style: {width: width, height: height}");
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