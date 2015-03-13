console.log("loaded geomapper");

(function() {
	
	var exportData = undefined;
	
	var testsToDoPerSqKm  = 2250;
	
	var oldChatHandler = handlers.chat_message;
	handlers.chat_message = function(msg) {
		if (oldChatHandler) {
			oldChatHandler(msg);
		}
		if (msg.message === "startmapping") {
			sendChatMessage("will begin to map planets now. Please do not touch the game while this is happening. You can put PA into background, but do NOT minimize it");
			detectPlanetsAndMapThem();
		}
		if (msg.message === "exportMapping") {
			exportData();
		}
	};
	
	var sendChatMessage = function(txt) {
		if (model.send_message) {
			model.send_message("chat_message", {message: txt});
		} else {
			setTimeout(function() {
				sendChatMessage(txt);
			}, 500);
		}
	};
	
	sendChatMessage("GeoMapper is enabled. Disable it for normal play. To start mapping the loaded system enter the commmand 'startmapping' via chat. It is recommended to first spawn the commander and place it somewhere safe (or up the forced spawn time, read the forums thread of this mod!). Notice that to get all spawnzones in your mapping you need to use a local server with a small modification. Read the forums for more info.");
	
	var mapName = "unknown";
	var planets = [];
	var spawns = [];
	
	var planetIndexNameMap = {};
	
	var planetNameRadiusMap = {};
	
	var convertToLangLong = function(x,y,z){
		var lat = 90 - (Math.acos(z / Math.sqrt(x*x+y*y+z*z))) * 180 / Math.PI;
		var lon = ((270 + (Math.atan2(y , x)) * 180 / Math.PI) % 360) - 180;
		return [lon, lat];
	};
	
	var convertToCartesian = function(lat,longi,r) {
		var r = r === undefined ? 500 : r;
		lat *= Math.PI/180;
		longi *= Math.PI/180;

		// "PA" Cartesian coordinates
		var x = r * Math.cos(lat) * Math.sin(longi);
		var y = -r * Math.cos(lat) * Math.cos(longi);
		var z = r * Math.sin(lat);
		
		return [x, y, z];
	};
	
	var cp = function(o) {
		return JSON.parse(JSON.stringify(o));
	};

	var gasPlanets = [];
	
	var oldCelestialData = handlers.celestial_data;
	handlers.celestial_data = function(payload) {
		mapName = payload.name;
		console.log("celestial data & planet index map");
		console.log(payload);
		for (var i = 0; i < payload.planets.length; i++) {
			planetIndexNameMap[payload.planets[i].index] = payload.planets[i].name;
			planetNameRadiusMap[payload.planets[i].name] = payload.planets[i].radius;
			if (payload.planets[i].biome === "gas") {
				gasPlanets.push(payload.planets[i].name);
			}
		}
		console.log(planetIndexNameMap);
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
	
	var lastMetalTime = new Date().getTime();
	
	alertsManager.addListener(function(data) {
		for (var i = 0; i < data.list.length; i++) {
			var notice = data.list[i];
			
			var isMetal = notice.spec_id.indexOf("metal_extractor") !== -1;
			if (notice.watch_type === 0) {
				var planet = getOrCreatePlanet(notice.planet_id);
				if (isMetal) {
					lastMetalTime = new Date().getTime();
					planet.metal.push(cp(notice.location));
				}
			}
		}
	});
	
	var testCountForRadius = function(radius, testsPerSqKm) {
		var sqkm = (4 * Math.PI * radius * radius) / 10E5;
		var testCount = (sqkm * testsPerSqKm);
		return testCount;
	}
	
	var stepSizeForRadius = function(radius, testsPerSqKm) {
		return Math.sqrt((360*180) / testCountForRadius(radius, testsPerSqKm));
	};
	
	var placeMexOnCurrentPlanet = function(cameraId, finish) {
		api.camera.lookAt({planet_id: cameraId, location: {x: 1, y: 1, z: 1}, zoom: 'air'});
		api.select.empty();
		
		// spawning in a fabber and selecting it is a friggn pain to get working reliably...
		engine.call("unit.debug.setSpecId", "/pa/units/commanders/avatar/avatar.json");
		engine.call("unit.debug.paste");
		api.select.allFabbers();
		setTimeout(function() {
			engine.call("unit.debug.setSpecId", "/pa/units/commanders/avatar/avatar.json");
			engine.call("unit.debug.paste");
			api.select.allFabbers();
			api.camera.lookAt({planet_id: cameraId, location: {x: 1, y: 1, z: 1}, zoom: 'orbital'});
		}, 1000);
		setTimeout(function() {
			engine.call("unit.debug.setSpecId", "/pa/units/commanders/avatar/avatar.json");
			engine.call("unit.debug.paste");
			api.select.allFabbers();
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
			}, 1500);
		}, 2500);
	};
	
	var allCnt = 0;
	var cnt = 0;
	var mapStart = new Date().getTime();
	var nextPingPlanet = undefined;
	var rePingPlanets = [];
	var toMap = [];
	
	var checkName = function(indices) {
		var index = Number(indices.pop());
		if (index === 0 || index) {
			var name = planetIndexNameMap[index];
			api.camera.focusPlanet(index);
			setTimeout(function() {
				nextPingPlanet = name;
				rePingPlanets = indices;
				var screenx = model.holodeck.div.clientWidth / 2;
				var screeny = model.holodeck.div.clientHeight / 2;
				model.holodeck.unitCommand('ping', screenx, screeny, false);
			}, 2000);
		} else {
			
			mapPlanets(toMap);
		}
	};
	
	alertsManager.addListener(function(data) {
		for (var i = 0; i < data.list.length; i++) {
			var notice = data.list[i];
			if (notice.watch_type === 3) {
				sendChatMessage("Add planet "+nextPingPlanet+" with id " + notice.planet_id);
				toMap.push([notice.planet_id, nextPingPlanet]);
				
				sendChatMessage("initiating mex placement on "+nextPingPlanet);
				placeMexOnCurrentPlanet(notice.planet_id, function() {
					checkName(rePingPlanets);
				});
			}
		}
	});
	
	detectPlanetsAndMapThem = function() {
		var ids = [];
		
		var target = {planet_id: 0, location: {x: 1, y: 1, z: 1}, zoom: 'air'};
		api.camera.lookAt(target);
		
		for (prop in planetIndexNameMap) {
			if (planetIndexNameMap.hasOwnProperty(prop)) {
				ids.push(prop);
			}
		}
		
		toMap = [];
		checkName(ids);
	};
	
	mapPlanets = function(tasks) {
		sendChatMessage("will now map planets");
		console.log(cp(tasks));
		var task = tasks.pop();
		
		console.log("HAHAHAH");
		console.log(task);
		console.log(gasPlanets);
		
		while(task !== undefined && gasPlanets.indexOf(task[1]) !== -1) {
			sendChatMessage("skip planet "+task[1]+": it is a gas planet");
			task = tasks.pop();
		}
		
		if (task) {
			var target = {planet_id: task[0], location: {x: 1, y: 1, z: 1}, zoom: 'orbital'};
			api.camera.lookAt(target);
			
			setTimeout(function() {
				mapPlanet(task[0], task[1], planetNameRadiusMap[task[1]], function() {
					mapPlanets(tasks);
				});
			}, 3000);
		} else {
			
			var waitForMetal = function() {
				if (new Date().getTime() - lastMetalTime < 15000) {
					sendChatMessage("it seems mex are still being placed, please wait...");
					setTimeout(waitForMetal, 5000);
				} else {
					printmap();
				}
			};
			
			waitForMetal();
		}
	};

	var getNumberOfLocationsToMap = function() {
		var sum = 0;
		for (var p in planetNameRadiusMap) {
			if (planetNameRadiusMap.hasOwnProperty(p)) {
				var radius = planetNameRadiusMap[p];
				sum += testCountForRadius(radius, testsToDoPerSqKm);
			}
		}
		return sum;
	};
	
	var mapPlanet = function(cameraId, planetName, radius, finish) {
		sendChatMessage("starting to map planet "+planetName);
		cnt = 0;
		mapStart = new Date().getTime();

		var stepSize = stepSizeForRadius(radius, testsToDoPerSqKm);
		testLongLat(-180, -90, stepSize, cameraId, function() {
			fixName(cameraId, planetName);
			var diff = (new Date().getTime() - mapStart) / 1000;
			var perSec = cnt / diff;
			sendChatMessage("mapped out "+cnt+" locations for planet "+planetName+" in "+diff.toFixed(2)+" seconds, that is a mapping rate of "+perSec.toFixed(2)+" locations per second");
			finish();
		});
	};
	
	var oldH = handlers.server_state;
	var myArmyId = 0;
	handlers.server_state = function(payload) {
		if (payload && payload.data && payload.data.client && payload.data.client.army_id) {
			myArmyId = payload.data.client.army_id;
			console.log("client army is: "+myArmyId);
		} else {
			console.log(payload);
		}
		return oldH(payload);
	};
	
	var testLongLat = function(longi, lat, stepSize, cameraId, finish) {
		cnt++;
		allCnt++;
		if (lat > 90) {
			var percent = Math.min(100, ((allCnt/getNumberOfLocationsToMap())*100)).toFixed(2);
			var perSec = allCnt / ((new Date().getTime() - mapStart)/1000);
			var todo = getNumberOfLocationsToMap() - allCnt;
			var estimateMin = ((todo/perSec)/60 + 1).toFixed(0);
			sendChatMessage("completed "+percent+"%. ETA "+estimateMin+" minutes");
			testLongLat(longi + stepSize, -90, stepSize, cameraId, finish);
		} else if (longi <= 180) {
			var p = convertToCartesian(lat, longi);
			testPosition(cameraId, p[0], p[1], p[2], function() {
				testLongLat(longi, lat + stepSize, stepSize, cameraId, finish);
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
	
	var mappingFrom = function(ar, type) {
		if (ar === undefined || ar.length === 0) {
			return undefined;
		}
		
		var fs = [];
		for (var i = 0; i < ar.length; i++) {
			var magic = convertToLangLong(ar[i].x, ar[i].y, ar[i].z);
			magic.length = 2;
			magic[0] = Number(magic[0].toFixed(3));
			magic[1] = Number(magic[1].toFixed(3));
			fs.push(magic);
		}
		var fbar = {
			"type" : "FeatureCollection",
			"features" : [ {
				"type" : "Feature",
				"geometry" : {
					"type" : "MultiPoint",
					"coordinates" : fs
				}
			}],
			"properties": {
				"type": type
			}
		};
		
		return fbar;
	};

	var dbName = "info.nanodesu.info.minimaps";
	
	printmap = function() {
		var mapData = {planets:[]};
		
		for (var i = 0; i < planets.length; i++) {
			var cp = JSON.parse(JSON.stringify(planets[i]));
			cp.land = mappingFrom(cp.land, "land");
			cp.metal = mappingFrom(cp.metal, "metal");
			cp.sea = mappingFrom(cp.sea, "sea");
			
			for (var j = 0; j < spawns.length; j++) {
				if (planetIndexNameMap[spawns[j].planet_index] === cp.name) {
					var spawnCp = JSON.parse(JSON.stringify(spawns[j]));
					cp.spawns = mappingFrom(spawnCp.spawns, "spawns");
				}
			}
			
			mapData.planets.push(cp);
		}
		
		
		var mapList = decode(localStorage["info.nanodesu.minimapkeys"]) || {};

		if (mapList[mapName]) {
			sendChatMessage("upadting entry for the mapdata of map named "+mapName+" ...");
			DataUtility.updateObject(dbName, mapList[mapName], mapData).then(function() {
				console.log("update entry complete:");
				console.log(arguments);
			});
		} else {
			sendChatMessage("creating a new entry for the mapdata of map named "+mapName);
			DataUtility.addObject(dbName, mapData).then(function(key) {
				mapList[mapName] = key;
				localStorage["info.nanodesu.minimapkeys"] = encode(mapList);
				sendChatMessage("created a new entry for the mapdata of map named "+mapName+", now has key "+key);
			});
		}
		
		var keybindFor = function (key) {
            var binding = api.settings.value('keyboard', key);
            if (!binding)
                return 'not bound';
            return binding;
        };
		
		sendChatMessage("Mapping completed, press " + keybindFor("reload_view") +  " to reload the view");
		
//		console.log(JSON.stringify(mapData));
	};
	
	exportData = function() {
		var mapList = decode(localStorage["info.nanodesu.minimapkeys"])
		
		var configs = [];
		
		for (var key in localStorage) {
			if (key.startsWith("info.nanodesu.minimap.config")) {
				configs.push([key, localStorage[key]]);
			}
		}
		
		var systems = {};
		var endCnt = 0;
		
		var compileSystemsJs = function() {
			var file = "var minimapSystems = "+JSON.stringify(systems)+";"+
				"var minimapConfigs = "+JSON.stringify(configs)+";";
			api.file.saveDialog("systems.js", file);
		};
		
		var putResult = function(name, key) {
			DataUtility.readObject(dbName, key).then(function(data) {
				systems[name] = data;
				endCnt--;
				if (endCnt === 0) {
					compileSystemsJs();
				}
			});
		};
		
		for (var mapName in mapList) {
			if (mapList.hasOwnProperty(mapName)) {
				var mapKey = mapList[mapName];
				endCnt++;
				putResult(mapName, mapKey);
			}
		}
	};
}());