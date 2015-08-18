// This is full of WIP and legacy stuff.... but TITANS... wanna play not clean up and enhance this....
// works good enough for now...

console.log("loaded ubermap.js");

var useUberMaps = (api.settings.isSet("ui", "ubermap_enabled", true) || "ON") === "ON";

var paMemoryWebservice = "http://127.0.0.1:8184";
var assumedIconSize = 52;
var noMemoryReaderPollTime = 10000;
var unitPollTime = useUberMaps ? 500 : 750; // no ubermaps implies the user has a desire for less resource usage
var minPositionChange = 3;
var fps = 15;

// do not scroll this scene please ?!
window.onscroll = function() {
	window.scrollTo(0, 0);
};
$(document).mousedown(function(e){if(e.which==2)return false});

var clearSpec = function(spec) {
	var strip = /.*\.json/.exec(spec);
	if (strip) {
		spec = strip.pop();
	}
	return spec;
};

var vecLengthSq = function(pos) {
	return pos[0]*pos[0] + pos[1]*pos[1] + pos[2]*pos[2];
};

var vecLength = function(pos) {
	return Math.sqrt(vecLengthSq(pos));
};

var normalizeVec = function(pos) {
	var l = vecLength(pos);
	return [(pos[0]/l), (pos[1]/l), (pos[2]/l)];
};

var vecDistSq = function(a, b) {
	var d0 = a[0]-b[0];
	var d1 = a[1]-b[1];
	var d2 = a[2]-b[2];
	return d0*d0 + d1*d1 + d2*d2;
};

var vecDist = function(a, b) {
	return Math.sqrt(vecDistSq(a, b));
};

var scaleVec = function(a, s) {
	return [a[0] * s, a[1] * s, a[2] * s];
};

var cross = function(u, v) {
	return [u[1]*v[2] - u[2]*v[1], u[2]*v[0] - u[0]*v[2], u[0]*v[1] - u[1]*v[0]];
};

var dot = function(u, v) {
	return u[0]*v[0] + u[1]*v[1] + u[2]*v[2];
};

var addVec = function(a, b) {
	return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
};

var rotatePosition = function(pos, offset, radius, rotationTime) {
	var axis = normalizeVec(pos);
	var perp = undefined;
	if (axis[2] !== 0) {
		perp = [1, 1, (-axis[0]-axis[1])/axis[2]];
	} else if (axis[1] !== 0) {
		perp = [1, (-axis[0]-axis[2])/axis[1], 1];
	} else {
		perp = [(-axis[1]-axis[2])/axis[0], 1, 1];
	}
	perp = scaleVec(normalizeVec(perp), radius);
	pos = addVec(pos, perp);
	var oneRotationTime = rotationTime || 10000;
	return axisRotate(pos, axis, Date.now()*((2*Math.PI)/oneRotationTime) + offset);
};

//https://en.wikipedia.org/wiki/Rodrigues%27_rotation_formula
var axisRotate = function(vec, axis, radian) {
	var partA = scaleVec(vec, Math.cos(radian));
	var partB = scaleVec(cross(axis, vec), Math.sin(radian));
	var partC = scaleVec(axis, dot(axis, vec)*(1 - Math.cos(radian)));
	return addVec(partA, addVec(partB, partC));
};

var fibonacciSpiral = function(n, radius) {
	var results = [];
	var dlong = Math.PI*(3-Math.sqrt(5));
	var dz = 2/n;
	var long = 0;
	var z = 1 - dz/2;
	for (var k = 0; k < n; k++) {
		r = Math.sqrt(1 - z*z);
		results.push([Math.cos(long) * r * radius, Math.sin(long) * r * radius, z * radius]);
		z = z - dz;
		long = long + dlong;
	}
	return results;
};

var testCountForRadius = function(radius, testsPerSqKm) {
	var sqkm = (4 * Math.PI * radius * radius) / 10E5;
	var testCount = (sqkm * testsPerSqKm);
	return Math.floor(testCount);
};

var getTestLocsForRadius = function(radius) {
	var lr = Math.min(750, radius);
	return fibonacciSpiral(testCountForRadius(lr, 2500), radius);
};

var calcKey = function(x, y, z) {
	return (x & 0x3FF) | ((y & 0x3FF) << 10) | ((z & 0x3FF) << 20);
};

function SpatialCloud(cellSize, store) {
	var self = this;
	
	store = store || {};
	cellSize = store.cellSize || cellSize;
	
	self.extremeHeights = store.extremeHeights || {overallMax: 0, overallMin: 9999};
	
	self.data = store.data || {};
	self.getCellSize = function() {
		return cellSize;
	};
	self.getStore = function() {
		return {
			data: self.data,
			cellSize: cellSize,
			extremeHeights: self.extremeHeights
		};
	};
	
	var getKey = function(pos) {
		var x = Math.floor(pos[0] / cellSize);
		var y = Math.floor(pos[1] / cellSize);
		var z = Math.floor(pos[2] / cellSize);
		return calcKey(x, y, z);
	};
	
	self.addToCloud = function(point) {
		var extremes = self.extremeHeights[point.type] || {min: 9999, max: 0};
		if (point.height > extremes.max) {
			extremes.max = point.height;
			if (self.extremeHeights.overallMax < extremes.max) {
				self.extremeHeights.overallMax = extremes.max;
			}
		}
		if (point.height < extremes.min) {
			extremes.min = point.height;
			if (self.extremeHeights.overallMin > extremes.min) {
				self.extremeHeights.overallMin = extremes.min;
			}
		}
		
		self.extremeHeights[point.type] = extremes;
		var key = getKey(point.normalPosition);
		var d = self.data[key];
		if (d === undefined) {
			d = [];
		}
		d.push(point);
		self.data[key] = d;
	};
	
	self.avgCellSize = function() {
		var cells = 0;
		var elements = 0;
		_.forEach(self.data, function(elem) {
			cells++;
			elements += elem.length;
		});
		return elements / cells;
	};
	
	self.findQueryRange = function(testPoint, n, cancelAt) {
		var result = 0;
		do {
			result+=1;
		} while(self.queryPoints(testPoint, result).length < n && result < cancelAt);
		return result;
	};
	
	self.queryPoints = function(pos, radius) {
		var sqR = radius*radius;
		var f = [];
		var range = Math.ceil(radius / cellSize);
		var x = Math.floor(pos[0] / cellSize);
		var y = Math.floor(pos[1] / cellSize);
		var z = Math.floor(pos[2] / cellSize);
		for (var xo = -range; xo <= range; xo++) {
			for (var yo = -range; yo <= range; yo++) {
				for (var zo = -range; zo <= range; zo++) {
					var xk = x + xo;
					var yk = y + yo;
					var zk = z + zo;
					var k = calcKey(xk, yk, zk);
					var cell = self.data[k];
					if (cell) {
						for (var i = 0; i < cell.length; i++) {
							if (vecDistSq(cell[i].normalPosition, pos) < sqR) {
								f.push(cell[i]);
							}
						}
					}
				}
			}
		}
		return f;
	};
}

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

var drawLine = function(ctx, x1, y1, x2, y2, clr) {
	ctx.beginPath();
	ctx.moveTo(x1, y1);
	ctx.lineTo(x2, y2);
	ctx.strokeStyle = clr;
	ctx.stroke();
};

var drawDot = function(ctx, x1, y1, radius, clr) {
	ctx.beginPath();
	ctx.arc(x1, y1, radius, 0, 2 * Math.PI, false);
	ctx.fillStyle = clr;
	ctx.fill();
};

var drawCircle = function(ctx, x1, y1, radius, clr) {
	ctx.beginPath();
	ctx.arc(x1, y1, radius, 0, 2 * Math.PI, false);
	ctx.strokeStyle = clr;
	ctx.stroke();
};

var drawText = function(ctx, x1, y1, txt, clr) {
	ctx.font = "30px Verdana";
	ctx.fillStyle = clr;
	ctx.fillText(txt, x1, y1);
};

var startTime = Date.now();

var dottedLine = function(x1, y1, z1, x2, y2, z2, dotDistance, speedFactor, cb) {
	var dx = x2 - x1;
	var dy = y2 - y1;
	var dz = z2 - z1;
	
	var length = Math.sqrt(dx*dx + dy*dy + dz*dz);
	var dotCount = Math.ceil(length / dotDistance);
	
	var dx1 = dx / length;
	var dy1 = dy / length;
	var dz1 = dz / length;
	
	var ddx = dx / dotCount;
	var ddy = dy / dotCount;
	var ddz = dz / dotCount;
	
	var time = (Date.now() - startTime) * speedFactor;
	
	for (var i = 0; i < dotCount; i++) {
		var incx = ddx * i;
		var incy = ddy * i;
		var incz = ddz * i;

		incx = (incx + (time * dx1)) % dx;
		incy = (incy + (time * dy1)) % dy;
		incz = (incz + (time * dz1)) % dz;
		
		var px = x1 + incx;
		var py = y1 + incy;
		var pz = z1 + incz;
		
		cb(px, py, pz);
	}
};

var dottedCircle = function(x, y, z, radius, dots, rotationTime, cb) {
	var offsetSteps = 2*Math.PI / dots;
	var offset = 0;
	for (var i = 0; i < dots; i++) {
		var p = rotatePosition([x, y, z], offset, radius, rotationTime);
		cb(p[0], p[1], p[2]);
		offset += offsetSteps;
	}
};

var model = undefined;
var handlers = {};

loadScript("coui://ui/mods/ubermap/unitInfoParser.js");
loadScript("coui://ui/mods/ubermap/alertsManager.js");

var unitSpecMapping = undefined;
unitInfoParser.loadUnitTypeMapping(function(mapping) {
	unitSpecMapping = mapping;
	_.forEach(unitSpecMapping, function(val, key) {
		var ckey = clearSpec(key);
		if (ckey !== key) {
			unitSpecMapping[ckey] = val;
		}
	});
});

var memoryPA = undefined;

$(document).ready(function() {
	var hackRound = function(n) {
		return (0.5 + n) << 0;
	};
	
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
	
	var cameraLocation = ko.observable();
	
	function UnitAPIAdapter() {
		var self = this;
		var world = api.getWorldView(0);
		
		world.setServerCulling(false); // TODO experiment with flipping this on/off on regular basis
		
		var findUnitZ = function(spec) {
			if (unitSpecMapping) {
				var unitTypes = unitSpecMapping[spec];
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
				
				return specPoints + (isPrio(spec) ? 20 : 0);
			} else {
				return 1;
			}
		};
		
		var lastStateRegister = {};
		
		self.clearLastStateRegister = function() {
			lastStateRegister = {};
		};
		
		self.queryAllInfo = function(callback, planetIndex) {
			var spawnedCalls = 0;
			var finishedCalls = 0;
			var unitsMap = {};
			var unitIds = [];
			_.forEach(model.armyIndexIdMap(), function(armyId, armyIndex) {
				spawnedCalls++;
				armyIndex = Number(armyIndex);
				world.getArmyUnits(armyIndex, planetIndex).then(function(data) {
					try {
						_.forEach(data, function(elem, key) {
							key = clearSpec(key);
							_.forEach(elem, function(unitId) {
								unitsMap[unitId] = {
									id: unitId,
									army: armyId,
									spec: key,
									z: findUnitZ(key)
								};
								unitIds.push(unitId);
							});
						});
					} catch (e) {
						console.log(e.stack);
					} finally {
						finishedCalls++;
					}
				});
			});
			
			var unitsEqual = function(a, b) {
				if (a.health !== b.health) {
					return false;
				}
				
				if (a.built_frac !== b.built_frac) {
					return false;
				}
				
				if (a.planet !== b.planet) {
					return false;
				}
				
				if (a.pos ^ b.pos) {
					return false;
				} else if (a.pos) {
					for (var i = 0; i < a.pos.length; i++) {
						if (a.pos[i] !== b.pos[i]) {
							return false;
						}
					}
				}
				
				if (a.orient ^ b.orient) {
					return false;
				} else if (a.orient) {
					for (var i = 0; i < a.orient.length; i++) {
						if (a.orient[i] !== b.orient[i]) {
							return false;
						}
					}
				}
				
				return true;
			};
			
			var checkLastUpdateTime = function(unit) {
				if (!model.isArmyVisible(model.armyIdIndexMap()[unit.army]) && !isStructure(unit.spec)) {
					var lastState = lastStateRegister[unit.id];
					if (lastState) {
						if (!unitsEqual(unit, lastState.data)) {
							lastState.time = Date.now();
							lastState.data = unit;
						}
						return lastState.time;
					} else {
						var state = {
							time: Date.now(),
							data: unit
						};
						lastStateRegister[unit.id] = state;
						return state.time;
					}
				} else {
					return undefined;
				}
			};
			
			/*
			var hashOrderBase = function(stepSize, maxRotation, positions, units) {

			};
			
			var hashOrder = function(positions, units) {
				var hash = 0;
				var rotator = 0;
				for (var i = 0; i < positions.length; i++) {
					rotator += 3;
					rotator = rotator % 24;
					hash = hash ^ (positions[i] << rotator);
				}
				
				var l = Math.min(units.length, 100);
				for (var i = 0; i < l; i++) {
					rotator += 3;
					rotator = rotator % 24;
					hash = hash ^ (units[i] << rotator);
				}
				
//				console.log(positions + " and " + units + " produce " + hash);
				return hash;
			};
			
			var testHashOrder = function() {
				
				var bestA = 1;
				var bestB = 1;
				var bestC = 1;
				var best = 9999999;
				
				for (var a = 5; a < 20; a++) {
					for (var b = 5; b < 20; b++) {
						for (var c = 10; c < 30; c++) {
							var cur = 0;
							
							var hashResults = {};
							for (var i = 0; i < 100000; i++) {
								var p = [];
								for (var n = 0; n < 6; n++) {
									p.push(Math.round(Math.random() * 10000))
								}
								var u = [];
								var un = Math.round(Math.random() * 10) + 1;
								var startU = Math.round(Math.random() * 5000); 
								for (var n = 0; n < un; n++) {
									startU += Math.round(Math.random() * 5);
									u.push(startU);
								}
								var hash = hashOrder(a, b, c, p, u);
								var val = {
									positions: p,
									units: u
								};
								if (!hashResults[hash]) {
									hashResults[hash] = val; 
								} else {
									cur++;
//									console.log("conflict?");
//									console.log(val);
//									console.log(hashResults[hash]);
//									console.log("::::");
								}
							}
							
							if (cur < best) {
								bestA = a;
								bestB = b;
								bestC = c;
								best = cur;
								
								console.log(bestA);
								console.log(bestB);
								console.log(bestC);
								console.log(best);
								console.log(")))=");
							}
						}
					}
				}
				
				console.log(bestA);
				console.log(bestB);
				console.log(bestC);
				console.log(best);
			};
			*/
			
			var fillUnitInfo = function(unitsMap, unitIds, callback) {
				world.getUnitState(unitIds).then(function(states) {
					try {
						var ordersMap = {};
						
						for (var i = 0; i < states.length; i++) {
							var unitId = unitIds[i];
							var ud = unitsMap[unitId];
							states[i] = _.merge(states[i], ud);
							unitsMap[unitId] = states[i];
							states[i].health = states[i].health || 1;
							states[i].built_frac = states[i].built_frac || 1;
							states[i].lastUpdate = checkLastUpdateTime(states[i]);
							
//							if (useUberMaps && states[i].orders) {
//								for (var j = 0; j < states[i].orders.length; j++) {
//									var o = states[i].orders[j];
////									console.log(o);
//									var positions = o.target.position;
//									var m = 10000;
//									var ob = j === 0 ? states[i].pos : states[i].orders[j-1].target.position;
////									console.log(ob);
//									if (positions && ob) {
//										positions = [Math.round(ob[0] * m), Math.round(ob[1] * m), Math.round(ob[2] * m), Math.round(positions[0] * m), Math.round(positions[1] * m), Math.round(positions[2] * m)];
////										console.log(positions);
//										var hash = hashOrder(positions, o.units);
////										console.log(hash);
//										if (!ordersMap[hash]) {
////											console.log("hit");
//											o.sourcePosition = ob;
//											ordersMap[hash] = o;
//										} else {
////											console.log("miss");
//										}
////										console.log(ordersMap);
////										console.log(":::::");
//									} else {
//										console.log(o);
//									}
//								}
//							}
						}
						
//						console.log(states);
//						console.log("=>");
//						console.log(ordersMap);
						
						callback(_.sortBy(states, function(u) {return u.z}), unitsMap);
					} catch (e) {
						console.log(e.stack);
					}
				});
			};
			
			var waitFunc = function() {
				if (spawnedCalls === finishedCalls) {
					fillUnitInfo(unitsMap, unitIds, callback);
				} else {
					setTimeout(waitFunc, 10);
				}
			};
			waitFunc();
		};
	}
	
	var unitAPI = new UnitAPIAdapter();
	
	function MemoryDataReceiver(pollTime) {
		var self = this;
		var lastUpdate = 0;
		var currentUnits = {};
		var addedUnitsListeners = [];
		var updatedUnitsListeners = [];
		var removeUnitsListeners = [];
		
		var unitLastCommands = {};
		var commandGroups = {};
		var prematureCommandQueues = [];
		
		self.getCommandGroups = function() {
			return commandGroups;
		};
		
		var addCommand = function(cmd) {
//			console.log("ADD CMD");
//			console.log(cmd);
			cmd.units = {};
			cmd.origins = {};
			cmd.queue = {}
			commandGroups[cmd.id] = cmd;
		};
		
		var removeCommand = function(id) {
			var cmd = commandGroups[id];
			if (cmd) {
				_.forEach(cmd.queue, function(q) {
					q.origins[id] = undefined;
				});
//				console.log("RM CMD ");
//				console.log(id);
				delete commandGroups[id];
			}
		};
		
		var hasMoreElements = function(u) {
			for (var p in u) {
				if (u.hasOwnProperty(p) && u[p] != undefined) {
					return true;
				}
			}
			return false;
		};
		
		var mayCleanCommands = function(cmd) {
			if (cmd && commandGroups[cmd.id] && (Date.now() - cmd.creationTime > 10000) && !(hasMoreElements(cmd.units) || hasMoreElements(cmd.origins))) {
				_.forEach(cmd.queue, function(q) {
					q.origins[cmd.id] = undefined;
					mayCleanCommands(q);
				});
				if (cmd.unitSpec === undefined) {
					removeCommand(cmd.id);
				}
			}
		};
		
		var cleanCommands = function() {
			_.forEach(commandGroups, function(value, key) {
				mayCleanCommands(value);
			});
		};
		
		var removeUnitForCommandId = function(unitId, cmdId) {
			if (cmdId) {
				var c = commandGroups[cmdId]; 
				if (c) {
					c.units[unitId] = undefined;
				}
			}
		};
		
		var linkCommandsOfUnit = function(unit) {
			var cmdBefore = undefined;
			var hasUnknownCommands = false;
			_.forEach(unit.commandIds, function(cmd) {
				var c = commandGroups[cmd];
				if (c) {
					if (cmdBefore) {
						c.origins[cmdBefore.id] = cmdBefore;
						cmdBefore.queue[c.id] = c;
					} else {
						c.units[unit.id] = unit;
					}
					cmdBefore = c;
				} else {
					hasUnknownCommands = true;
				}
			});
			return hasUnknownCommands;
		};
		
		var clearOldCommandsForUnit = function(id) {
			if (unitLastCommands[id]) {
				for (var i = 0; i < unitLastCommands[id].length; i++) {
					removeUnitForCommandId(id, unitLastCommands[id][i]);
				}
			}
		};
		
		var checkCommandsOfUnit = function(unit) {
			clearOldCommandsForUnit(unit.id);
			return linkCommandsOfUnit(unit);
		};
		
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
					commandGroups = {};
					unitLastCommands = {};
					prematureCommandQueues = [];
				}
				
				_.forEach(data.addedCommands, function(cmd) {
					// used to only remove commands that are known for at least a few seconds.
					// required since commands sometimes arrive after the unit has been given the command
					cmd.creationTime = Date.now();
					addCommand(cmd);
					
					for (var i = 0; i < prematureCommandQueues.length; i++) {
						if (!linkCommandsOfUnit(prematureCommandQueues[i])) {
//							console.log("RM PREMATURE CMD QUEUES FOR UNIT " + prematureCommandQueues[i].id);
							prematureCommandQueues.splice(i, 1);
							i--;
						}
					}
				});
				
				_.forEach(data.updatedCommands, function(cmd) {
					var old = commandGroups[cmd.id];
					if (old) {
						old.x = cmd.x;
						old.y = cmd.y;
						old.z = cmd.z;
						old.planetId = cmd.planetId;
						old.type = cmd.type;
					}
				});
				
				_.forEach(data.removedCommands, function(id) {
					removeCommand(id);
				});
				
				_.forEach(data.addedUnits, function(unit) {
//					console.log("ADD");
//					console.log(unit);
					currentUnits[unit.id] = true;
					unitLastCommands[unit.id] = unit.commandIds;
					if (linkCommandsOfUnit(unit)) {
//						console.log("FOUND PREMATURE COMMAND QUEUE");
//						console.log(unit);
						prematureCommandQueues.push(unit);
					}
					notifyAdd(unit);
				});
				
				_.forEach(data.updatedUnits, function(unit) {
					if (unit.newCommandIds) {
						unit.commandIds = unit.newCommandIds;
//						console.log("update");
//						console.log(unit);
						if (checkCommandsOfUnit(unit)) {
//							console.log("FOUND PREMATURE COMMAND QUEUE");
//							console.log(unit);
							prematureCommandQueues.push(unit);
						}
						unitLastCommands[unit.id] = unit.commandIds;
					}
					notifyUpdate(unit);
				});
				
				var removeKeys = {};
				_.forEach(data.removedUnits, function(id) {
					clearOldCommandsForUnit();
					unitLastCommands[id] = undefined;
					currentUnits[id] = undefined;
					removeKeys[id] = true;
				});
				notifyRemove(removeKeys);
				
				cleanCommands();
				
				setTimeout(refreshData, Math.max(0, pollTime - (new Date().getTime() - startQuery)));
			}).fail(function() {
				console.log("Cannot find memory reader, slowing down polling");
				setTimeout(refreshData, noMemoryReaderPollTime);
			});
		}
		
//		setTimeout(refreshData, 1000);
	}
	
	memoryPA = new MemoryDataReceiver(unitPollTime);
	
	/*
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
		
		self.hpFactor = ko.computed(function() {
			return self.currentHp() / self.maxHp();
		});
		
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
	*/
	
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
		
		var makeUnitScale = function() {
			return Math.sqrt(Math.sqrt(self.widthSizeMod())) * Math.sqrt(Math.sqrt(self.planetSizeMod())) * 0.33; 
		};
		
		self.unitScaleComputed = ko.computed(makeUnitScale);	
		
		self.unitMapX = {};
		self.zSortedUnitsX = [];
		
		self.provideUnitData = function(array, map) {
			self.zSortedUnitsX = array;
			self.unitMapX = map;
			var scl = makeUnitScale();
			for (var i = 0; i < array.length; i++) {
				var aunit = array[i];
				if (aunit.pos && aunit.pos.length > 2) {
					var ll = convertToLonLan(aunit.pos[0], aunit.pos[1], aunit.pos[2]);
					var projected = self.projection()(ll);
					var x = projected[0];
					var y = projected[1];
					aunit.translate = [x, y];
					aunit.scale = scl;
					
					if (contains(unitSpecMapping[aunit.spec], "Commander")) {
						aunit.spec = "commander";
					}
				}
			};
		};

		/**
		self.unitMap = {};
		self.units = ko.observableArray([]);
		
		self.zSortedUnits = ko.computed(function() {
			return _.sortBy(self.units(), function(unit) {
				return unit.svgZ();
			});
		});
		
		var addUnitModel = function(unitm) {
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
		*/
		var now;
		var then = Date.now();
		var delta;
		
		var drawCameraPosition = function(ctx) {
			var cam = cameraLocation();
			if (cam && cam.planet == self.planet().id) {
				var ll = convertToLonLan(cam.x, cam.y, cam.z);
				var projected = self.projection()(ll);
				var x = projected[0];
				var y = projected[1];
				
				ctx.beginPath();
				ctx.arc(x, y, 20 * self.widthSizeMod(), 0, 2 * Math.PI, false);
				ctx.lineWidth = 1;
				ctx.strokeStyle = "#000000";
				ctx.stroke();
			}
		};
		
		// TODO use DBSCAN or similar to cluster units together instead of just using the middle of ALL units...
		var getLocationByUnits = function(units) {
			var x = 0;
			var y = 0;
			var z = 0;
			var planet = 0;
			var num = 0;
			_.forEach(units, function(value, key) {
				if (value) {
					value = self.unitMapX[value.id];
				}
				if (value) {
					value = value.unit;
				}
				if (value) {
					x += value.pos[0];
					y += value.pos[1];
					z += value.pos[2];
					planet = value.planet; // TODO this might look a little buggy in case a command is issued to a group of units that is spread over multiple planets...
					num++;
				}
			});
			if (planet == self.planet().id && num > 0) {
				x /= num;
				y /= num;
				z /= num;
				return [x, y, z];
			} else {
				return undefined;
			}
		};
		
		var makeProjected = function(x, y, z) {
			var ll = convertToLonLan(x, y, z);
			return self.projection()(ll);			
		};
		
		var drawCommandLine = function(ctx, x1, y1, z1, x2, y2, z2, clr) {
			dottedLine(x1, y1, z1, x2, y2, z2, 4, 75, function(x, y, z) {
				var p = makeProjected(x, y, z);
				drawDot(ctx, p[0], p[1], 1 * self.unitScaleComputed(), clr);
			});
			dottedLine(x1, y1, z1, x2, y2, z2, 100, 0.1, function(x, y, z) {
				var p = makeProjected(x, y, z);
				drawDot(ctx, p[0], p[1], 3 * self.unitScaleComputed(), clr);
			});
		};
		
		var drawCommands = function(ctx) {
			_.forEach(memoryPA.getCommandGroups(), function(cmdGrp) {
				if (cmdGrp.planetId === self.planet().id) {
					var clr;
					
					var isBuild = cmdGrp.unitSpec && strategicIconPaths[cmdGrp.unitSpec+"_fill"];
					
					if (isBuild) {
						clr = "rgb(255,255,255)"; // build stuff
					} else if (cmdGrp.type === 0 || cmdGrp.type === 1) { // Move || Drop(?)
						clr = "00FF26";
					} else if (cmdGrp.type === 4 || cmdGrp.type === 3) { // ATK
						clr = "FF0009";
					} else if (cmdGrp.type === 9) { // ALT Fire
						clr = "FF0009";
					} else if (cmdGrp.type === 7) { // Assist
						clr = "006FFF";
					} else if (cmdGrp.type === 6) { // Repair
						clr = "006FFF";
					} else if (cmdGrp.type === 5) { // Reclaim
						clr = "FF0009";
					} else if (cmdGrp.type === 2) { // Patrol
						clr = "00FF26";
					} else { // Whatever else I forgot
						clr = "#FFFFFF";
						console.log(cmdGrp);
					}
					
					var tP = makeProjected(cmdGrp.x, cmdGrp.y, cmdGrp.z);
					_.forEach(cmdGrp.origins, function(origin) {
						if (origin !== undefined && origin.planetId === self.planet().id) {
							drawCommandLine(ctx, origin.x, origin.y, origin.z, cmdGrp.x, cmdGrp.y, cmdGrp.z, clr);
						}
					});
					
					var locByUnits = getLocationByUnits(cmdGrp.units);
					if (locByUnits) {
						drawCommandLine(ctx, locByUnits[0], locByUnits[1], locByUnits[2], cmdGrp.x, cmdGrp.y, cmdGrp.z, clr);
					}
					
					if (isBuild) {
						var pp = makeProjected(cmdGrp.x, cmdGrp.y, cmdGrp.z);
						model.drawSpecGhost(ctx, cmdGrp.unitSpec, pp[0], pp[1], self.unitScaleComputed());
					}
				}
			});
		};
		
		var drawAlerts = function(ctx) {
			_.forEach(model.importantAlerts, function(value) {
				if (value.watch_type === 3 && value.planet_id === self.planet().id) {
					var pp = makeProjected(value.location.x, value.location.y, value.location.z);
					var toggle = Math.floor(Date.now() / 250) % 2 === 0;
					for (var i = 0; i < 5; i++) {
						drawCircle(ctx, pp[0], pp[1], (50-i*5) * self.unitScaleComputed(), toggle ? "rgba(255, 255, 0, 1)" : "rgba(255, 255, 0, 0.3)");
					}
					drawDot(ctx, pp[0], pp[1], 3 * self.unitScaleComputed(), toggle ? "rgba(255, 255, 0, 0.1)" : "rgba(255, 255, 0, 1)");
				}
			});
		};
		
		var drawLandingZones = function(ctx) {
			_.forEach(model.landingZones, function(zone, n) {
				if (zone.planet_index === self.planet().index) {
					for (var i = 1; i <= 10; i *= 2) {
						dottedCircle(zone.position[0], zone.position[1], zone.position[2], (zone.radius/10) * i, 20, 120000, function(x, y, z) {
							var pp = makeProjected(x, y, z);
							drawDot(ctx, pp[0], pp[1], self.isUberMap ? 3 : 1, "rgb(46, 173, 57)");
						});
					}
					var pz = makeProjected(zone.position[0], zone.position[1], zone.position[2]);
					drawText(ctx, pz[0], pz[1], (n+1)+"", "rgb(255,255,255)");
				}
			});
		};
		
		self.drawStuff = function() {
			now = Date.now();
			delta = now - then;
			
			var interval = 1000/fps;
			
			// various "try to use low fps for everything that doesnt look too bad"-things
			if (self.isUberMap && !self.visible()) {
				interval = 1000 / 2; // 2 fps for invisible ubermaps
			} else if (!self.isUberMap && (model.showsUberMap()
								|| model.activePlanet() !== self.planet().id)) {
				interval = 1000 / 3; // 3 fps for minimaps that are not focused or while the ubermap is open
			}
			
			if (delta > interval) {
				then = now - (delta % interval);
				
				if (self.context() && (!self.visible || self.visible())) {
					var ctx = self.context();
					ctx.clearRect(0, 0, self.width(), self.height());
					
					var selectedUnits = [];
					var unselectedUnits = [];
					var selection = model.selection();
					_.forEach(self.zSortedUnitsX, function(unit) {
						if (selection[unit.id]) {
							selectedUnits.push(unit);
						} else {
							unselectedUnits.push(unit);
						}
					});
					
					drawCommands(ctx);
					
					_.forEach(unselectedUnits, function(unit) {
						model.drawUnit(ctx, unit, self);
					});
					
					_.forEach(selectedUnits, function(unit) {
						model.drawUnit(ctx, unit, self);
					});
					
					if (!model.showsUberMap()) {
						drawCameraPosition(ctx);
					}
					
					drawAlerts(ctx);
					drawLandingZones(ctx);
				}
			}
			var dt = interval - delta;
			if (dt >= 4) {
				setTimeout(function() {
					requestAnimationFrame(self.drawStuff, self.canvas());
				}, dt);
			} else {
				requestAnimationFrame(self.drawStuff, self.canvas());
			}
		};

		self.drawStuff();
	};
	
	var appendMapDefaults = function(self, p) {
		self.planet = ko.observable(p);
		self.dead = ko.computed(function() {
			return self.planet().dead;
		});
		self.name = ko.computed(function() {
			return self.planet().name;
		});
		self.cloud = ko.observable();
		self.mappingObject = ko.computed(function() {
			var result = {
				id: "p-id-"+self.planet().id,
				name: self.name(),
				cloud: self.cloud()
			};
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
			// TODO this currently is fixed onto one projection. I am not yet sure if I want the option for more back.
			return d3.geo.winkel3().scale(38*(w/200)).translate([w/2, h/2]).precision(.1).rotate(self.rotation());
		});
		
		// calling rotate mutates the projection I think...
		self.unRotatedProjection = ko.computed(function() {
			var w = self.width();
			var h = self.height();
			// TODO this currently is fixed onto one projection. I am not yet sure if I want the option for more back.
			return d3.geo.winkel3().scale(38*(w/200)).translate([w/2, h/2]).precision(.1);
		});
		
		var getPixelColor = function(config, points, pixelPoint) {
			if (points.length === 0) {
				return [0, 0, 0];
			}
			var sumDist = 0;
			for (var i = 0; i < points.length; i++) {
				points[i].dist = vecDistSq(pixelPoint, points[i].normalPosition);
				sumDist += points[i].dist;
			}
			
			var pointRatings = [];
			var prs = 0;
			for (var i = 0; i < points.length; i++) {
				var v = 1 / (points[i].dist / sumDist);
				pointRatings.push(v);
				prs += v;
			}
			
			for (var i = 0; i < points.length; i++) {
				points[i].rating = pointRatings[i] / prs;
			}
			
			var cloud = self.cloud();
			
			var result = [0, 0, 0];
			
			for (var i = 0; i < points.length; i++) {
				var point = points[i];
				var heights = cloud.extremeHeights[point.type];
				var isSea = point.type === "sea";
				var minH = isSea ? cloud.extremeHeights.overallMin : heights.min;
				var maxH = isSea ? cloud.extremeHeights.overallMax : heights.max;
				var heightScale = (point.height-minH)/(maxH-minH);
				
				var clrA = config[point.type][0];
				var clrB = config[point.type][1];
				var dr = clrB[0]-clrA[0];
				var dg = clrB[1]-clrA[1];
				var db = clrB[2]-clrA[2];
				var hR = clrA[0] + dr * heightScale;
				var hG = clrA[1] + dg * heightScale;
				var hB = clrA[2] + db * heightScale;
				
				result[0] += hR * point.rating;
				result[1] += hG * point.rating;
				result[2] += hB * point.rating;
			}
			
			result[0] = Math.round(result[0]);
			result[1] = Math.round(result[1]);
			result[2] = Math.round(result[2]);
			
			return result;
		};
		
		self.mapCanvas = ko.observable(undefined);
		self.mapContext = ko.computed(function() {
			self.width();
			self.height();
			if (self.mapCanvas()) {
				return self.mapCanvas().getContext("2d");
			} else {
				return undefined;
			}
		});
		
		self.mapCanvas2 = ko.observable(undefined);
		self.mapContext2 = ko.computed(function() {
			self.width();
			self.height();
			if (self.mapCanvas2()) {
				return self.mapCanvas2().getContext("2d");
			} else {
				return undefined;
			}
		});
		
		var drawConfig = {
			"lava": {
				"land": [[141,96,87], [73,56, 48]],
				"sea": [[71,118,255], [71,215,255]],
				"blocked": [[223,105,33], [0,0,0]]
			},
			"metal": {
				"land": [[198,197,186], [49,63,78]],
				"sea": [[71,118,255], [71,215,255]],
				"blocked": [[10,10,10], [180,180,180]]
			},
			"gas": [109,160,147],
			"earth": {
				"land": [[255, 191, 0], [112,92,33]],
				"sea": [[71,118,255], [71,215,255]],
				"blocked": [[0,0,0], [120,120,120]]
			},
			"moon": {
				"land": [[163, 163, 153], [55,70,90]],
				"sea": [[71,118,255], [71,215,255]],
				"blocked": [[20,20,20], [170,170,170]]
			},
			"ice": {
				"land": [[133, 161, 221], [97,95,87]],
				"sea": [[71,118,255], [71,215,255]],
				"blocked": [[23,51,54], [21,23,40]]
			},
			"def": {
				"land": [[255, 191, 0], [112,92,33]],
				"sea": [[71,118,255], [71,215,255]],
				"blocked": [[0,0,0], [120,120,120]]
			}
		};
		
		var renderImage = function(cloud, w, h, projection, planet, ctx, quality, deferred) { // quality 1 is pixel perfect, 2 is 2x2 pixels, etc...
			var isGas = cloud === "gas";
			var biome = planet.biome;
			if (biome === "earth" && planet.temp < 0) {
				biome = "ice";
			}
			var qRange = isGas ? 1 : cloud.findQueryRange([planet.radius, 0, 0], 3, 50);
			var imgDat = ctx.createImageData(w, h);
			var uQ = Math.ceil(quality/2);
			var lQ = -Math.floor(quality/2);
			
			var renderPixel = function(x, y) {
				var points = undefined;
				var pos = undefined;
				var pixelColor = undefined;
				var conf = undefined;
				var ll = undefined;
				for (var xi = lQ; xi < uQ; xi++) {
						for (var yi = lQ; yi < uQ; yi++) {
						var mx = (x+xi);
						var my = (y+yi);
						if (self.checkPixelOnSphere(mx, my) && mx < imgDat.width && my < imgDat.height && mx >= 0 && my >= 0) {
							if (!isGas) {
								ll = ll || projection.invert([x, y]);
								pos = pos || convertToCartesian(ll[1], ll[0], planet.radius);
								points = points || cloud.queryPoints(pos, qRange);
								conf = conf || drawConfig[biome] || drawConfig["def"];
								pixelColor = pixelColor || getPixelColor(conf, points, pos);
							} else {
								pixelColor = drawConfig["gas"];
							}
							
							var index = (mx + my * imgDat.width) * 4;
							imgDat.data[index] = pixelColor[0];
							imgDat.data[index+1] = pixelColor[1];
							imgDat.data[index+2] = pixelColor[2];
							imgDat.data[index+3] = 255;
						}
					}
				}
			};
			
			if (deferred) {
				var deferRender = function(x, y) {
					if (x < w) {
						while (y < h) {
							renderPixel(x, y);
							y += quality;
						}
						setImmediate(function() {
							deferRender(x + quality, 0);
						});
					} else {
						ctx.putImageData(imgDat, 0, 0);
					}
				};
				deferRender(0, 0);
			} else {
				for (var x = 0; x < w; x+=quality) {
					for (var y = 0; y < h; y+=quality) {
						renderPixel(x, y);
					}
				}
				ctx.putImageData(imgDat, 0, 0);
			}
		};
		
		var renderMex = function(cloud, ctx, projection) {
			if (cloud.mex) {
				var size = self.dotSizes().metal;
				for (var i = 0; i < cloud.mex.length; i++) {
					var m = cloud.mex[i];
					var ll = convertToLonLan(m[0], m[1], m[2]); 
					var projected = projection(ll);
					drawDot(ctx, projected[0], projected[1], size, "rgb(0,222,0)");
				}
			}
		};
		
		self.projectionCutOffData = ko.computed(function() {
			var maxY = 0;
			var minY = 9999;
			var rows = [];
			var rowBaseData = {};
			var w = self.width();
			var h = self.height();
			var projection = self.unRotatedProjection();
			
			if (w < 0 || h < 0) {
				return undefined;
			}
			
			var addPoint = function(lo, la) {
				var projected = projection([lo, la]);
				var x = Math.round(projected[0]);
				var y = Math.round(projected[1]);
				if (minY > y) {
					minY = y;
				}
				if (maxY < y) {
					maxY = y;
				}
				if (rowBaseData[y] === undefined) {
					rowBaseData[y] = {minX: 9999999, maxX: 0};
				}
				var rowMinX = rowBaseData[y].minX;
				var rowMaxX = rowBaseData[y].maxX;
				if (rowMinX > x) {
					rowBaseData[y].minX = x;
				}
				if (rowMaxX < x) {
					rowBaseData[y].maxX = x;
				}
			};
			
			for (var long = -180; long <= 180; long += 0.01) {
				addPoint(long, -90);
				addPoint(long, 90);
			}
			
			for (var lat = -90; lat <= 90; lat += 0.01) {
				addPoint(-180, lat);
				addPoint(180, lat);
			}
			
			for (var i = minY; i <= maxY; i++) {
				for (var offset = 1; offset < 1000; offset++) {
					var key = Math.floor(offset / 2);
					if (offset % 2 === 0) {
						key = -key;
					}
					var base = rowBaseData[i+key];
					if (base) {
						rows[i] = base; 
						break;
					}
				}
			}
			var result = {
				maxY : maxY,
				minY: minY,
				rows: rows
			}; 
			return result;
		});
		self.projectionCutOffData.extend({rateLimit:  { method: "notifyWhenChangesStop", timeout: 1000 } });
		
		self.checkPixelOnSphere = function(x, y) {
			var cutOff = self.projectionCutOffData();
			return cutOff !== undefined && cutOff.maxY >= y && cutOff.minY <= y 
			&& (cutOff.rows[y] === undefined 
					|| (cutOff.rows[y].minX < x && cutOff.rows[y].maxX > x));
		};
		
		var imgComputeCheck = 0;
		self.imageCompute = ko.computed(function() {
			imgComputeCheck++;
			var test = imgComputeCheck;
			var cloud = self.cloud();
			var w = self.width();
			var h = self.height();
			var projection = self.projection();
			var planet = self.planet();
			var ctx = self.mapContext();
			var ctx2 = self.mapContext2();
			if (cloud) {
				renderImage(cloud, w, h, projection, planet, ctx, self.isUberMap ? 15 : 4, false);
				// I wanted to just render them on top of the terrain context, but that had very weird effects...
				ctx2.clearRect(0, 0, w, h);
				renderMex(cloud, ctx2, projection);
				setTimeout(function() {
					if (test === imgComputeCheck) {
						renderImage(cloud, w, h, projection, planet, ctx, self.isUberMap ? 3 : 1, true);
					}
				}, 2000 + (Math.round(Math.random() * 2000)));
			}
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
		
		self.lookAtByMapXY = function(x, y, zoom) {
			if (self.checkPixelOnSphere(x, y)) {
				var ll = self.projection().invert([x, y]);
				if (ll) {
					var c = convertToCartesian(ll[1], ll[0]);
					zoom = zoom === undefined ? "orbital" : zoom;
					api.Panel.message(api.Panel.parentId, "setMainCamera", 
							{planet_id: self.planet().id, location: {x: c[0], y: c[1], z: c[2]}, zoom: zoom});
				}
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
			if (self.checkPixelOnSphere(e.offsetX, e.offsetY)) {
				self.showPreviewByMapXY(e.offsetX, e.offsetY);
				var top = self.top ? self.top() : 0;
				var left = self.left ? self.left() : 0;
				model.cursorPosition({x: e.offsetX-24 + left, y: e.offsetY-24+top});
				model.cursorVisible(true);
			} else {
				hidePreview();
			}
		};
		
		var hidePreview = function() {
			api.Panel.message(api.Panel.parentId, 'preview.hide');
			model.cursorVisible(false);
		};
		
		self.showPreviewByMapXY = function(x, y) {
			var ll = self.projection().invert([x, y]);
			if (ll) {
				var c = convertToCartesian(ll[1], ll[0]);
				api.Panel.message(api.Panel.parentId, 'preview.show', {
					target: {
						location: {
							x: c[0],
							y: c[1],
							z: c[2]
						}, 
						planet_id: self.planet().id,
						zoom: 'orbital'
					},
					placement: {
						panelName: "ubermap_panel",
						offset: [$(document).width() - 316, 35],
						alignDeck: [0, 0]
					}
				});
			};
		};
		
		self.defMouseleave = function(data, e) {
			hidePreview();
		};
		
		var runUnitCommandByMapXY = function(cmd, x, y, queue) {
			if (self.checkPixelOnSphere(x, y)) {
				var ll = self.projection().invert([x, y]);
				if (ll) {
					var c = convertToCartesian(ll[1], ll[0]);
					var units = _.map(Object.keys(model.selection()), function(o) {return Number(o);});
					var payload = {
						method: cmd,
						units: units,
						arguments: [c[0], c[1], c[2], self.planet().id, !!queue, model.ctrlState()],
					};
					api.Panel.message(api.Panel.parentId, 'runUnitCommand', payload);
				}
			}
		};
		
		var moveToByMiniMapXY = function(x, y, queue) {
			runUnitCommandByMapXY("moveSelected", x, y, queue);
		};
		
		self.rightClick = function(data, e) {
			if (model.commandMode() === "default") {
				moveToByMiniMapXY(e.offsetX, e.offsetY, e.shiftKey);
			} else {
				api.Panel.message(api.Panel.parentId, 'quitCommandMode');
			}
		};
		
		self.click = function(data, e) {
			// default commandMode handled by the rubberband selection mechanism
			if (model.commandMode() === "command_move") {
				moveToByMiniMapXY(e.offsetX, e.offsetY, model.shiftState());
			} else if (model.commandMode() === "command_patrol") {
				runUnitCommandByMapXY("patrolSelected", e.offsetX, e.offsetY, model.shiftState());
			} else if (model.commandMode() === "command_attack") {
				runUnitCommandByMapXY("attackSelected", e.offsetX, e.offsetY, model.shiftState());
			} else if (model.commandMode() === "command_ping") {
				runUnitCommandByMapXY("ping", e.offsetX, e.offsetY, model.shiftState());
			}
			
			if (model.commandMode() !== "default" && !model.shiftState()) {
				api.Panel.message(api.Panel.parentId, 'quitCommandMode');
			}
		};
		
		self.mouseenter = function() {
			model.mouseHoverMap = self;
		};
		
		self.switchCameraToPosition = function(x, y) {
			model.activePlanet(self.planet().id);
			self.lookAtByMapXY(x, y, "orbital"); // pass in "invalid" to keep current zoom level.... hmmm
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
		
		self.findControllableUnitsBySpec = function(spec) {
			var units = [];
			
			_.forEach(self.zSortedUnitsX, function(unit) {
				if (unit.army === model.armyId() && unit.spec === spec) {
					units.push(unit.id);
				}
			});
			
			return units;
		};
		
		self.findControllableUnitsInside = function(x, y, w, h) {
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
				
				var zUnits = self.zSortedUnitsX;
				for (var u = zUnits.length - 1; u >= 0; u--) {
					var unit = zUnits[u];

					if (unit.army !== model.armyId()) {
						continue;
					}
					
					var translate = unit.translate;
					// this is the center of the unit-icon
					var ux = translate[0];
					var uy = translate[1];
					
					// hitting the middle pixel of an icon is a quick way out of these tests
					// dont do it for direct clicks
					if (!directclick && ux >= x && ux <= x + w && uy >= y && uy <= y + h) {
						if (isPrio(unit.spec)) {
							foundPrioUnits = true;
							unitsFound[unit.id] = true;
							unitsFound.found = true;
						} else {
							nonPrioUnits[unit.id] = true;
							nonPrioUnits.found = true;
						}
					} else {
						var intersection = findIntersection(ux, uw, uy, uh, xm, hw, ym, hh);
						if (intersection) {
							intersection[0] = hackRound((intersection[0] - ux + uw) / scale);
							intersection[1] = hackRound((intersection[1] - ux + uw) / scale);
							intersection[2] = hackRound((intersection[2] - uy + uh) / scale);
							intersection[3] = hackRound((intersection[3] - uy + uh) / scale);
							if (checkSpecPixelHit(unit.spec, intersection)) {
								if (isPrio(unit.spec)) {
									foundPrioUnits = true;
									unitsFound[unit.id] = true;
									unitsFound.found = true;
								} else {
									nonPrioUnits[unit.id] = true;
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
		
		self.isUberMap = false;
		
		self.width = model.minimapWidth;
		self.height = model.minimapHeight;
		
		// rotation is only possible in the x-axis, so north always points up
		self.rotationX = ko.observable(50).extend({ local: 'minimap-rotation-' + p.name + "_" + p.id });
		self.rotation = ko.computed(function() {
			return [self.rotationX(), 0];
		});
		
		appendMapDefaults(self, p);
		
		appendIconsHandling(self);
		
		appendInputDefaults(self);
		self.mousemove = self.defMousemove;
		self.mouseleave = self.defMouseleave;
		
		self.clickMinimap = function(data, e) {
			if (model.commandMode() === "default") {
				model.activePlanet(self.planet().id);
				self.lookAtByMapXY(e.offsetX, e.offsetY);
			} else {
				self.click(data, e);
			}
		};
		
		console.log("created minimap: "+p.name);
	}
	
	function UberMapModel(p, partnerMiniMap) {
		var self = this;
		
		self.isUberMap = true;
		
		self.visible = ko.computed(function() {
			return model.showsUberMap() && model.activePlanet() === self.planet().id;
		});
		
		// the elements are hidden offscreen using  the margin-top value
		// that turns out to be faster (well maybe that part is my imagination...) in some situations
		self.hideByMargin = ko.computed(function() {
			return self.visible() ? "0px" : "-1000000px";
		});
		  
		self.width = model.uberMapWidth;
		self.height = model.uberMapHeight;
		
		self.top = ko.computed(function() {
			return model.ubermapTop();
		});
		self.left = model.ubermapLeft;
		
		self.rotationX = partnerMiniMap.rotationX;
		self.rotation = partnerMiniMap.rotation;

		appendMapDefaults(self, p);
		
		appendIconsHandling(self);
		
		appendInputDefaults(self);
		self.mousemove = self.defMousemove;
		self.mouseleave = self.defMouseleave;
		
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
			if (self.alivePlanetsCount() <= self.maxPlanetsForBig()) {
				return self.minimapWidthBig();
			} else if (self.alivePlanetsCount() <= self.maxPlanetsForMedium()) {
				return self.minimapWidthMedium();
			} else {
				return self.minimapWidthSmall();
			}
		});
		
		self.minimapHeight = ko.computed(function() {
			if (self.alivePlanetsCount() <= self.maxPlanetsForBig()) {
				return self.minimapHeightBig();
			} else if (self.alivePlanetsCount() <= self.maxPlanetsForMedium()) {
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
		
		// it turns out that resizing it only on demand when the ubermap is shown delays the moment until the ubermap shows up, so
		// better accept that the page always has the full size for faster ubermap switch on/off
		self.bodyWidth = ko.computed(function() {
//			return self.showsUberMap() ? self.parentWidth() : self.minimapAreaWidth(); // + self.minimapUbermapGap() + self.uberMapWidth();
			return self.parentWidth();
		});
		
		self.bodyHeight = ko.computed(function() {
//			return self.showsUberMap() ? self.parentHeight() : self.ubermapTop() + self.uberMapHeight();
			return self.parentHeight();
		});
	};
	
	function SceneModel() {
		var self = this;
		
		self.commandMode = ko.observable("default");
		
		self.cursorImg = ko.computed(function() {
			var cm = self.commandMode();
			if (cm === "default") {
				return "coui://ui/main/shared/img/icons/icons_command_move.png";
			} else {
				return "coui://ui/main/shared/img/icons/icons_"+cm+".png";
			}
		});
		
		self.cursorVisible = ko.observable(false);
		self.cursorPosition = ko.observable({x: 500, y: 500});
		self.mouseHoverMap = undefined;

		var hiddenCanvas = document.createElement("canvas");
		hiddenCanvas.width = assumedIconSize;
		hiddenCanvas.height = assumedIconSize;
		var hiddenCtx = hiddenCanvas.getContext('2d');
		hiddenCtx.fillStyle = "black";

		var parseColor = function(clr) {
			if (clr == '' || clr == undefined) {
				return [0,0,0];
			} else if (clr.indexOf("rgba") !== -1) {
				var m = clr.match(/^rgba\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
				return [m[1]/255,m[2]/255,m[3]/255,m[4]/255];
			} else {
				var m = clr.match(/^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
				return [m[1]/255,m[2]/255,m[3]/255, 1];
			}
		};
		var getIconForSpec = function(spec) {
			return "coui://ui/main/atlas/icon_atlas/img/strategic_icons/icon_si_" + nameForSpec(spec) +".png";
		};
		var start = /[^\/]*$/;
		var end = /[.]json$/;
		var nameForSpec = function(spec) {
			if (spec === "commander") {
				return spec;
			} else {
				return spec.substring(spec.search(start), spec.search(end));
			}
		};
		
		self.unitSpecPathsMap = {};
		self.checkSpecExists = function(spec, img) {
			if (self.unitSpecPathsMap[spec] === undefined) {
				hiddenCtx.clearRect(-assumedIconSize, -assumedIconSize, assumedIconSize*2, assumedIconSize*2);
				hiddenCtx.drawImage(img, 0, 0, assumedIconSize, assumedIconSize);
				
				var imgData = hiddenCtx.getImageData(0, 0, assumedIconSize, assumedIconSize);
				var bitMask = [];
				for (var i = 0; i < imgData.data.length; i+=4) {
					bitMask.push(imgData.data[i+3] !== 0 && !(imgData.data[i+2] === imgData.data[i+1] && imgData.data[i+1] === imgData.data[i]));
				}
				
				self.unitSpecPathsMap[spec+"_bits"] = bitMask;
				self.unitSpecPathsMap[spec] = true;
			}
		};
		
		var shadeCanvas = function(ctx, x, y, width, height, fragmentShader) {
			var pixels = ctx.getImageData(x, y, width, height);
			var pdata = pixels.data;
			for (var px = 0; px < pixels.width; px++) {
				for (var py = 0; py < pixels.height; py++) {
					fragmentShader(pdata, (px + py * pixels.width) * 4);
				}
			}
			ctx.putImageData(pixels, 0, 0, x, y, width, height);
		};
		
		// icons are cached as an image in a fixed resolution that is copied onto the visible canvas
		// for performance gains
		self.unitSpecsImageCache = {};
		
		self.getUnitSpecImage = function(spec, armyColor, selected) {
			var key = spec + armyColor + selected;
			var obj = self.unitSpecsImageCache[key];
			if (obj === undefined) {
				obj = document.createElement("canvas");
				obj.width = assumedIconSize;
				obj.height = assumedIconSize;
				var ctx = obj.getContext("2d");
				
				var img = new Image();
				img.onload = function() {
					ctx.drawImage(img, 0, 0, assumedIconSize, assumedIconSize);
					self.checkSpecExists(spec, img);
					
					var pC = parseColor(armyColor);
					
					shadeCanvas(ctx, 0, 0, assumedIconSize, assumedIconSize, function(pix, index) {
						// aims to provide behavior similar to particle_icon.fs shader
						var r = pix[index];
						var g = pix[index+1];
						var b = pix[index+2];
						var a = pix[index+3];
						r /= 255;
						g /= 255;
						b /= 255;
						a /= 255;
						
						if (r !== g || g !== b) {
							var weight = Math.pow(g, 1/2.2) / (a + 0.00001);
							var sC = selected ? 1 : 0;
							r = (sC * (1 - weight) + pC[0] * weight);
							g = (sC * (1 - weight) + pC[1] * weight);
							b = (sC * (1 - weight) + pC[2] * weight);
						}
						a = a * pC[3];
						
						r = Math.round(r * 255);
						g = Math.round(g * 255);
						b = Math.round(b * 255);
						a = Math.round(a * 255);
						pix[index] = r;
						pix[index+1] = g;
						pix[index+2] = b;
						pix[index+3] = a;
					});
				};
				img.src = getIconForSpec(spec);
				
				self.unitSpecsImageCache[key] = obj;
			}
			
			return obj;
		};
	
		self.testHitPixelOfSpec = function(spec, x, y) {
			return x >= 0 && x < assumedIconSize && y >= 0 && y < assumedIconSize && self.unitSpecPathsMap[spec+"_bits"] && self.unitSpecPathsMap[spec+"_bits"][y * assumedIconSize + x];
		};
		
		self.minimaps = ko.observableArray([]);
		self.ubermaps = ko.observableArray([]);
		
		self.showsAnyUberMap = ko.computed(function() {
			for (var i = 0; i < self.ubermaps().length; i++) {
				if (self.ubermaps()[i].visible()) {
					return true;
				}
			}
			return false;
		});
		
		self.showsAnyUberMap.subscribe(function(v) {
			if (!v) {
				handlers.setUberMapVisible(false);
			}
		});
		
		self.minimapsByPlanetIndex = {};
		self.ubermapsByPlanetIndex = {};
		
		self.selection = ko.observable({});
		self.hasSelection = ko.computed(function() {
			return Object.keys(self.selection()).length > 0;
		});
		
		self.drawSpecGhost = function(ctx, spec, x, y, scale) {
			var ghostImg = self.getUnitSpecImage(spec, true, "rgba(255,255,255,125)", undefined);
			if (ghostImg) {
				var size = assumedIconSize * scale;
				x = hackRound(x + (-size/2));
				y = hackRound(y + (-size/2));
				size = hackRound(size);
				ctx.drawImage(ghostImg, x, y, size, size);
			}
		};
		
		self.drawUnit = function(ctx, unit, map) {
			if (!unit.translate || !unit.scale) {
				return;
			}
			
			var armyIndex = model.armyIdIndexMap()[unit.army];
			var hasVision = model.isArmyVisible(armyIndex);
			var defeated = model.armyIndexDefeated()[armyIndex];
			
			if ((model.isSpectator() && !hasVision) || (!model.isSpectator() && defeated)) {
				return;
			}
			
			var fClr = model.armyColors()[unit.army];
			
			if (unit.lastUpdate && !hasVision) {
				
				var timePassed = Date.now() - unit.lastUpdate;
				
				if (timePassed > 60000 && unit.spec !== "commander") {
					return;
				}
				
				var stepSize = 15;
				var scale = 255-Math.max(Math.min(Math.round((((timePassed)/5000) * 255) / stepSize) * stepSize, 160), 0);
				var fClrAr = parseColor(fClr);
				for (var i = 0; i < 3; i++) {
					fClrAr[i] = Math.round(fClrAr[i] * 255);
				}
				fClrAr[3] = scale;
				fClr = "rgba("+fClrAr[0]+","+fClrAr[1]+","+fClrAr[2]+","+fClrAr[3]+")";
			}
			
			var fillImg = self.getUnitSpecImage(unit.spec, fClr, self.selection()[unit.id]);
			
			var t = unit.translate;
			var s = unit.scale;
			var size = assumedIconSize * s;

			// integer numbers are faster for the canvas
			var x = hackRound(t[0] + (-size/2));
			var y = hackRound(t[1] + (-size/2));
			size = hackRound(size);

			if (x === 0 && y === 0 && isOrbital(unit.spec)) { // do not draw orbital units while they are being build, their position is buggy while that happens and is always 0/0
				return;
			}
			ctx.drawImage(fillImg, x, y, size, size);
			
			if (map.isUberMap && unit.health < 0.99) {
				var clrP = Math.ceil(255 * unit.health);
				var hpColor;
				if (unit.health > 0.7) {
					hpColor = "rgb(0,255,0)";
				} else if (unit.health > 0.3) {
					hpColor = "rgb(255,255,0)";
				} else {
					hpColor = "rgb(255,0,0)";
				}
				var hpLength = size * unit.health;
				drawLine(ctx, x, t[1] + size / 3, x + hpLength, t[1] + size / 3, hpColor);
			}
		};
		
		var updateUnitsForPlanet = function(index, i) {
			setTimeout(function() {
				unitAPI.queryAllInfo(function(array, map) {
					setImmediate(function() {
						if (self.minimapsByPlanetIndex[index]) {
							self.minimapsByPlanetIndex[index].provideUnitData(array, map);
						}
					});
					if (useUberMaps) {
						setTimeout(function() {
							if (self.ubermapsByPlanetIndex[index]) {
								self.ubermapsByPlanetIndex[index].provideUnitData(JSON.parse(JSON.stringify(array)), JSON.parse(JSON.stringify(map)));
							}
						}, 25);
					}
				}, index);
			}, i * 25);
		};
		
		self.updateUnitsEnabled = ko.observable(true);
		
		var updateUnitData = function() {
			var ps = self.planets();
			for (var i = 0; i < ps.length; i++) {
				var index = ps[i].index;
				if (self.updateUnitsEnabled()) {
					updateUnitsForPlanet(index);
				} else {
					if (self.minimapsByPlanetIndex[index]) {
						self.minimapsByPlanetIndex[index].provideUnitData([], {});
					}
					if (useUberMaps && self.ubermapsByPlanetIndex[index]) {
						self.ubermapsByPlanetIndex[index].provideUnitData([], {});
					}
					unitAPI.clearLastStateRegister();
				}
			}
			setTimeout(updateUnitData, unitPollTime);
		};
		
		setTimeout(updateUnitData, 3500);
		
		self.armyColors = ko.observable({});
		
		self.armyId = ko.observable(undefined);
		self.armyIndex = ko.observable(undefined);
		self.armyIndexIdMap = ko.observable(undefined);
		self.armyIndexDefeated = ko.observable({});
		self.armyIdIndexMap = ko.computed(function() {
			var map = {};
			_.forEach(self.armyIndexIdMap(), function(val, key) {
				map[val] = key;
			});
			return map;
		});
		
		self.playerVision = ko.observable(undefined);
		
		self.isSpectator = ko.observable(false);
		
		self.isArmyVisible = function(index) {
			var flags = self.playerVision();
			if (flags) {
				return flags[index];
			} else {
				return self.armyIndex() === index;
			}
		};
		
		self.mappingData = ko.observable([]);
		
		self.showsUberMap = ko.observable(false);
		self.activePlanet = ko.observable(0);
		
		self.showsUberMap.subscribe(function(v) {
			if (v) {
				if (!self.showsAnyUberMap()) {
					handlers.setUberMapVisible(false);
				}
			}
		});
		
		self.findActiveUberMap = function() {
			for (var i = 0; i < self.ubermaps().length; i++) {
				if (self.ubermaps()[i].visible()) {
					return self.ubermaps()[i];
				}
			}
			return undefined;
		};
		
		self.showsUberMap.subscribe(function(v) {
			api.Panel.message(api.Panel.parentId, 'setUberMapState', v);
		});
		
		self.planets = ko.observable([]);
		self.alivePlanetsCount = ko.computed(function() {
			var n = 0;
			
			for (var i = 0; i < self.planets().length; i++) {
				if (!self.planets()[i].dead) {
					n++;
				}
			}
			
			return n;
		});
		
		appendLayoutFields(self);
		
		self.updateMaps = function() {
			for (var i = 0; i < self.planets().length; i++) {
				var planet = self.planets()[i];
				if (self.minimapsByPlanetIndex[planet.index] === undefined) {
					var mm = new MiniMapModel(planet, self);
					self.minimaps.push(mm);
					self.minimapsByPlanetIndex[planet.index] = mm;
					
					if (useUberMaps) {
						var um = new UberMapModel(planet, mm);
						self.ubermaps.push(um);
						self.ubermapsByPlanetIndex[planet.index] = um;
					}
				} else {
					self.minimapsByPlanetIndex[planet.index].planet(planet);
					
					if (useUberMaps) {
						self.ubermapsByPlanetIndex[planet.index].planet(planet);
					}
				}
			}
			self.collectClouds();
		};
		self.planets.subscribe(self.updateMaps);
		
		var cQueue = [];
		var collectingPoints = false;
		var processCollectionQueue = function() {
			if (cQueue.length > 0 && !collectingPoints) {
				self.collectPointCloud(cQueue.shift());
			}
		};
		
		self.queuePointCollection = function(planet) {
			cQueue.push(planet);
			processCollectionQueue();
		};
		
		self.collectPointCloud = function(planet) {
			collectingPoints = true;
			var reportCloud = function(cloud) {
				for (var i = 0; i < self.minimaps().length; i++) {
					if (self.minimaps()[i].name() === planet.name) {
						self.minimaps()[i].cloud(cloud);
					}
					if (useUberMaps && self.ubermaps()[i].name() === planet.name) {
						self.ubermaps()[i].cloud(cloud);
					}
				}

				collectingPoints = false;
				processCollectionQueue();
			};
			
			if (planet.biome === "gas") {
				reportCloud("gas");
				return;
			}
			
			var testLocs = getTestLocsForRadius(planet.radius); 
			
			var world = api.getWorldView(0);
			
			var buildTestLocs = [];
			for (var i = 0; i < testLocs.length; i++) {
				var o = {
					normalPosition: testLocs[i],
					pos: testLocs[i],
					hadHit: false
				};
				buildTestLocs.push(o);
			}
			
			var checkPlacement = function(spec, testLocs, callback) {
				world.fixupBuildLocations(spec, planet.index, testLocs).then(function(result) {
					try {
						var hit = [];
						var noHit = [];
						var radius = planet.radius;
						for (var i = 0; i < result.length; i++) {
							
							// hack to sort of fix wrong water hits
							var isHigher = !testLocs[i].hadHit;
							if (testLocs[i].hadHit) {
								var hBefore = vecLengthSq(testLocs[i].pos);
								var hAfter = vecLengthSq(result[i].pos);
								isHigher = hAfter - hBefore > 0.125;
							}
							
							if (isHigher) {
								testLocs[i].hadHit = true;
								testLocs[i].pos = result[i].pos;
								testLocs[i].height = vecLength(result[i].pos);
							}
							
							if (result[i].ok && isHigher) {
								hit.push(testLocs[i]);
							} else {
								noHit.push(testLocs[i]);
							}
						}
						callback(hit, noHit);
					} catch (e) {
						console.log(e.stack);
					}
				});
			};
			
			var findMex = function(cb) {
				var testLocs = getTestLocsForRadius(planet.radius);
				var tts = [];
				for (var i = 0; i < testLocs.length; i++) {
					tts.push({pos: testLocs[i], hadHit: false});
				}
				checkPlacement("/pa/units/land/metal_extractor/metal_extractor.json", tts, function(hit) {
					var set = {};
					var results = [];
					for (var i = 0; i < hit.length; i++) {
						var x = Math.round(hit[i].pos[0]);
						var y = Math.round(hit[i].pos[1]);
						var z = Math.round(hit[i].pos[2]);
						var key = calcKey(x, y, z);
						if (!set[key]) {
							set[key] = true;
							results.push(hit[i].pos);
						}
					}
					cb(results);
				});
			};
			
			var groupByPlacements = function(specs, testLocs, callback, groupResults) {
				var gr = groupResults || [];
				if (specs.length > 0) {
					checkPlacement(specs.shift(), testLocs, function(hit, nohit) {
						gr.push(hit);
						groupByPlacements(specs, nohit, callback, gr);
					});
				} else {
					gr.push(testLocs);
					callback(gr);
				}
			};
			groupByPlacements(["/pa/units/land/landtest/land_barrier.json",
			                   "/pa/units/land/seatest/land_barrier.json"
			                   ], buildTestLocs, function(grouped) {
				var land = grouped[0];
				var sea = grouped[1];
				var blocked = grouped[2];
				
				findMex(function(d) {
					var cloud = new SpatialCloud(42);
					
					cloud.mex = d;
					
					_.forEach(land, function(l) {
						l.type = "land";
						cloud.addToCloud(l);
					});
					_.forEach(sea, function(s) {
						s.type = "sea";
						cloud.addToCloud(s);
					});
					_.forEach(blocked, function(b) {
						b.type = "blocked";
						cloud.addToCloud(b);
					});
					
					reportCloud(cloud);
				});
			});
		};
		
		self.collectClouds = function() {
			for (var i = 0; i < self.minimaps().length; i++) {
				var planet = self.minimaps()[i].planet();
				if (!planet.dead && self.minimaps()[i].cloud() === undefined) {
					self.queuePointCollection(planet);
				}
			}
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
		self.selectsAllFighters = groupedBooleansComputed(
				self.selectsNavyFighters, 
				self.selectsLandFighters, 
				self.selectsAirFighters, 
				self.selectsOrbitalFighters,
				invertedBoolean(self.selectsNavyWorkers),
				invertedBoolean(self.selectsLandWorkers),
				invertedBoolean(self.selectsAirWorkers),
				invertedBoolean(self.selectsOrbitalWorkers));
		
		self.selectsAllWorkers = groupedBooleansComputed(
					self.selectsNavyWorkers,
					self.selectsLandWorkers,
					self.selectsAirWorkers,
					self.selectsOrbitalWorkers,
					invertedBoolean(self.selectsNavyFighters),
					invertedBoolean(self.selectsLandFighters),
					invertedBoolean(self.selectsAirFighters),
					invertedBoolean(self.selectsOrbitalFighters));
		
		self.selectsAll = groupedBooleansComputed(
				self.selectsNavyFighters, 
				self.selectsLandFighters, 
				self.selectsAirFighters, 
				self.selectsOrbitalFighters,
				self.selectsNavyWorkers,
				self.selectsLandWorkers,
				self.selectsAirWorkers,
				self.selectsOrbitalWorkers);
		
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
		
		self.enableRubberband = ko.computed(function() {
			return self.showsUberMap() && self.commandMode() === "default";
		});
		
		self.enableRubberband.subscribe(function(v) {
			self.rubberbandSelector.setEnabled(v);
		});
		self.rubberbandSelector.setEnabled(self.enableRubberband());
		
		var lastSelectTime = 0;
		
		self.rubberbandSelector.addListener(function(x, y, w, h) {
			if (self.commandMode() !== "default") {
				return;
			}
			
			var targets = {};
			
			var hitMap = undefined;
			
			// find the units clicked
			var um = self.findActiveUberMap();
			if (um) {
				var r = um.findControllableUnitsInside(x, y, w, h);
				if (r.found) {
					hitMap = um;
					_.merge(targets, r);
				}
			}
			
			/*
			_.forEach(self.minimaps(), function(m) {
				var r = m.findControllableUnitsInside(x, y, w, h);
				if (r.found) {
					hitMap = m;
					_.merge(targets, r);
				}
			});
			*/
			
			// check for double click selects and modify selection accordingly
			var ar = [];
			_.forEach(targets, function(v, k) {
				if (k !== "found") {
					ar.push(Number(k));
				}
			});

			if (ar.length === 1 && w * h < 4) {
				var isDoubleSelect = (new Date().getTime() - lastSelectTime) < 350;
				lastSelectTime = new Date().getTime();
				if (isDoubleSelect && hitMap) {
					ar = hitMap.findControllableUnitsBySpec(hitMap.unitMapX[ar[0]].spec);
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
		
		var alertsIdSrc = 1337;
		self.importantAlerts = {};
		
		self.handleAlert = function(alert) {
			if (alert.watch_type === 3) {
				var key = alertsIdSrc++;
				self.importantAlerts[key] = alert;
				setTimeout(function() {
					delete self.importantAlerts[key];
				}, 7500);
			}
		};
		
		self.landingZones = [];
		
		self.handleAlerts = function(payload) {
			for (var i = 0; i < payload.list.length; i++) {
				self.handleAlert(payload.list[i]);
			}
		};
		
		alertsManager.addListener(self.handleAlerts);
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
	
	handlers.setArmyInfo = function(args) {
		console.log("got army info");
		console.log(args);
		model.armyColors(args[0]);
		model.armyId(args[1]);
		model.armyIndex(args[2]);
		model.armyIndexIdMap(args[3]);
		model.playerVision(args[4]);
		model.isSpectator(args[5]);
		model.armyIndexDefeated(args[6]);
	};
	
	handlers.setUberMapVisible = function(show) {
		if (useUberMaps) {
			if (show && cameraLocation() !== undefined) {
				model.activePlanet(cameraLocation().planet);
			}
			model.showsUberMap(show);
		} else {
			model.showsUberMap(false);
		}
	};
	
	handlers.zoomIntoUberMap = function(args) {
		if (useUberMaps) {
			var aum = model.mouseHoverMap;
			if (aum) {
				var pageX = args[0];
				var pageY = args[1];
				var offset = $(aum.canvas()).offset();
				var x = pageX - offset.left;
				var y = pageY - offset.top;
				
				if(aum.checkPixelOnSphere(x, y)) {
					model.showsUberMap(false);
					aum.switchCameraToPosition(x, y);
				}
			}
		}
	};
	
	handlers.shiftState = function(state) {
		model.shiftState(state);
	};
	
	handlers.ctrlState = function(state) {
		model.ctrlState(state);
	};
	
	handlers.commandMode = function(mode) {
		model.commandMode(mode);
	};
	
	handlers.toggleByName = function(name) {
		model[name](!model[name]());
	};
	
	handlers.camLoc = function(loc) {
		cameraLocation(loc);
		model.activePlanet(cameraLocation().planet);
	};
	
	handlers.client_state = function(state) {
		model.landingZones = state.zones || [];
	};

	app.registerWithCoherent(model, handlers);
	ko.applyBindings(model);
	
	setTimeout(function() {
		api.Panel.message(api.Panel.parentId, 'queryViewportSize');
		api.Panel.message(api.Panel.parentId, 'queryArmyInfo');
		api.Panel.message(api.Panel.parentId, 'setUberMapState', model.showsUberMap());
	}, 500);
});