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
		
		if (typeof minimapConfigs !== "undefined") {
			for (var i = 0; i < minimapConfigs.length; i++) {
				makeDefaultConfig(minimapConfigs[i][0], minimapConfigs[i][1]);
			}
		}
	};
	initDefaultConfig();
}());


$(document).ready(function() {
	var selectUnitsById = function(ids) {
		engine.call("select.byIds", []).then(function() {
			engine.call("select.byIds", ids).then(function() {
				api.audio.playSound("/SE/UI/UI_Unit_Select");
			});
		});
	};
	
	var selector = makeSelector();
	$('body').append("<div id='selection_layer' style='position: fixed; top: 0px; left: 0px; z-index: -999'></div>");
	selector.bindToElement("#selection_layer");
	
	var shiftState = ko.observable(false);
	var ctrlState = ko.observable(false);
	
	var selectedUnits = {};
	var selectedUnitsCount = function() {
		var cnt = 0;
		_.forEach(selectedUnits, function(u) {
			cnt++;
		});
		return cnt;
	};
	
	var assumedSize = 300;
	var unitPositionPollingSpeed = 250;
	
	var mainViewWidth = undefined;
	var mainViewHeight = undefined;
	
	var focusedPlanet = ko.observable(0);
	var signalFocusModel = ko.observable(0);
	var focusedModel = ko.computed(function() {
		focusedPlanet();
		signalFocusModel();
		for (var i = 0; i < models.length; i++) {
			if (focusedPlanet() === models[i].planetId) {
				return models[i];
			}
		}
		return undefined;
	});
	focusedModel.extend({ rateLimit: 500 }); // prevent short focus fluctuations from affecting the display of the zoomed out view
	
	var anyFullScreened = ko.computed(function() {
		return focusedModel() && focusedModel().fullScreened();
	});
	
	var fullScreenListener = function(v) {
		selector.setEnabled(v);
		var $layer = $('#selection_layer');
		if (v) {
			$layer.addClass("receiveMouse");
			$layer.removeClass("ignoreMouse");
		} else {
			$layer.removeClass("receiveMouse");
			$layer.addClass("ignoreMouse");
		}
	};
	anyFullScreened.subscribe(fullScreenListener);
	fullScreenListener(anyFullScreened());

	selector.addListener(function(x, y, w, h) {
		_.forEach(models, function(m) {
			m.rubberbandSelect(x, y, w, h, shiftState(), ctrlState());
		});
	});
	
	var zoomLevel = ko.observable();
	
	function contains(ar, val) {
		return ar !== undefined && $.inArray(val, ar) !== -1;
	}
	
	function UnitPositionsById() {
		var self = this;
		var lastUpdate = 0;
		var minPositionChange = 1.5;
		var byId = {};
		
		var queryActive = false;
		
		var refreshData = function() {
			queryActive = true;
			$.getJSON("http://127.0.0.1:8184/pa/updateId/"+lastUpdate+"/minPositionChange/"+minPositionChange, function(data) {
				lastUpdate = data.updateId;
				if (data.reset) {
					byId = {};
				}
				
				_.forEach(data.addedUnits, function(unit) {
					byId[unit.id] = unit;
				});
				
				_.forEach(data.updatedUnits, function(unit) {
					var old = byId[unit.id];
					old.x = unit.x;
					old.y = unit.y;
					old.z = unit.z;
					old.currentHp = unit.currentHp;
				});
				
				_.forEach(data.removedUnits, function(id) {
					delete byId[id];
				});
			}).complete(function() {
				queryActive = false;
			});
		};
		
		self.getUnits = function() {
			return byId;
		};
		
		self.getCurrentUnit = function(unitId) {
			return byId[unitId];
		};
		
		self.startPolling = function() {
			setInterval(function() {
				if (!queryActive) {
					refreshData();
				} else {
					console.log("query for unit positions cannot keep up!");
				}
			}, unitPositionPollingSpeed);
		};
	};
	
	var unitPositionsHolder = new UnitPositionsById();
	
	var unitSpecMapping = undefined;
	unitInfoParser.loadUnitTypeMapping(function(mapping) {
		unitSpecMapping = mapping;
	});
	
	var defProjection = "Winkel Tripel";
	
	function MinimapModel(planet) {
		var self = this;
		self.planetName = planet.name;
		self.planetId = planet.cameraId;
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
		
		self.fullScreened = ko.computed(function() {
			return focusedModel() === self && (zoomLevel() === "celestial");
		});
		self.fullScreened.subscribe(function(v) {
			_.delay(self.acceptPathChange);
			api.Panel.message(api.Panel.parentId, "fullMainView");
		});

		var storeFunc = function(name, v) {
			if (!self.fullScreened()) {
				var cfg = loadConfig();
				cfg[name] = v;
				storeConfig(cfg);
			}
		};
		
		var makeStoreSubscriber = function(name) {
			return function(v) {
				storeFunc(name, v);
			};
		};
		
		self.projectionKey.subscribe(makeStoreSubscriber('projection'));
		self.selectableProjections.sort(function(left, right) {
			return left == right ? 0 : (left < right ? -1 : 1)
		});
		
		self.normalWidth = ko.observable(loadConfig().width || 320);
		self.normalHeight = ko.observable(loadConfig().height || 200);
		
		self.normalWidth.subscribe(makeStoreSubscriber('width'));
		self.normalHeight.subscribe(makeStoreSubscriber('height'));
		
		var bordersFactor = 0.7;
		
		self.width = ko.computed(function() {
			if (self.fullScreened()) {
				var ratio = self.normalWidth()/self.normalHeight();
				var height = mainViewWidth * bordersFactor * 1/ratio;
				if (height > mainViewHeight * bordersFactor) {
					return mainViewHeight * bordersFactor * ratio;  
				} else {
					return mainViewWidth * bordersFactor;
				}
			} else {
				return self.normalWidth();
			}
		});
		
		self.height = ko.computed(function() {
			if (self.fullScreened()) {
				var ratio = self.normalHeight()/self.normalWidth();
				var width = mainViewHeight * bordersFactor * 1/ratio;
				if (width > mainViewWidth * bordersFactor) {
					return mainViewWidth * bordersFactor * ratio;  
				} else {
					return mainViewHeight * bordersFactor;
				}
			} else {
				return self.normalHeight();
			}
		});
		
		self.leftPosition = ko.computed(function() {
			if (self.fullScreened()) {
				return (mainViewWidth - self.width()) / 2;
			} else {
				return 0;
			}
		});
		
		self.topPosition = ko.computed(function() {
			return 0;
		});
		
		self.projection =  ko.computed(function() {
			var c = projections[self.projectionKey()] || projections[defProjection];
			return c(self.width(), self.height());
		});
		
		var graticule = d3.geo.graticule();
		var path = d3.geo.path().projection(self.projection());
		self.path = path;
		
		var svgElem =  undefined;
		self.svgId = "";

		var mapPaths = [];
		
		self.acceptPathChange = function() {
			if (svgElem) {
				for (var i = 0; i < mapPaths.length; i++) {
					mapPaths[i].attr("d", path);
				}
			}
		};
		
		var makeStoringPathObservable = function(name) {
			var obs = ko.observable();
			obs.subscribe(function(value) {
				self.acceptPathChange();
				storeFunc(name, value);
			});
			obs(loadConfig()[name] || 2.5);
			return obs;
		};
		
		self.geoDotSize = makeStoringPathObservable("geo-dots");
		self.spawnDotSize = makeStoringPathObservable("spawns-dots");
		self.metalDotSize = makeStoringPathObservable("metal-dots");
		self.othersDotSize = makeStoringPathObservable("others-dots");
		self.iconBaseSize = makeStoringPathObservable("iconBaseSize");
		
		var sizeModification = ko.computed(function() {
			return (Math.max(self.width(), self.height()) / assumedSize);
		});
		
		var iconSizeScale = ko.computed(function() {
			return self.iconBaseSize() * sizeModification(); 
		});
		
		self.path.pointRadius(function(o) {
			if (o && o.properties && o.properties.type) {
				var t = o.properties.type;
				switch (t) {
				case "spawns":
					return self.spawnDotSize() * sizeModification();
				case "metal":
					return self.metalDotSize() * sizeModification();
				case "sea":
				case "land":
					return self.geoDotSize() * sizeModification();
				}
			}
			return self.othersDotSize() * sizeModification();
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
		
		self.settingsVisibleComp = ko.computed(function() {
			return self.settingsVisible() && !self.fullScreened();
		});
		
		self.cssPosition = ko.computed(function() {
			return self.fullScreened() ? "absolute" : "relative";
		});
		
		var prepareSvg = function(targetDivId) {
			self.svgId = targetDivId;
			$('#minimap_div').prepend('<div class="minimapdiv" id="'+targetDivId+'" data-bind="style: {top: topPosition()+\'px\', left: leftPosition()+\'px\', position: cssPosition()}"></div>');
			$('#'+targetDivId).append("<div class='minimap_head'>"+planet.name+" <input style='pointer-events: all;' type='checkbox' data-bind='checked: settingsVisible, visible: !fullScreened()'/></div>");
			$('#'+targetDivId).append("<div class='minimap_config' " +
					"data-bind='visible: settingsVisibleComp'>" +
					"Projection: <select data-bind='options: selectableProjections, value: projectionKey'></select>" +
					"<div>geo: <input style='width: 40px' type='number' step='0.1' data-bind='value: geoDotSize'/> " +
					"spawns: <input style='width: 40px' type='number' step='0.1' data-bind='value: spawnDotSize'/> <br/> " +
					" metal: <input style='width: 40px' type='number' step='0.1' data-bind='value: metalDotSize'/> " +
					"others: <input style='width: 40px' type='number' step='0.1' data-bind='value: othersDotSize'/> <br/>" +
					"icons: <input style='width: 40px' type='number' step='0.1' data-bind='value: iconBaseSize'/> <br/>" +
					" width: <input style='width: 60px' type='number' step='10' data-bind='value: normalWidth'/> " +
					" height: <input style='width: 60px' type='number' step='10' data-bind='value: normalHeight'/> " +
					" </div>"+
					"</div>");
			var svg = d3.select("#"+targetDivId).append("svg").attr("width", self.width()).attr("height", self.height()).attr("id", targetDivId+"-svg").attr('class', 'receiveMouse');
			var svgIdStr = '#'+targetDivId+"-svg";
			$(svgIdStr).attr('data-bind', "click: lookAtMinimap, event: {mousemove: movemouse, contextmenu: moveByMinimap, mouseleave: mouseleave}, style: {width: width, height: height}");
			selector.bindToElement(svgIdStr);
			var defs = svg.append("defs");
			mapPaths.push(defs.append("path").datum({type: "Sphere"}).attr("id", targetDivId+"-sphere").attr("d", path));
			var sphereId = "#"+targetDivId+"-sphere";
			defs.append("clipPath").attr("id", targetDivId+"-clip").append("use").attr("xlink:href", sphereId);
			svg.append("use").attr("class", "stroke").attr("xlink:href", sphereId);
			svg.append("use").attr("class", "fill").attr("xlink:href", sphereId);
			var fp = svg.append("path");
			console.log(fp);
			mapPaths.push(fp.datum(graticule).attr("class", "graticule").attr("clip-path", "url(#"+targetDivId+"-clip)").attr("d", path));
			return svg;
		};
		
		self.initForMap = function(map) {
			svgElem =  prepareSvg(map.id);
			var layers = ['land', 'sea', 'metal', 'spawns'];
			for (var i = 0; i < layers.length; i++) {
				var layer = layers[i];
				if (map[layer]) {
					mapPaths.push(svgElem.insert("path", ".graticule").datum(map[layer]).attr("class", layer+" minimap_layer").attr("d", path));
				} else {
					console.log("layer "+layer+" is not defined");
				}
			}
		};
		
		var removed = false;
		self.removeMap = function() {
			removed = true;
			console.log(planet.id+" remove!");
			$('#'+planet.id).remove();
		};
		
		var lookAtByMinimapXY = function(x, y, fullscreen) {
			var ll = self.projection().invert([x, y]);
			if (ll) {
				var c = convertToCartesian(ll[1], ll[0]);
				c.push(planetCameraId);
				if (fullscreen) {
					api.Panel.message(api.Panel.parentId, "focusMainViewHack", c);
				} else {
					api.camera.lookAt({planet_id: planetCameraId, location: {x: c[0], y: c[1], z: c[2]}, zoom: "orbital"});
					api.camera.alignToPole();
				}
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
		};
		
		self.moveByMinimap = function(data, e) {
			moveToByMiniMapXY(e.offsetX, e.offsetY, e.shiftKey);
		};
		
		self.lookAtMinimap = function(data, e) {
			if (!self.fullScreened()) {
				lookAtByMinimapXY(e.offsetX, e.offsetY, anyFullScreened());
			} else if (!shiftState() && selectedUnitsCount() > 0) {
				engine.call("select.byIds", []).then(function() {
					api.audio.playSound("/SE/UI/UI_Unit_UnSelect");
				});
			}
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
			};
		};
		
		self.scaleX = ko.computed(function() {
			return d3.scale.linear().domain([ 0, self.width() ]).range([ -180, 180 ]);
		});
		self.scaleY = ko.computed(function() {
			return d3.scale.linear().domain([ 0, self.height() ]).range([ 90, -90 ]);
		});
		
		self.movemouse = function(data, e) {
			if (!self.fullScreened() && !anyFullScreened()) {
				if (e.altKey) {
					self.rotation([ self.scaleX()(e.offsetX), self.scaleY()(e.offsetY)]);
				}
				self.showPreviewByMapXY(e.offsetX, e.offsetY);
			} else if (self.fullScreened()) {
				if (e) {
					var x = e.offsetX;
					var y = e.offsetY;
					var ll = self.projection().invert([x, y]);
					var c = undefined;
					if (ll) {
						c = convertToCartesian(ll[1], ll[0]);
						c.push(planetCameraId);
					}
					api.Panel.message(api.Panel.parentId, "focusMainViewHack", c);
				}
			}
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
		
		self.handleAlert = function(alert) {
			if (removed) {
				return;
			}
			
			var types = unitSpecMapping[alert.spec_id];
			if (alert.watch_type === 0) { // created
				//if (contains(types, 'Structure')) {
				//	var dotId = self.createDot(alert.location.x, alert.location.y, alert.location.z, "building");
				//	removeMapping[alert.id] = dotId;
				//}
			} else if (alert.watch_type === 2) { // destroyed
				//if (contains(types, 'Structure')) {
				//	if (removeMapping[alert.id]) {
				//		$('#'+removeMapping[alert.id]).remove();
				//	}
				//}
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
		
		var getProjectedUnitPosition = function(id) {
			var unitPosition = unitPositionsHolder.getCurrentUnit(id);
			var ll = convertToLonLan(unitPosition.x, unitPosition.y, unitPosition.z);
			var projected = self.projection()(ll);
			return projected;
		};
		
		var makePath = function(path, color, id) {
			return svgElem.append("path")
			  .attr("d",path)
			  .attr("fill", color)
			  .attr("id", id);
		};
		
		self.markSelectedId = function(id) {
			if (movingUnits[id]) {
				movingUnits[id].icon[0].attr('fill', "#FFFFFF");
			}
		};
		
		self.unmarkSelectedId = function(id) {
			if (movingUnits[id]) {
				movingUnits[id].icon[0].attr('fill', "#000000");
			}
		};
		
		var movingUnits = {};
		
		self.addMovingUnit = function(id, spec, army) {
			var projected = getProjectedUnitPosition(id);
			
			if (contains(unitSpecMapping[spec], "Commander")) {
				spec = "commander";
			}
			
			var borderId = "unit"+id+"_border";
			var fillId = "unit"+id+"_fill";
			
			var borderSvg = strategicIconPaths[spec+"_border"] || strategicIconPaths.fallback_border;
			var fillSvg = strategicIconPaths[spec+"_fill"] || strategicIconPaths.fallback_fill;
			
			var clickHandler = function() {
				if (anyFullScreened()) {
					var jq = $(this);
					var id = jq.attr("id");
					var unitId = Number(id.replace("unit", "").replace("_border", "").replace("_fill", ""));
					if (shiftState() && ctrlState() && selectedUnits[unitId]) {
						var toSelect = []; // write general code to handle this way better.... 
						_.forEach(selectedUnits, function(u, id) {
							if (Number(id) !== unitId) {
								toSelect.push(Number(id));
							}
						});
						selectUnitsById(toSelect);
					} else if ((shiftState() || ctrlState()) && !selectedUnits[unitId]) {
						var toSelect = [unitId];
						_.forEach(selectedUnits, function(u, id) {
							if (Number(id) !== unitId) {
								toSelect.push(Number(id));
							}
						});
						selectUnitsById(toSelect);
					} else {
						selectUnitsById([unitId]);
					}
				}
			};
			
			var blackFrame = makePath(borderSvg,"#000000", borderId)
				.attr("transform", "translate(" + projected[0] + "," + projected[1] + "), scale("+iconSizeScale()+")")
				.attr("class", "si_icon");
			var teamColoredFill = makePath(fillSvg, armyColors[army], fillId)
				.attr("transform", "translate(" + projected[0] + "," + projected[1] + "), scale("+iconSizeScale()+")")
				.attr("class", "si_icon");

			$(blackFrame[0][0]).click(clickHandler);
			$(teamColoredFill[0][0]).click(clickHandler);
			
			movingUnits[id] = {spec: spec, icon: [blackFrame, teamColoredFill], position: projected};
		};
		
		self.updateUnitPositions = function() {
			_.forEach(movingUnits, function(unit, id) {
				var unitPosition = unitPositionsHolder.getCurrentUnit(id);
				if (unitPosition !== undefined) {
					var projected = getProjectedUnitPosition(id);
					unit.position = projected;
					for (var i = 0; i < unit.icon.length; i++) {
						unit.icon[i].attr('transform', "translate(" + projected[0] + "," + projected[1] + "), scale("+iconSizeScale()+")");
					}
				}
			});
		};
		
		self.recheckUnitExistence = function() {
			_.forEach(movingUnits, function(unit, id) {
				var unitPosition = unitPositionsHolder.getCurrentUnit(id); 
				if (unitPositionsHolder.getUnits()[id] === undefined || unitPosition === undefined || unitPosition.planetId !== self.planetId) {
					$('#unit'+id+"_border").remove();
					$('#unit'+id+"_fill").remove();
					delete movingUnits[id];
				}
			});
			
			_.forEach(unitPositionsHolder.getUnits(), function(unit, id) {
				var unitPosition = unitPositionsHolder.getCurrentUnit(id); 
				if (unitPositionsHolder.getUnits()[id] && movingUnits[id] === undefined && unitPosition !== undefined && unitPosition.planetId === self.planetId) {
					self.addMovingUnit(id, unitPositionsHolder.getUnits()[id].spec, unitPositionsHolder.getUnits()[id].army);
				}
			});
		};
		
		self.rubberbandSelect = function(x, y, w, h, shift, ctrl) {
			var offset = $(svgElem[0][0]).offset();
			x -= offset.left;
			y -= offset.top;
			
			var toSelect = [];
			
			_.forEach(movingUnits, function(u, id) {
				var ux = u.position[0];
				var uy = u.position[1];
				
				if (ux >= x && ux <= x + w && uy >= y && uy <= y + h) {
					toSelect.push(Number(id));
				}
			});
			
			if (toSelect.length > 0) {
				if (ctrl && shift) { // ctrl + shift removes
					var deselect = toSelect;
					toSelect = [];
					_.forEach(selectedUnits, function(u, id) {
						if (!contains(deselect, Number(id))) {
							toSelect.push(Number(id));
						}
					});
				} else if (shift || ctrl) { // ctrl or shift adds
					_.forEach(selectedUnits, function(u, id) {
						toSelect.push(Number(id));
					});
				} // else just select what was selected
				
				selectUnitsById(toSelect);
			}
		};
		
		self.initForMap(planet);
		
		setInterval(self.recheckUnitExistence, 500);
		setInterval(self.updateUnitPositions, unitPositionPollingSpeed);
	}
	
	var armyColors = {};
	
//	alertsManager.addListener(function(payload) {
//		for (var i = 0; i < payload.list.length; i++) {
//			var alert = payload.list[i];
//			var types = unitSpecMapping[alert.spec_id];
//			if (alert.watch_type === 0) {
//				mobileUnits[alert.id] = {
//					spec: alert.spec_id,
//					army: alert.army_id
//				};
//			} else if (alert.watch_type === 2) {
//				mobileUnits[alert.id] = undefined;
//			}
//		}
//	});
	
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
		
		signalFocusModel(new Date().getTime());
	};
	
	var processRemovals = function(payload) {
		var toKill = [];
		for (var i = 0; i < models.length; i++) {
			var found = false;
			for (var p = 0; p < payload.planets.length; p++) { 
				if (payload.planets[p].name === models[i].planetName && payload.planets[p].dead) {
					found = true;
					break;
				}
			}
			if (found) {
				toKill.push(models[i]);
			}
		}
		for (var i = 0; i < toKill.length; i++) {
			var killIndex = models.indexOf(toKill[i]);
			if (killIndex !== -1) {
				models[killIndex].removeMap();
				models.splice(killIndex, 1);
			}
		}
	};
	
	handlers.celestial_data = function(payload) {
		if (models.length === 0) {
			console.log("celesitial data");
			console.log(payload);
			var mapData = minimapSystems[payload.name];
			var mapList = decode(localStorage["info.nanodesu.minimapkeys"]) || {};
			var dbName = "info.nanodesu.info.minimaps";
			if (mapList[payload.name]) {
				console.log("found minimap data in indexdb, will load key "+mapList[payload.name]);
				DataUtility.readObject(dbName, mapList[payload.name]).then(function(data) {
					initBySystem(data);
					processRemovals(payload);
				});
			} else if (mapData) {
				console.log("found minimap data in systems.js");
				initBySystem(mapData);
			} else {
				console.log("No minimap data available for map with name "+payload.name);
			}
		}
		processRemovals(payload);
	};
	
	handlers.setSize = function(size) {
		$('.body_panel').css('width', size[0]);
		mainViewWidth = size[0];
		mainViewHeight= size[1];
		$('#selection_layer').css("height", mainViewHeight+"px").css("width", mainViewWidth+"px");
		$('#minimap_div').css("height", size[1]);
	};
	
//	handlers.setCommanderId = function(params) {
//		if (params[0]) {
//			console.log("got commander id " + params);
//			mobileUnits[params[0]] = {
//				spec: "commander",
//				army: params[1]
//			};
//		}
//	};
	
	handlers.setArmyColors = function(clrs) {
		console.log("got colors");
		console.log(clrs);
		armyColors = clrs;
	};
	
	handlers.startPlaying = function() {
		console.log("started polling for positions");
		unitPositionsHolder.startPolling();
		api.Panel.message(api.Panel.parentId, 'queryCommanderId');
		api.Panel.message(api.Panel.parentId, 'queryArmyColors');
	};
	
	var myArmyId = undefined;
	
	handlers.setMyArmyId = function(armyId) {
		myArmyId = armyId;
	};
	
	handlers.selection = function(payload) {
		var newSelection = {};
		_.forEach(payload.spec_ids, function(ids, spec) {
			_.forEach(ids, function(id) {
				newSelection[id] = true;
			});
		});
		
		_.forEach(newSelection, function(v, id) {
			if (!selectedUnits[id]) {
				_.forEach(models, function(model) {
					model.markSelectedId(id);
				});
			}
		});
		_.forEach(selectedUnits, function(v, id) {
			if (!newSelection[id]) {
				_.forEach(models, function(model) {
					model.unmarkSelectedId(id);
				});
			}
		});
		
		selectedUnits = newSelection;
	};
	
	handlers.focus_planet_changed = function (payload) {
		if (payload.focus_planet_id !== undefined) {
			focusedPlanet(payload.focus_planet_id);
		}
	};
	
	handlers.zoom_level = function(payload) {
		zoomLevel(payload.zoom_level);
	};

	handlers.setShiftState = function(payload) {
		shiftState(payload);
	};
	
	handlers.setCtrlState = function(payload) {
		ctrlState(payload);
	};
	
	app.registerWithCoherent(model, handlers);
	
	setTimeout(function() {
		api.Panel.message(api.Panel.parentId, 'queryViewportSize');
		api.Panel.message(api.Panel.parentId, 'queryArmyColors');
		api.Panel.message(api.Panel.parentId, 'queryIsPlaying');
	}, 100);
});