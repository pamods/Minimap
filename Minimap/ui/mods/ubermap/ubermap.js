console.log("loaded ubermap.js");

var paMemoryWebservice = "http://127.0.0.1:8184";

// do not scroll this scene please
window.onwheel = function(){ return false; }

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

ko.bindingHandlers.self = {
	update : function(element, valueAccessor, allBindings, viewModel, bindingContext) {
		valueAccessor()(element);
	}
};

ko.bindingHandlers.rubberband = {
	update: function(element) {
		model.rubberbandSelector.bindToElement(element);
	}
}

var groupedBooleansComputed = function() {
	var src = arguments;
	return ko.computed({
		read: function() {
			var result = true;
			for (var i = 0; i < src.length; i++) {
				if (!src[i]()) { // evaluate all for knockout
					result = false;
				}
			}
			return result;
		},
		write: function(value) {
			for (var i = 0; i < src.length; i++) {
				src[i](value);
			}
		}
	});
};

var invertedBoolean = function(src) {
	return ko.computed({
		read: function() {
			return !src();
		},
		write: function(value) {
			src(!value);
		}
	});
};

var model = undefined;
var handlers = {};

loadScript("coui://ui/mods/minimap/unitInfoParser.js");
loadScript("coui://ui/mods/minimap/alertsManager.js");

var unitSpecMapping = undefined;
unitInfoParser.loadUnitTypeMapping(function(mapping) {
	unitSpecMapping = mapping;
});

$(document).ready(function() {
	var assumedIconSize = 52;
	
	var hackRound = function(n) {
		return (0.5 + n) << 0
	};
	
	var selectUnitsById = function(ids) {
		engine.call("select.byIds", ids).then(function() {
			if (ids.length) {
				api.audio.playSound("/SE/UI/UI_Unit_Select");
			}
		});
	};
	
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
			$.getJSON(paMemoryWebservice+"/pa/updateId/"+lastUpdate+"/minPositionChange/"+minPositionChange, function(data) {
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
		
		setTimeout(refreshData, 1000);
	}
	
	var memoryPA = new MemoryDataReceiver(250);
	
	var isStructure = function(spec) {
		return contains(unitSpecMapping[spec], "Structure");
	};
	
	var isNavy = function(spec) {
		return contains(unitSpecMapping[spec], "Naval");
	};
	
	var isLand = function(spec) {
		return contains(unitSpecMapping[spec], "Land");
	};
	
	var isAir = function(spec) {
		return contains(unitSpecMapping[spec], "Air");
	};
	
	var isOrbital = function(spec) {
		return contains(unitSpecMapping[spec], "Orbital");
	};
	
	var isWorker = function(spec) {
		return contains(unitSpecMapping[spec], "Fabber"); 
	};
	
	var isPrio = function(spec) {
		if (!isStructure(spec)) {
			if (isWorker(spec)) {
				if (isNavy(spec)) {
					return model.selectsNavyWorkers();
				} else if (isLand(spec)) {
					return model.selectsLandWorkers();
				} else if (isAir(spec)) {
					return model.selectsAirWorkers();
				} else if (isOrbital(spec)) {
					return model.selectsOrbitalWorkers();
				} else {
					return false;
				}
			} else {
				if (isNavy(spec)) {
					return model.selectsNavyFighters();
				} else if (isLand(spec)) {
					return model.selectsLandFighters();
				} else if (isAir(spec)) {
					return model.selectsAirFighters();
				} else if (isOrbital(spec)) {
					return model.selectsOrbitalFighters();
				} else {
					return false;
				}
			}
		} else {
			return false;
		}
	};
	
	function UnitModel(unit) {
		var self = this;
		
		self.unit = unit;
		
		self.translate = undefined;
		self.scale = undefined;
		
		self.id = ko.observable(unit.id);
		self.planetId = ko.observable(unit.planetId);
		self.spec = ko.observable();
		
		if (contains(unitSpecMapping[unit.spec], "Commander")) {
			self.spec("commander");
		} else {
			self.spec(unit.spec);
		}
		
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
			
			return specPoints + (isPrio(unit.spec) ? 20 : 0);
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
			self.unit.x = update.x;
			self.unit.y = update.y;
			self.unit.z = update.z;
			self.unit.planetId = update.planetId;
			self.unit.currentHp = update.currentHp;
		};
	}
	
	var appendIconsHandling = function(self) {
		var createTranslateComputed = function(unit) {
			return ko.computed(function() {
				var ll = convertToLonLan(unit.x(), unit.y(), unit.z());
				var projected = self.projection()(ll);
				var x = projected[0];
				var y = projected[1];
				return [x, y];
			});			
		};
		
		// the same for all units
		self.unitScaleComputed = ko.computed(function() {
			return Math.sqrt(Math.sqrt(self.widthSizeMod())) * Math.sqrt(Math.sqrt(self.planetSizeMod())) * 0.4;
		});	

		self.unitMap = {};
		self.units = ko.observableArray([]);
		
		self.zSortedUnits = ko.computed(function() {
			return _.sortBy(self.units(), function(unit) {
				return unit.svgZ();
			});
		});
		
		var addUnitModel = function(unitm) {
			model.checkSpecExists(unitm.spec());
			unitm.translate = createTranslateComputed(unitm);
			unitm.scale = self.unitScaleComputed;
			self.units.push(unitm);
			self.unitMap[unitm.id()] = unitm;
		};
		
		self.tryAddUnitModel = function(unitm) {
			if (self.unitMap[unitm.id()] === undefined && unitm.planetId() === self.planet().id) {
				addUnitModel(unitm);
				return true;
			} else {
				return false;
			}
		};
		
		self.tryAddUnit = function(unit) {
			if (self.unitMap[unit.id] === undefined && self.planet().id === unit.planetId) {
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
					self.units.remove(function(u) {
						var r = unit.id === u.id();
						if (r) {
							self.unitMap[unit.id] = undefined;
						}
						return r;
					});
					model.addPotentialSpaceUnit(m.unit);
				}
			}
		});
		
		memoryPA.addUnitRemovedListener(function(ids) {
			self.units.remove(function(unit) {
				var r = ids[unit.id()] === true;
				if (r) {
					self.unitMap[unit.id()] = undefined;
				}
				return r;
			});
		});
		
		var fps = 10;
		var now;
		var then = Date.now();
		var interval = 1000/fps;
		var delta;
		
		self.drawIcons = function() {
			now = Date.now();
			delta = now - then;
			if (delta > interval) {
				then = now - (delta % interval);
				
				if (self.context() && (!self.visible || self.visible())) {
					var ctx = self.context();
					ctx.clearRect(0, 0, self.width(), self.height());
					
					var selectedUnits = [];
					var unselectedUnits = [];
					var selection = model.selection();
					_.forEach(self.zSortedUnits(), function(unit) {
						if (selection[unit.id()]) {
							selectedUnits.push(unit);
						} else {
							unselectedUnits.push(unit);
						}
					});
					
					_.forEach(unselectedUnits, function(unit) {
						model.drawUnit(ctx, unit);
					});
					
					_.forEach(selectedUnits, function(unit) {
						model.drawUnit(ctx, unit);
					});
				}
			}
			requestAnimationFrame(self.drawIcons);
		};
		
		self.drawIcons();
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
					// the case "name unset cameraId set" happens for planets which have only data directly from the memory reader
					if (ps[i].name === self.name() || ps[i].cameraId === self.planet().id) {
						ps[i].name = self.name();
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
				"spawns": 2 * Math.sqrt(self.widthSizeMod()) * self.planetSizeMod(),
				"metal": 1.5 * Math.sqrt(self.widthSizeMod()) * self.planetSizeMod(),
				"control": 2.5 * Math.sqrt(self.widthSizeMod()) * self.planetSizeMod(),
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
			return _.map(_.filter(['land', 'sea', 'metal', 'spawns', 'control'], function(layer) {
				return self.mappingObject()[layer] !== undefined;
			}), function(layer) {
				return {
					layer: layer,
					data: self.mappingObject()[layer]
				};
			});
		});
		
		self.lookAtByMapXY = function(x, y, zoom) {
			var ll = self.projection().invert([x, y]);
			if (ll) {
				var c = convertToCartesian(ll[1], ll[0]);
				zoom = zoom === undefined ? "orbital" : zoom;
				api.Panel.message(api.Panel.parentId, "setMainCamera", 
						{planet_id: self.planet().id, location: {x: c[0], y: c[1], z: c[2]}, zoom: zoom});
			}
		};
		
		self.canvas = ko.observable(undefined);
		self.context = ko.computed(function() {
			self.width();
			self.height();
			if (self.canvas()) {
				return self.canvas().getContext("2d");
			} else {
				return undefined;
			}
		});
	};
	
	var appendInputDefaults = function(self) {
		self.setRotationByPixels = function(px) {
			self.rotationX(d3.scale.linear().domain([0, self.width()]).range([-180, 180])(px));
		};
		
		self.defMousemove = function(data, e) {
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
		
		self.defMouseleave = function(data, e) {
			api.Panel.message(api.Panel.parentId, 'unit_alert.hide_preview');
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
		
		self.mouseenter = function() {
			model.mouseHoverMap = self;
		};
		
		self.switchCameraToPosition = function(x, y) {
			model.activePlanet(self.planet().id);
			self.lookAtByMapXY(x, y, "invalid");
		};
		
		var findIntersection = function(r1x, r1xhw, r1y, r1yhh, r2x, r2xhw, r2y, r2yhh) {
			var r1xr = r1x + r1xhw;
			var r2xr = r2x + r2xhw;
			var r1xl = r1x - r1xhw;
			var r2xl = r2x - r2xhw;
			
			var ixl = r1xl > r2xl ? r1xl : r2xl;
			var ixr = r1xr < r2xr ? r1xr : r2xr;
			
			if (ixl < ixr) {
				var r1yb = r1y + r1yhh;
				var r2yb = r2y + r2yhh;
				var r1yt = r1y - r1yhh;
				var r2yt = r2y - r2yhh;
				
				var iyt = r1yt > r2yt ? r1yt : r2yt;
				var iyb = r1yb < r2yb ? r1yb : r2yb;
				
				if (iyt < iyb) {
					return [ixl, ixr, iyt, iyb];
				} else {
					return undefined;
				}
			} else {
				return undefined;
			}
		};
		
		var checkSpecPixelHit = function(spec, ix) {
			for (var x = ix[0]; x <= ix[1]; x++) {
				for (var y = ix[2]; y <= ix[3]; y++) {
					if (model.testHitPixelOfSpec(spec, x, y)) {
						
						/*
						// fun debugging code: show the exact pixel of the bitmask of the icon that triggered the hit
						console.log("hit pixel "+x+"/"+y);
						var a = model.unitSpecPathsMap[spec+'_bits'];
						var str = ""; 
						for (var y1 = 0; y1 < 52; y1++) { 
							for (var x1 = 0; x1 < 52; x1++) { 
								str += (a[y1 * 52 + x1] ? ((x === x1 && y === y1) ? " " : "X") : "_");
							}
							str+="\n"
						}
						console.log(str);
						*/
						
						return true;
					}
				}
			}
			return false;
		};
		
		self.findUnitsBySpec = function(spec) {
			var units = [];
			
			_.forEach(self.units(), function(unit) {
				if (unit.spec() === spec) {
					units.push(unit.id());
				}
			});
			
			return units;
		};
		
		self.findUnitsInside = function(x, y, w, h) {
			// direct clicks tend to have 0 width and height, but it needs to be at minimum 1
			if (w === 0) {
				w++;
			}
			if (h === 0) {
				h++;
			}
			var directclick = w * h < 4;
			var $canvas = $(self.canvas());
			var offset = $canvas.offset();
			var canvasW = $canvas.width();
			var canvasH = $canvas.height();
			
			var foundPrioUnits = false;
			var nonPrioUnits = {};
			var unitsFound = {};
			
			x -= offset.left;
			y -= offset.top;
			
			if (x + w >= 0 && x <= canvasW && y + h >= 0 && y <= canvasH) {
				var scale = self.unitScaleComputed();
				var uw = (assumedIconSize * scale) / 2;
				var uh = uw;
				var hw = w/2;
				var hh = h/2;
				var xm = x + hw;
				var ym = y + hh;
				
				var zUnits = self.zSortedUnits();
				for (var u = zUnits.length - 1; u >= 0; u--) {
					var unit = zUnits[u];
					
					var translate = unit.translate();
					// this is the center of the unit-icon
					var ux = translate[0];
					var uy = translate[1];
					
					// hitting the middle pixel of an icon is a quick way out of these tests
					// dont do it for direct clicks
					if (!directclick && ux >= x && ux <= x + w && uy >= y && uy <= y + h) {
						if (isPrio(unit.spec())) {
							foundPrioUnits = true;
							unitsFound[unit.id()] = true;
							unitsFound.found = true;
						} else {
							nonPrioUnits[unit.id()] = true;
							nonPrioUnits.found = true;
						}
					} else {
						var intersection = findIntersection(ux, uw, uy, uh, xm, hw, ym, hh);
						if (intersection) {
							intersection[0] = hackRound((intersection[0] - ux + uw) / scale);
							intersection[1] = hackRound((intersection[1] - ux + uw) / scale);
							intersection[2] = hackRound((intersection[2] - uy + uh) / scale);
							intersection[3] = hackRound((intersection[3] - uy + uh) / scale);
							if (checkSpecPixelHit(unit.spec(), intersection)) {
								if (isPrio(unit.spec())) {
									foundPrioUnits = true;
									unitsFound[unit.id()] = true;
									unitsFound.found = true;
								} else {
									nonPrioUnits[unit.id()] = true;
									nonPrioUnits.found = true;
								}
								
								if (directclick) {
									break;
								}
							}
						}
					}
				}
			}
			
			return foundPrioUnits ? unitsFound : nonPrioUnits;
		};
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
		
		appendMapDefaults(self, p);
		
		appendIconsHandling(self);
		
		appendInputDefaults(self);
		self.mousemove = self.defMousemove;
		self.mouseleave = self.defMouseleave;
		
		self.clickMinimap = function(data, e) {
			model.activePlanet(self.planet().id);
			self.lookAtByMapXY(e.offsetX, e.offsetY);
		};
		
		console.log("created minimap: "+p.name);
	}
	
	function UberMapModel(p, partnerMiniMap) {
		var self = this;
		
		// the elements are hidden offscreen using  the top value
		// that turns out to be faster in some situations and has less issues with the svg rendering,
		// which seems to fail to adjust to resize events while it is set to be really visibility: none
		self.visible = ko.computed(function() {
			return model.showsUberMap() && model.activePlanet() === self.planet().id;
		});
		
		self.width = model.uberMapWidth;
		self.height = model.uberMapHeight;
		
		self.top = ko.computed(function() {
			// if not visible hide offscreen
			return self.visible() ? model.ubermapTop() : -1000;
		});
		self.left = model.ubermapLeft;
		
		self.rotationX = partnerMiniMap.rotationX;
		self.rotation = partnerMiniMap.rotation;

		appendMapDefaults(self, p);
		
		appendIconsHandling(self);
		
		appendInputDefaults(self);
		self.mousemove = self.defMousemove;
		self.mouseleave = self.defMouseleave;
		
		self.click = function(data, e) {
			
		};
		
		console.log("created ubermap: "+p.name);
	}
	
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
		self.ubermapLeft = ko.computed(function() {
			return self.minimapAreaWidth() + self.minimapUbermapGap();
		});
		self.ubermapBottomGap = ko.observable(180);
		
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
			return self.showsUberMap() ? self.parentWidth() : self.minimapAreaWidth(); // + self.minimapUbermapGap() + self.uberMapWidth();
		});
		
		self.bodyHeight = ko.computed(function() {
			return self.showsUberMap() ? self.parentHeight() : self.ubermapTop() + self.uberMapHeight();
		});
	};
	
	function SceneModel() {
		var self = this;
		
		self.mouseHoverMap = undefined;

		var hiddenCanvas = document.createElement("canvas");
		hiddenCanvas.width = assumedIconSize;
		hiddenCanvas.height = assumedIconSize;
		var hiddenCtx = hiddenCanvas.getContext('2d');
		hiddenCtx.fillStyle = "black";
		hiddenCtx.translate(assumedIconSize / 2, assumedIconSize / 2);
		
		self.unitSpecPathsMap = {};
		self.checkSpecExists = function(spec) {
			if (self.unitSpecPathsMap[spec] === undefined) {
				// create Path2D for the svg path string
				var b = new Path2D(strategicIconPaths[spec + '_border'] || strategicIconsPaths.fallback_border);
				var f = new Path2D(strategicIconPaths[spec + '_fill'] || strategicIconsPaths.fallback_fill);
				self.unitSpecPathsMap[spec+"_b"] = b;
				self.unitSpecPathsMap[spec+"_f"] = f;
				
				// create boolean arrays for quick hit detection for pixel perfect
				hiddenCtx.clearRect(-assumedIconSize, -assumedIconSize, assumedIconSize*2, assumedIconSize*2);
				hiddenCtx.fill(b);
				hiddenCtx.fill(f);
				var imgData = hiddenCtx.getImageData(0, 0, assumedIconSize, assumedIconSize);
				var bitMask = [];
				for (var i = 0; i < imgData.data.length; i+=4) {
					bitMask.push(imgData.data[i+3] !== 0)
				}
				self.unitSpecPathsMap[spec+"_bits"] = bitMask;
				self.unitSpecPathsMap[spec] = true;
			}
		};
		
		// icons are cached as an image in a fixed resolution that is copied onto the visible canvas
		// for massive performance gains
		self.unitSpecsImageCache = {};
		self.getUnitSpecImage = function(spec, fill, armycolor, selected) {
			var fStr = fill ? ("fill" + armycolor) : ("border" + selected);
			var key = spec + fStr;
			var obj = self.unitSpecsImageCache[key]; 
			if (obj === undefined) {
				var canvas = document.createElement("canvas");
				canvas.width = assumedIconSize;
				canvas.height = assumedIconSize;
				var ctx = canvas.getContext("2d");
				ctx.translate(assumedIconSize / 2, assumedIconSize / 2);
				
				var path = fill ? self.unitSpecPathsMap[spec+"_f"] : self.unitSpecPathsMap[spec+"_b"];
				
				if (fill) {
					ctx.fillStyle = armycolor;
				} else {
					if (selected) {
						ctx.fillStyle = "white";
					} else {
						ctx.fillStyle = "black";
					}
				}
				ctx.fill(path);
				
				obj = canvas;
								
				self.unitSpecsImageCache[key] = obj;
			}
			return obj;
		};
		
		self.testHitPixelOfSpec = function(spec, x, y) {
			return x >= 0 && x < assumedIconSize && y >= 0 && y < assumedIconSize && self.unitSpecPathsMap[spec+"_bits"][y * assumedIconSize + x];
		};
		
		self.minimaps = ko.observableArray([]);
		self.ubermaps = ko.observableArray([]);
		
		self.selection = ko.observable({});
		
		self.drawUnit = function(ctx, unit) {
			var fillImg = self.getUnitSpecImage(unit.spec(), true, unit.armyColor(), undefined);
			var borderImg = self.getUnitSpecImage(unit.spec(), false, undefined, self.selection()[unit.id()]);

			var t = unit.translate();
			var s = unit.scale();
			var size = assumedIconSize * s;

			// integer numbers are faster for the canvas
			var x = hackRound(t[0] + (-size/2));
			var y = hackRound(t[1] + (-size/2));
			size = hackRound(size);
			
			if (x === 0 && y === 0 && isOrbital(unit.spec())) { // do not draw orbital units while they are being build, their position is buggy while that happens and is always 0/0
				return;
			}
			
			ctx.drawImage(fillImg, x, y, size, size);
			ctx.drawImage(borderImg, x, y, size, size);
		};
		
		self.armyColors = ko.observable({});
		
		self.mappingData = ko.observable();
		
		self.showsUberMap = ko.observable(false);
		self.activePlanet = ko.observable(0);
		
		self.showsUberMap.subscribe(function(v) {
			api.Panel.message(api.Panel.parentId, 'setTopRightPreview', v);
			api.Panel.message(api.Panel.parentId, 'setUberMapState', v);
		});
		
		self.findActiveUberMap = function() {
			for (var i = 0; i < self.ubermaps().length; i++) {
				if (self.ubermaps()[i].visible()) {
					return self.ubermaps()[i];
				}
			}
			return undefined;
		};
		
		self.planets = ko.observable([]);
		self.planetCount = ko.computed(function() {
			return self.planets().length;
		});
		
		var spaceUnits = {}; // spaaace. I am in space.
		var tryPutUnitOnPlanet = function(m) {
			var added = false;
			_.forEach(self.minimaps(), function(mm) {
				if (!added) {
					added = mm.tryAddUnit(m) || added;
				}
			});
			_.forEach(self.ubermaps(), function(um) {
				if (!added) {
					added = um.tryAddUnit(m) || added;
				}
			});
			return added;
		};
		self.addPotentialSpaceUnit = function(m) {
			if (!tryPutUnitOnPlanet(m)) {
				spaceUnits[m.id] = m;
			}
		};
		
		memoryPA.addUnitUpdatedListener(function(unit) {
			var m = spaceUnits[unit.id];
			if (m) {
				m.x = unit.x;
				m.y = unit.y;
				m.z = unit.z;
				m.planetId = unit.planetId;
				m.currentHp = unit.currentHp;
				if (tryPutUnitOnPlanet(m)) {
					spaceUnits[unit.id] = undefined;
				}
			}
		});
		
		appendLayoutFields(self);
		
		self.updateMaps = function() {
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
					self.minimaps.push(mm);
					self.ubermaps.push(new UberMapModel(self.planets()[i], mm));
				}
			}
		};
		self.planets.subscribe(self.updateMaps);
		
		self.loadMappingData = function(payload) {
			var mapList = decode(localStorage["info.nanodesu.minimapkeys"]) || {};
			var mapData = minimapSystems[payload.name];
			var dbName = "info.nanodesu.info.minimaps";

			
			if (mapList[payload.name]) {
				console.log("found minimap data in indexdb, will load key "+mapList[payload.name]);
				DataUtility.readObject(dbName, mapList[payload.name]).then(function(data) {
					self.queryAndAttachFeatures(data, "metal", "metal_splat_02.json", function(d) {
						self.queryAndAttachFeatures(data, "control", "control_point_01.json", function(d) {
							console.log(d);
							self.mappingData(d);
						});
					});
				});
			} else if (mapData) {
				console.log("systems.js seems to know this system");
				self.queryAndAttachFeatures(mapData, "metal", "metal_splat_02.json", function(d) {
					self.queryAndAttachFeatures(data, "control", "control_point_01.json", function(d) {
						console.log(d);
						self.mappingData(d);
					});
				});
			} else {
				console.log("No prepared minimap data available for map with name "+payload.name);
				self.queryAndAttachFeatures({planets: []}, "metal", "metal_splat_02.json", function(d) {
					self.queryAndAttachFeatures(data, "control", "control_point_01.json", function(d) {
						console.log(d);
						self.mappingData(d);
					});
				});
			}
		};
		
		self.queryAndAttachFeatures = function(data, attachKey, key, cb) {
			$.getJSON(paMemoryWebservice+"/pa/query/features/"+key, function(result) {
				var ars = {};
				for (var i = 0; i < result.length; i++) {
					var ar = ars[result[i].planetId];
					if (ar === undefined) {
						ar = [];
					}
					ar.push(convertToLonLan(result[i].x, result[i].y, result[i].z));
					ars[result[i].planetId] = ar;
				}
				
				_.forEach(ars, function(value, key) {
					
					var index = -1;
					
					for (var i = 0; i < data.planets.length; i++) {
						if (data.planets[i].cameraId == key) {
							index = i;
							break;
						}
					}
					
					var planet = data.planets[index];
					if (!planet) {
						planet = {
							cameraId: Number(key),
							id: "p-id-" + key
						};
						data.planets.push(planet);
					}
					planet[attachKey] = {
						"type" : "FeatureCollection",
						"features" : [ {
							"type" : "Feature",
							"geometry" : {
								"type" : "MultiPoint",
								"coordinates" : value
							}
						}],
						"source": "memory", // just a marker for me to be sure where this data came from when debugging
						"properties": {
							"type": attachKey
						}
					};
				});
				cb(data);
			}).fail(function() {
				console.log("failed to get feature data from webservice :(");
				cb(data);
			});
		};

		self.selectsNavyFighters = ko.observable(false);
		self.selectsLandFighters = ko.observable(false);
		self.selectsAirFighters = ko.observable(false);
		self.selectsOrbitalFighters = ko.observable(false);
		
		self.selectsNavyWorkers = ko.observable(false);
		self.selectsLandWorkers = ko.observable(false);
		self.selectsAirWorkers = ko.observable(false);
		self.selectsOrbitalWorkers = ko.observable(false);
		
		self.selectsAllNavy = groupedBooleansComputed(self.selectsNavyWorkers, self.selectsNavyFighters);
		self.selectsAllLand = groupedBooleansComputed(self.selectsLandWorkers, self.selectsLandFighters);
		self.selectsAllAir = groupedBooleansComputed(self.selectsAirWorkers, self.selectsAirFighters);
		self.selectsAllOrbital = groupedBooleansComputed(self.selectsOrbitalWorkers, self.selectsOrbitalFighters);
		self.selectsAllFighters = groupedBooleansComputed(self.selectsNavyFighters, self.selectsLandFighters, self.selectsAirFighters, self.selectsOrbitalFighters);
		self.selectsAllWorkers = groupedBooleansComputed(self.selectsNavyWorkers, self.selectsLandWorkers, self.selectsAirWorkers, self.selectsOrbitalWorkers);
		
		self.selectsAll = groupedBooleansComputed(self.selectsAllFighters, self.selectsAllWorkers);
		
		self.selectsAllFighters(true);
		
		self.selectsRows = [{
			elements: [{
				descr: "NF",
				tool: "Navy Fighters",
				obs: self.selectsNavyFighters
			}, {
				descr: "LF",
				tool: "Land Fighters",
				obs: self.selectsLandFighters
			}, {
				descr: "AF",
				tool: "Air Fighters",
				obs: self.selectsAirFighters
			}, {
				descr: "OF",
				tool: "Orbital Fighters",
				obs: self.selectsOrbitalFighters
			}, {
				descr: "F",
				tool: "All Fighters",
				obs: self.selectsAllFighters
			}]
		},{
			elements: [{
				descr: "NW",
				tool: "Navy Workers",
				obs: self.selectsNavyWorkers
			}, {
				descr: "LW",
				tool: "Land Workers",
				obs: self.selectsLandWorkers
			}, {
				descr: "AW",
				tool: "Air Workers",
				obs: self.selectsAirWorkers
			}, {
				descr: "OW",
				tool: "Orbital Workers",
				obs: self.selectsOrbitalWorkers
			}, {
				descr: "W",
				tool: "All Workers",
				obs: self.selectsAllWorkers
			}]
		}, {
			elements: [{
				descr: "N",
				tool: "All Navy",
				obs: self.selectsAllNavy
			}, {
				descr: "L",
				tool: "All Land",
				obs: self.selectsAllLand
			}, {
				descr: "A",
				tool: "All Air",
				obs: self.selectsAllAir
			}, {
				descr: "O",
				tool: "All Orbital",
				obs: self.selectsAllOrbital
			}, {
				descr: "ALL",
				tool: "Everything",
				obs: self.selectsAll
			}]
		}];
		
		self.shiftState = ko.observable(false);
		self.ctrlState = ko.observable(false);
		self.rubberbandVisible = ko.observable(false);
		self.rubberbandSelector = makeSelector();
		self.rubberbandSelector.setRubberbandListener(function(a, v) {
			self.rubberbandVisible(v);
		});
		self.rubberbandSelector.bindToElement("#selection_layer");
		self.showsUberMap.subscribe(function(v) {
			self.rubberbandSelector.setEnabled(v);
		});
		self.rubberbandSelector.setEnabled(self.showsUberMap());
		
		var lastSelectTime = 0;
		
		self.rubberbandSelector.addListener(function(x, y, w, h) {
			var targets = {};
			
			var hitMap = undefined;
			
			// find the units clicked
			var um = self.findActiveUberMap();
			if (um) {
				var r = um.findUnitsInside(x, y, w, h);
				if (r.found) {
					hitMap = um;
					_.merge(targets, r);
				}
			}
			_.forEach(self.minimaps(), function(m) {
				var r = m.findUnitsInside(x, y, w, h);
				if (r.found) {
					hitMap = m;
					_.merge(targets, r);
				}
			});
			
			// check for double click selects and modify selection accordingly
			var ar = [];
			_.forEach(targets, function(v, k) {
				if (k !== "found") {
					ar.push(Number(k));
				}
			});

			if (ar.length === 1 && w * h < 4) {
				var isDoubleSelect = (new Date().getTime() - lastSelectTime) < 500;
				lastSelectTime = new Date().getTime();
				if (isDoubleSelect && hitMap) {
					ar = hitMap.findUnitsBySpec(hitMap.unitMap[ar[0]].spec());
				}
			}
			
			targets = {};
			for (var i = 0; i < ar.length; i++) {
				targets[ar[i]] = true;
			}
			
			// handle ctrl and shift the same way PA itself does
			if (self.ctrlState() && self.shiftState()) {
				var rm = targets;
				targets = {};
				_.forEach(self.selection(), function(v, id) {
					if (!rm[id]) {
						targets[id] = true;
					}
				});
			} else if (self.ctrlState() || self.shiftState()) {
				_.merge(targets, self.selection());
			}
			
			ar = [];
			_.forEach(targets, function(v, k) {
				if (k !== "found") {
					ar.push(Number(k));
				}
			});
			
			selectUnitsById(ar);
		});
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
		ko.computed.deferUpdates = false;
		ko.processAllDeferredBindingUpdates();
		model.parentWidth(size[0]);
		model.parentHeight(size[1]);
		ko.computed.deferUpdates = true;
		// basically I am trying to get rid of weird resize bugs... (success it seems)
		ko.processAllDeferredBindingUpdates();
	};
	
	handlers.setArmyColors = function(clrs) {
		console.log("got colors");
		console.log(clrs);
		model.armyColors(clrs);
	};
	
	handlers.setUberMapVisible = function(show) {
		model.showsUberMap(show);
	};
	
	handlers.zoomIntoUberMap = function(args) {
		var aum = model.mouseHoverMap;
		var pageX = args[0];
		var pageY = args[1];
		var offset = $(aum.canvas()).offset();
		var x = pageX - offset.left;
		var y = pageY - offset.top;
		model.showsUberMap(false);
		if (aum) {
			aum.switchCameraToPosition(x, y);
		}
	};
	
	handlers.zoom_level = function(payload) {
//		console.log("zoom level");
//		console.log(payload);
	};
	
	handlers.focus_planet_changed = function(payload) {
//		console.log("focus planet");
//		console.log(payload);
		// TOO buggy to be helpful
	};
	
	handlers.shiftState = function(state) {
		model.shiftState(state);
	};
	
	handlers.ctrlState = function(state) {
		model.ctrlState(state);
	};
	
	app.registerWithCoherent(model, handlers);
	ko.applyBindings(model);
	
	setTimeout(function() {
		api.Panel.message(api.Panel.parentId, 'queryViewportSize');
		api.Panel.message(api.Panel.parentId, 'queryArmyColors');
		api.Panel.message(api.Panel.parentId, 'setUberMapState', model.showsUberMap());
	}, 500);
});