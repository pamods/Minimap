console.log("loaded ubermap.js");

ko.bindingHandlers.datum = {
	update : function(element, valueAccessor, allBindings, viewModel, bindingContext) {
		value = ko.unwrap(valueAccessor());
		d3.select(element).datum(value);
	}
};

ko.bindingHandlers.d = {
	update : function(element, valueAccessor, allBindings, viewModel, bindingContext) {
		value = ko.unwrap(valueAccessor());
		d3.select(element).attr('d', value);
	}
};

ko.bindingHandlers.d3b = {
	update : function(element, valueAccessor, allBindings, viewModel, bindingContext) {
		value = ko.unwrap(valueAccessor());
		d3.select(element).datum(value[0]).attr('d', value[1]);
	}
};

ko.bindingHandlers.svguse = {
	update : function(element, valueAccessor, allBindings, viewModel, bindingContext) {
		value = ko.unwrap(valueAccessor());
		d3.select(element).attr('xlink:href', '#'+value);
	}
};

ko.bindingHandlers.id = {
	update : function(element, valueAccessor, allBindings, viewModel, bindingContext) {
		value = ko.unwrap(valueAccessor());
		d3.select(element).attr('id', value);
	}
};


var model = undefined;
var handlers = {};

loadScript("coui://ui/mods/minimap/unitInfoParser.js");
loadScript("coui://ui/mods/minimap/alertsManager.js");

$(document).ready(function() {
	
	function contains(ar, val) {
		return ar !== undefined && $.inArray(val, ar) !== -1;
	}
	
	function MemoryDataReceiver(pollTime) {
		var self = this;
		var lastUpdate = 0;
		var minPositionChange = 1.5;
		var queryActive = false;
		var noMemoryReaderPollTime = 10000;
		
		var currentUnits = {};
		var addedUnitsListeners = [];
		var updatedUnitsListeners = [];
		var removeUnitsListeners = [];
		
		var addRemovableListener = function(ar, lis) {
			ar.push(lis);
			var index = ar.length - 1;
			return function() {
				ar.splice(index, 1);
			};
		};
		
		self.addUnitAddedListener = function(listener) {
			return addRemovableListener(addedUnitsListeners, listener);
		};

		self.addUnitUpdatedListener = function(listener) {
			return addRemovableListener(updatedUnitsListeners, listener);
		};
		
		self.addUnitRemovedListener = function(listener) {
			return addRemovableListener(removeUnitsListeners, listener);
		};
		
		var notifyListeners = function(listeners, data) {
			_.forEach(listeners, function(listener) {
				listener(data);
			});
		};

		var notifyAdd = function(data) {
			notifyListeners(addedUnitsListeners, data);
		};
		
		var notifyUpdate = function(data) {
			notifyListeners(updatedUnitsListeners, data);
		};
		
		var notifyRemove = function(data) {
			notifyListeners(removeUnitsListeners, data);
		};
		
		var refreshData = function() {
			var startQuery = new Date().getTime();
			$.getJSON("http://127.0.0.1:8184/pa/updateId/"+lastUpdate+"/minPositionChange/"+minPositionChange, function(data) {
				lastUpdate = data.updateId;
				if (data.reset) {
					notifyRemove(currentUnits);
					currentUnits = {};
				}
				
				_.forEach(data.addedUnits, function(unit) {
					currentUnits[unit.id] = true;
					notifyAdd(unit);
				});
				
				_.forEach(data.updatedUnits, function(unit) {
					notifyUpdate(unit);
				});
				
				var removeKeys = {};
				_.forEach(data.removedUnits, function(id) {
					currentUnits[id] = undefined;
					removeKeys[id] = true;
				});
				notifyRemove(removeKeys);
				
				setTimeout(refreshData, Math.max(0, pollTime - (new Date().getTime() - startQuery)));
			}).fail(function() {
				console.log("Cannot find memory reader, slowing down polling");
				setTimeout(refreshData, noMemoryReaderPollTime);
			});
		}
		
		setTimeout(refreshData, 3000);
	}
	
	var memoryPA = new MemoryDataReceiver(250);
	
	var unitSpecMapping = undefined;
	unitInfoParser.loadUnitTypeMapping(function(mapping) {
		unitSpecMapping = mapping;
	});
	
	var appendLayoutFields = function(self) {
		self.minimapsBottomMargin = ko.observable(300);
		self.minimapAreaWidth = ko.observable(400);
		self.mapSidesRatio = ko.observable(1.5); 
		// height = width / sidesRatio
		self.minimapWidthBig = ko.observable(400);
		self.minimapWidthMedium = ko.observable(200);
		self.minimapWidthSmall = ko.observable(133);
		self.minimapUbermapGap = ko.observable(5);
		self.ubermapTop = ko.observable(80);
		self.ubermapBottomGap = ko.observable(160);

		self.parentWidth = ko.observable(0);
		self.parentHeight = ko.observable(0);
		self.minimapHeightBig = ko.computed(function() {
			return self.minimapWidthBig() / self.mapSidesRatio();
		});
		self.minimapHeightMedium = ko.computed(function() {
			return self.minimapWidthMedium() / self.mapSidesRatio();
		});
		self.minimapHeightSmall = ko.computed(function() {
			return self.minimapWidthSmall() / self.mapSidesRatio();
		});
		
		self.maxPlanetsForBig = ko.computed(function() {
			var maxHeight = self.parentHeight() - self.minimapsBottomMargin();
			return Math.floor(maxHeight / self.minimapHeightBig()) * (self.minimapAreaWidth() / self.minimapWidthBig());
		});
		self.maxPlanetsForMedium = ko.computed(function() {
			var maxHeight = self.parentHeight() - self.minimapsBottomMargin();
			return Math.floor(maxHeight / self.minimapHeightMedium()) * (self.minimapAreaWidth() / self.minimapWidthMedium());
		});

		self.minimapWidth = ko.computed(function() {
			if (self.planetCount() <= self.maxPlanetsForBig()) {
				return self.minimapWidthBig();
			} else if (self.planetCount() <= self.maxPlanetsForMedium()) {
				return self.minimapWidthMedium();
			} else {
				return self.minimapWidthSmall();
			}
		});
		
		self.minimapHeight = ko.computed(function() {
			if (self.planetCount() <= self.maxPlanetsForBig()) {
				return self.minimapHeightBig();
			} else if (self.planetCount() <= self.maxPlanetsForMedium()) {
				return self.minimapHeightMedium();
			} else {
				return self.minimapHeightSmall();
			}
		});
		
		self.optimalUberMapWidth = ko.computed(function() {
			return self.parentWidth() - self.minimapAreaWidth() - self.minimapUbermapGap();
		});
		
		self.optimalUberMapHeight = ko.computed(function() {
			return self.parentHeight() - self.ubermapTop() - self.ubermapBottomGap();
		});
		
		self.uberMapWidthDedicatesHeight = ko.computed(function() {
			var widthForHeight = self.optimalUberMapHeight() * self.mapSidesRatio();
			return widthForHeight > self.optimalUberMapWidth();
		});
		
		self.uberMapWidth = ko.computed(function() {
			return Math.floor(self.uberMapWidthDedicatesHeight() ? self.optimalUberMapWidth() : self.optimalUberMapHeight() * self.mapSidesRatio()); 
		});
		
		self.uberMapHeight = ko.computed(function() {
			return Math.floor(self.uberMapWidthDedicatesHeight() ? self.optimalUberMapWidth() / self.mapSidesRatio() : self.optimalUberMapHeight());
		});
		
		self.bodyWidth = ko.computed(function() {
			return self.minimapAreaWidth() + self.minimapUbermapGap() + self.uberMapWidth();
		});
		
		self.bodyHeight = ko.computed(function() {
			return self.ubermapTop() + self.uberMapHeight();
		});
	};
	
	function UnitModel(unit) {
		var self = this;
		
		self.transformComputed = undefined;
		
		self.id = ko.observable(unit.id);
		self.planetId = ko.observable(unit.planetId);
		self.spec = ko.observable();
		
		if (contains(unitSpecMapping[unit.spec], "Commander")) {
			self.spec("commander");
		} else {
			self.spec(unit.spec);
		}
		
		self.selected = ko.computed(function() {
			return model.selection()[self.id()];
		});
		
		self.svgZ = ko.computed(function() {
			var unitTypes = unitSpecMapping[unit.spec];
			var specPoints = 0;
			if (contains(unitTypes, "Commander")) {
				specPoints = 10;
			} else if (contains(unitTypes, "Important")) {
				specPoints = 7;
			} else if (contains(unitTypes, "Mobile")) {
				specPoints = 5;
			} else {
				specPoints = 1;
			}
			var selectedBonus = self.selected() ? 20 : 0;
			return specPoints + selectedBonus;
		});
				
		self.borderClass = ko.computed(function() {
			return self.selected() ? "selected_border" : "unselected_border";
		});
		
		self.army = ko.observable(unit.army);
		self.armyColor = ko.computed(function() {
			return model.armyColors()[self.army()];
		});
		self.x = ko.observable(unit.x);
		self.y = ko.observable(unit.y);
		self.z = ko.observable(unit.z);
		self.currentHp = ko.observable(unit.currentHp);
		self.maxHp = ko.observable(unit.maxHp);
		
		self.updateData = function(update) {
			self.planetId(update.planetId);
			self.x(update.x);
			self.y(update.y);
			self.z(update.z);
			self.currentHp(update.currentHp);
		};
		
	}
	
	var appendIconsHandling = function(self) {
		
		var createTransformComputed = function(unit) {
			return ko.computed(function() {
				var ll = convertToLonLan(unit.x(), unit.y(), unit.z());
				var projected = self.projection()(ll);
				var x = projected[0];
				var y = projected[1];
				var scale = self.widthSizeMod() * Math.sqrt(Math.sqrt(self.planetSizeMod())) * 0.4;
				return "translate( " + x + "," + y + "), scale(" + scale + ")";
			});
		};
		
		self.unitMap = {};
		self.units = ko.observableArray([]);
		
		self.zSortedUnits = ko.computed(function() {
			return _.sortBy(self.units(), function(unit) {
				return unit.svgZ();
			});
		});
		
		var specIdSrc = 0;
		self.usedSpecsMap = {};
		self.specMapNotify = ko.observable();
		
		self.unitSpecs = ko.computed(function() {
			self.specMapNotify();
			var result = [];
			_.forEach(self.usedSpecsMap, function(specId, key) {
				result.push(key);
			});
			return result;
		});
		
		var addUnitModel = function(unitm) {
			if (self.usedSpecsMap[unitm.spec()] === undefined) {
				self.usedSpecsMap[unitm.spec()] = "spec-"+specIdSrc;
				specIdSrc++;
				
				ko.tasks.processImmediate(function() { // the template in defs needs to be inserted before it is used
					self.specMapNotify.notifySubscribers();
				});
			}
			unitm.transformComputed = createTransformComputed(unitm);
			self.units.push(unitm);
			self.unitMap[unitm.id()] = unitm;
		};
		
		self.tryAddUnitModel = function(unitm) {
			if (unitm.planetId() === self.planet().id) {
				addUnitModel(unitm);
				return true;
			} else {
				return false;
			}
		};
		
		self.tryAddUnit = function(unit) {
			if (self.planet().id === unit.planetId) {
				var m = new UnitModel(unit);
				addUnitModel(m);
				return true;
			} else {
				return false;
			}
		};
		
		memoryPA.addUnitAddedListener(self.tryAddUnit);
		
		memoryPA.addUnitUpdatedListener(function(unit) {
			var m = self.unitMap[unit.id];
			if (m) {
				m.updateData(unit);
				if(unit.planetId !== self.planet().id) {
					model.addPotentialSpaceUnit(m);
					self.units.remove(function(u) {
						return unit.id === u.id();
					});
				}
			}
		});
		
		memoryPA.addUnitRemovedListener(function(ids) {
			self.units.remove(function(unit) {
				return ids[unit.id()] === true;
			});
			// unit specs are not removed from the defs, that just costs more than it is worth
		});
		
		
	};
	
	var appendMapDefaults = function(self, p) {
		self.planet = ko.observable(p);
		self.dead = ko.computed(function() {
			return self.planet().dead;
		});
		self.name = ko.computed(function() {
			return self.planet().name;
		});
		self.mappingObject = ko.computed(function() {
			var result = {
				id: "p-id-"+self.planet().id,
				name: self.name(),
			};
			if (model.mappingData() !== undefined) {
				var ps = model.mappingData().planets;
				for (var i = 0; i < ps.length; i++) {
					if (ps[i].name === self.name()) {
						result = ps[i];
						break;
					}
				}
			}
			return result;
		});
		
		self.graticule = ko.computed(function() {
			return d3.geo.graticule();
		});
		
		self.planetSizeMod = ko.computed(function() {
			return (700 / self.planet().radius);
		});
		
		self.widthSizeMod = ko.computed(function() {
			return self.width() / 200;
		});
		
		self.dotSizes = ko.computed(function() {
			return {
				"spawns": 2 * self.widthSizeMod() * self.planetSizeMod(),
				"metal": 1.5 * self.widthSizeMod() * self.planetSizeMod(),
				"land": 0.9 * self.widthSizeMod() * self.planetSizeMod(),
				"sea": 0.9 * self.widthSizeMod() * self.planetSizeMod(),
				"others": self.widthSizeMod() * self.planetSizeMod()
			};
		});
		
		self.projection = ko.computed(function() {
			var w = self.width();
			var h = self.height();
			// TODO this currently is fixed onto one projection. I am not yet sure if I want the options for more back.
			return d3.geo.winkel3().scale(39*(w/200)).translate([w/2, h/2]).precision(.1).rotate(self.rotation());
		});
		
		var thePath = d3.geo.path();
		thePath.pointRadius(function(o) {
			var dSizes = self.dotSizes();
			if (o && o.properties && o.properties.type) {
				var t = o.properties.type;
				if (dSizes[t]) {
					return dSizes[t];
				}
			}
			return dSizes["others"]; 
		});
		
		self.path = ko.computed(function() {
			thePath.projection(self.projection());
			self.dotSizes(); // create dependency
			return thePath;
		});
		
		self.d3b = ko.computed(function() {
			return [self.graticule(), self.path()];
		});
		
		self.layers = ko.computed(function() {
			return _.map(_.filter(['land', 'sea', 'metal', 'spawns'], function(layer) {
				return self.mappingObject()[layer] !== undefined;
			}), function(layer) {
				return {
					layer: layer,
					data: self.mappingObject()[layer]
				};
			});
		});
	};
	
	function MiniMapModel(p) {
		var self = this;
		
		self.width = model.minimapWidth;
		self.height = model.minimapHeight;
		
		// rotation is only possible in the x-axis, so north always points up
		self.rotationX = ko.observable(50);
		self.rotation = ko.computed(function() {
			return [self.rotationX(), 0];
		});
		self.setRotationByPixels = function(px) {
			self.rotationX(d3.scale.linear().domain([0, self.width()]).range([-180, 180])(px));
		};
		
		appendMapDefaults(self, p);
		
		self.mousemove = function(data, e) {
			if (e.altKey) {
				self.setRotationByPixels(e.offsetX);
			}
			self.showPreviewByMapXY(e.offsetX, e.offsetY);
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
					planet_id: self.planet().id,
					zoom: 'orbital'
				});
			};
		};
		
		self.mouseleave = function(data, e) {
			api.Panel.message(api.Panel.parentId, 'unit_alert.hide_preview');
		};
		
		var lookAtByMinimapXY = function(x, y) {
			var ll = self.projection().invert([x, y]);
			if (ll) {
				var c = convertToCartesian(ll[1], ll[0]);
				api.camera.lookAt({planet_id: self.planet().id, location: {x: c[0], y: c[1], z: c[2]}, zoom: "orbital"});
				api.camera.alignToPole();
			}
		};
		
		self.clickMinimap = function(data, e) {
			lookAtByMinimapXY(e.offsetX, e.offsetY);
		};
		
		var moveToByMiniMapXY = function(x, y, queue) {
			var ll = self.projection().invert([x, y]);
			if (ll) {
				var c = convertToCartesian(ll[1], ll[0]);
				var payload = {
					method: "moveSelected",
					arguments: [c[0], c[1], c[2], self.planet().id, queue],
				};
				api.Panel.message(api.Panel.parentId, 'runUnitCommand', payload);
			}
		};
		
		self.moveByMinimap = function(data, e) {
			moveToByMiniMapXY(e.offsetX, e.offsetY, e.shiftKey);
		};
		
		appendIconsHandling(self);
		
		console.log("created minimap: "+p.name);
	}
	
	function UberMapModel(p, partnerMiniMap) {
		var self = this;
		
		self.width = model.uberMapWidth;
		self.height = model.uberMapHeight;
		self.top = model.ubermapTop;
		self.left = ko.computed(function() {
			return model.minimapAreaWidth() + model.minimapUbermapGap();
		});
		
		self.rotation = partnerMiniMap.rotation;

		appendMapDefaults(self, p);
		
		self.visible = ko.computed(function() {
			return model.uberMapsInit() || model.showsUberMap() && model.activePlanet() === self.planet().id;
		});
		
		appendIconsHandling(self);
		
		console.log("created ubermap: "+p.name);
	}
	
	function SceneModel() {
		var self = this;
		
		self.uberMapsInit = ko.observable(false);
		
		self.selection = ko.observable({});
		
		self.armyColors = ko.observable({});
		
		self.mappingData = ko.observable();
		
		self.showsUberMap = ko.observable(true); // TODO
		self.activePlanet = ko.observable(1); // TODO
		
		self.planets = ko.observable([]);
		self.planetCount = ko.computed(function() {
			return self.planets().length;
		});
		
		self.minimaps = ko.observableArray([]);
		
		self.ubermaps = ko.observableArray([]);
		
		var spaceUnits = {};
		var tryPutUnitOnPlanet = function(m) {
			for (var i = 0; i < self.minimaps().length; i++) {
				if (self.minimaps()[i].tryAddUnitModel(m)) {
					return true;
				}
			}
			return false;
		};
		self.addPotentialSpaceUnit = function(m) {
			if (!tryPutUnitOnPlanet(m)) {
				spaceUnits[m.id()] = m;
			}
		};
		
		memoryPA.addUnitUpdatedListener(function(unit) {
			var m = spaceUnits[unit.id];
			if (m) {
				m.updateData(unit);
				if (tryPutUnitOnPlanet(m)) {
					spaceUnits[unit.id] = undefined;
				}
			}
		});
		
		appendLayoutFields(self);
		
		self.updateMaps = function() {
			self.uberMapsInit(true);
			var foundPlanets = [];
			for (var i = 0; i < self.minimaps().length; i++) {
				for (var j = 0; j < self.planets().length; j++) {
					if (self.planets()[j].name === self.minimaps()[i].name()) {
						foundPlanets.push(j);
						self.minimaps()[i].planet(self.planets()[j]);
						found = true;
						break;
					}
				}
			}
			for (var i = 0; i < self.planets().length; i++) {
				if (foundPlanets.indexOf(i) === -1) {
					var mm = new MiniMapModel(self.planets()[i], self);
					//self.minimaps.push(mm);
					self.ubermaps.push(new UberMapModel(self.planets()[i], mm));
				}
			}
			setTimeout(function() {
				self.uberMapsInit(false);
			}, 1000);
		};
		self.planets.subscribe(self.updateMaps);
		
		self.loadMappingData = function(payload) {
			var mapList = decode(localStorage["info.nanodesu.minimapkeys"]) || {};
			var dbName = "info.nanodesu.info.minimaps";
			
			if (mapList[payload.name]) {
				console.log("found minimap data in indexdb, will load key "+mapList[payload.name]);
				DataUtility.readObject(dbName, mapList[payload.name]).then(function(data) {
					self.mappingData(data);
					console.log(data);
				});
			} else if (mapData) {
				self.mappingData(data);
				console.log("found minimap data in systems.js");
				console.log(mapData);
			} else {
				console.log("No minimap data available for map with name "+payload.name);
			}
		};
	}
	
	model = new SceneModel();
	
	handlers.selection = function(payload) {
		var newSelection = {};
		_.forEach(payload.spec_ids, function(ids, spec) {
			_.forEach(ids, function(id) {
				newSelection[id] = true;
			});
		});
		
		model.selection(newSelection);
	};
	
	handlers.celestial_data = function(payload) {
		console.log(payload);
		model.planets(payload.planets);
		model.loadMappingData(payload);
	};
	
	handlers.setSize = function(size) {
		model.parentWidth(size[0]);
		model.parentHeight(size[1]);
	};
	
	handlers.setArmyColors = function(clrs) {
		console.log("got colors");
		console.log(clrs);
		model.armyColors(clrs);
	};
	
	app.registerWithCoherent(model, handlers);
	ko.applyBindings(model);
	
	setTimeout(function() {
		api.Panel.message(api.Panel.parentId, 'queryViewportSize');
		api.Panel.message(api.Panel.parentId, 'queryArmyColors');
	}, 500);
});