console.log("loaded geomapper");

(function() {

	var mapName = "unknown";
	var planets = [];
	var spawns = [];
	
	var planetNameIndexMap = {};
	
	var planetNameRadiusMap = {};
	
	var convertToLangLong = function(x,y,z){
		var lat = 90 - (Math.acos(z / Math.sqrt(x*x+y*y+z*z))) * 180 / Math.PI;
		var lon = ((270 + (Math.atan2(y , x)) * 180 / Math.PI) % 360) - 180;
		return [lon, lat];
	};
	
	var convertToCartesian = function(lat, long, r) {
		var r = r === undefined ? 500 : r;
		lat *= Math.PI/180;
		long *= Math.PI/180;

		// "PA" Cartesian coordinates
		var x = r * Math.cos(lat) * Math.sin(long);
		var y = -r * Math.cos(lat) * Math.cos(long);
		var z = r * Math.sin(lat);
		
		return [x, y, z];
	};
	
	var cp = function(o) {
		return JSON.parse(JSON.stringify(o));
	};

	var oldCelestialData = handlers.celestial_data;
	handlers.celestial_data = function(payload) {
		mapName = payload.name;
		console.log("celestial data & planet index map");
		console.log(payload);
		for (var i = 0; i < payload.planets.length; i++) {
			planetNameIndexMap[payload.planets[i].index] = payload.planets[i].name;
			planetNameRadiusMap[payload.planets[i].name] = payload.planets[i].radius;
		}
		console.log(planetNameIndexMap);
		console.log(planetNameRadiusMap);
		
		return oldCelestialData(payload);
	};

	var getOrCreatePlanet = function(planetId) {
		for (var i = 0; i < planets.length; i++) {
			if (planets[i].cameraId === planetId) {
				return planets[i];
			}
		}
		var result = {
				name: planetId+"",
				id: "p-id-"+planetId,
				cameraId: planetId,
				land: [],
				sea: [],
				metal: []
			};
		planets.push(result);
		return result;
	};
	
	fixName = function(cameraId, name) {
		for (var i = 0; i < planets.length; i++) {
			if (planets[i].cameraId === cameraId) {
				planets[i].name = name;
				break;
			}
		}
		console.log("planet mappings are now: ");
		console.log(planets);
	};
	
	var getOrCreateSpawnFor = function(planetIndex) {
		for (var i = 0; i < spawns.length; i++) {
			if (spawns[i].planet_index === planetIndex) {
				return spawns[i];
			}
		}
		
		var result = {
			planet_index: planetIndex,
			spawns: []
		};
		spawns.push(result);
		return result;
	};
	
	var oldServerState = handlers.server_state;
	handlers.server_state = function(msg) {
		if (msg.state === "landing") {
			var zones = msg.data.client.zones;
			console.log(zones);
			for (var i = 0; i < zones.length; i++) {
				getOrCreateSpawnFor(zones[i].planet_index).spawns.push({x: zones[i].position[0],y: zones[i].position[1],z: zones[i].position[2]});
			}
		}
		
		console.log("spawns are: ");
		console.log(spawns);
		
		return oldServerState(msg);
	};
	
	alertsManager.addListener(function(data) {
		for (var i = 0; i < data.list.length; i++) {
			var notice = data.list[i];
			
			if (notice.watch_type === 3) {
				console.log("CLICKED PLANET WITH CAMERA ID " + notice.planet_id);
			}
			
			var isSea = notice.spec_id.indexOf("torpedo_launcher.json") !== -1;
			var isLand = notice.spec_id.indexOf("land_barrier.json") !== -1;
			var isMetal = notice.spec_id.indexOf("metal_extractor") !== -1;
			if (notice.watch_type === 0) {
				var planet = getOrCreatePlanet(notice.planet_id);
				if (isSea) {
					//planet.sea.push(cp(notice.location));
				} else if (isLand) {
					//planet.land.push(cp(notice.location));
				} else if (isMetal) {
					planet.metal.push(cp(notice.location));
				}
			}
		}
	});
	
	var stepSizeForRadius = function(radius, testsPerSqKm) {
		var sqkm = (4 * Math.PI * radius * radius) / 10E5;
		var testCount = (sqkm * testsPerSqKm);
		return Math.sqrt((360*180) / testCount);
	};
	
	var cnt = 0;
	var mapStart = new Date().getTime();
	
	mapPlanets = function(tasks) {
		var task = tasks.pop();
		
		if (task) {
			var target = {planet_id: task[0], location: {x: 1, y: 1, z: 1}, zoom: 'orbital'};
			api.camera.lookAt(target);
			
			setTimeout(function() {
				mapPlanet(task[0], task[1], planetNameRadiusMap[task[1]], function() {
					mapPlanets(tasks);
				});
			}, 3000);
		} else {
			printmap();
		}
	};

	var mapPlanet = function(cameraId, planetName, radius, finish) {
		console.log("initiating mex placement on "+planetName);

		placeMexOnCurrentPlanet(cameraId, function() {
			console.log("starting to map planet "+planetName);
			cnt = 0;
			mapStart = new Date().getTime();

			var stepSize = stepSizeForRadius(radius, 750);
			testLongLat(-180, -90, stepSize, cameraId, function() {
				fixName(cameraId, planetName);
				var diff = (new Date().getTime() - mapStart) / 1000;
				var perSec = cnt / diff;
				console.log("mapped out "+cnt+" locations for planet "+planetName+" in "+diff+" seconds, that is a mapping rate of "+perSec+" locations per second");
				finish();
			});
		});
	};
	
	console.log("to map out the planet run mapPlanet([[<cameraId>, 'exact planet name'], [<cameraId>, 'exact planet name'], [<more planets>]]);");
	console.log("to get the camera id of planets make a ping somewhere on them, the debugger will print their id for you, sadly there is no way for the code alone to now the mapping of id to name");
	
	var placeMexOnCurrentPlanet = function(cameraId, finish) {
		api.camera.lookAt({planet_id: cameraId, location: {x: 1, y: 1, z: 1}, zoom: 'air'});
		api.select.empty();
		model.send_message('create_unit', {
			  army: 1,
			  what: "/pa/units/commanders/avatar/avatar.json",
			  planet: cameraId,
			  location: {x:1, y:1, z:1}
		});
		api.select.allFabbersOnScreen();
		setTimeout(function() {
			api.select.allFabbersOnScreen();
			api.camera.lookAt({planet_id: cameraId, location: {x: 1, y: 1, z: 1}, zoom: 'orbital'});
		}, 750);
		setTimeout(function() {
			api.select.allFabbersOnScreen();
			setTimeout(function() {
				api.arch.beginFabMode("/pa/units/land/metal_extractor/metal_extractor.json").then(function(ok) {
					var screenx = model.holodeck.div.clientWidth / 2;
					var screeny = model.holodeck.div.clientHeight / 2;
					model.holodeck.unitBeginFab(screenx, screeny, false);
					setTimeout(function() {
						model.holodeck.unitEndFab(model.holodeck.div.clientWidth-10, model.holodeck.div.clientHeight/2, false, false).then(function(suc) {
							if (!suc) console.log("failed to build mex");
							setTimeout(function() {
								api.arch.endFabMode();
								setTimeout(function() {
									api.select.empty();
									finish();
								}, 250);
							}, 500);
						});
					}, 250);
				});
			}, 1000);
		}, 1000);
	};
	
	var testLongLat = function(long, lat, stepSize, cameraId, finish) {
		cnt++;
		if (lat > 90) {
			testLongLat(long + stepSize, -90, stepSize, cameraId, finish);
		} else if (long <= 180) {
			var p = convertToCartesian(lat, long);
			testPosition(cameraId, p[0], p[1], p[2], function() {
				testLongLat(long, lat + stepSize, stepSize, cameraId, finish);
			});
		} else {
			if (finish) {
				finish();
			}
		}
	};
	
	var testPosition = function(cameraId, x, y, z, complete) {
		var loc = {x: x, y: y, z: z};
		var target = {planet_id: cameraId, location: loc, zoom: 'orbital'};
		api.camera.lookAt(target);
		var testSea = function() {
			testFab("/pa/units/sea/torpedo_launcher/torpedo_launcher.json", function() {
				getOrCreatePlanet(cameraId).sea.push(loc);
			}, complete);
		};
		
		testFab("/pa/units/land/land_barrier/land_barrier.json", function() {
			getOrCreatePlanet(cameraId).land.push(loc);
		}, testSea);
	};
	
	var testFab = function(spec, hithandler, complete) {
		api.arch.beginFabMode(spec).then(function(ok) {
			var screenx = model.holodeck.div.clientWidth / 2;
			var screeny = model.holodeck.div.clientHeight / 2;
			model.holodeck.unitBeginFab(screenx, screeny, false);
			model.holodeck.unitEndFab(screenx, screeny, false, false).then(function(suc) {
				if (suc) {
					hithandler();
				}
				api.arch.endFabMode();
				complete();
			});
		});
	};
	
	var mappingFrom = function(ar) {
		if (ar === undefined || ar.length === 0) {
			return undefined;
		}
		
		var fs = [];
		for (var i = 0; i < ar.length; i++) {
			var magic = convertToLangLong(ar[i].x, ar[i].y, ar[i].z);
			magic.length = 2;
			fs.push(magic);
		}
		var fbar =  { "type": "FeatureCollection", "features": 
			[ {"type": "Feature", "geometry": {"type": "MultiPoint", "coordinates": fs}}]
		};
		
		return fbar;
	};

	printmap = function() {
		var mapData = {};
		mapData[mapName] = {planets:[]};
		
		for (var i = 0; i < planets.length; i++) {
			var cp = JSON.parse(JSON.stringify(planets[i]));
			cp.land = mappingFrom(cp.land);
			cp.metal = mappingFrom(cp.metal);
			cp.sea = mappingFrom(cp.sea);
			
			for (var j = 0; j < spawns.length; j++) {
				if (planetNameIndexMap[spawns[j].planet_index] === cp.name) {
					var spawnCp = JSON.parse(JSON.stringify(spawns[j]));
					cp.spawns = mappingFrom(spawnCp.spawns);
				}
			}
			
			mapData[mapName].planets.push(cp);
		}

		console.log(JSON.stringify(mapData));
	};
	
}());