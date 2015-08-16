console.log("inject ubermap");

var pmUberMap = function(handler, arguments) {
	if (api.panels.ubermap_panel) {
		api.panels.ubermap_panel.message(handler, arguments);
	} else {
		setTimeout(function() {
			pmUberMap(handler, arguments);
		}, 500);
	}
};

(function() {
	var oldCelestial = handlers.celestial_data;
	var planetsIndexIdMap = {};
	var planetsIdIndexMap = {};
	handlers.celestial_data = function(payload) {
		oldCelestial(payload);
		_.forEach(payload.planets, function(planet) {
			planetsIndexIdMap[planet.index] = planet.id;
			planetsIdIndexMap[planet.id] = planet.index;
		});
	}; 
	
	model.mode.subscribe(function(m) {
		if (m === "command_move" || m === "command_patrol" || m === "command_attack" || m === "command_ping") {
			pmUberMap('commandMode', m);
		} else {
			pmUberMap('commandMode', "default");
		}
	});
	
	handlers.quitCommandMode = model.endCommandMode;
	
	var oldShowAlertPreview = model.showAlertPreview;

	model.showAlertPreview = function(request) {
		var oldLookAt = api.camera.lookAt;
		api.camera.lookAt = function(target) {
			oldLookAt(target);
			// locks the poles for the alerts preview pip
			api.camera.alignToPole();
		};
		oldShowAlertPreview(request);
		api.camera.lookAt = oldLookAt;
	};
	 
	handlers.queryViewportSize = function() {
		pmUberMap('setSize', [window.screen.width, window.screen.height]);
	};
	
	var oldOnResize = window.onresize;
	window.onresize = function(w) {
		if (typeof oldOnResize === "function") {
			oldOnResize(w);
		}
		
		handlers.queryViewportSize();
	};
	
	handlers.changeMinimapZ = function(payload) {
		$('#ubermap_panel').css('z-index', payload.z);
	};
	
	var oldClientState = handlers.client_state;
	handlers.client_state = function(state) {
		oldClientState(state);
		
		pmUberMap("client_state", state);
	};
	
	var commanderId = 0;
	handlers.runUnitCommand = function(payload) {
		var order = {};
		order.units = payload.units;
		
		if (payload.method === "moveSelected") {
			order.command = "move";
		} else if (payload.method === "patrolSelected") {
			order.command = "patrol";
		} else if (payload.method === "attackSelected") {
			order.command = "attack";
		} else if (payload.method === "ping") {
			order.command = "ping";
			order.units = [commanderId]; // PA verifies that the "ping" command has a unit given....
		} else {
			console.log("dunno method for order?! " + payload.method);
		}
		
		order.queue = payload.arguments[4];
		order.location = {
			planet: planetsIdIndexMap[payload.arguments[3]],
			pos: [payload.arguments[0], payload.arguments[1], payload.arguments[2]]
		};
		order.group = !payload.arguments[5];
		
		api.getWorldView(0).sendOrder(order).then(function(resp) {
//			console.log(resp);
		});
	};
	
	var colorByArmyId = {};
	var oldServerState = handlers.server_state;
	var selfArmyId = undefined;
	var selfArmyIndex = undefined;
	var armyIndexIdMap = {};
	handlers.server_state = function(msg) {
		console.log("server state");
		console.log(msg);
		oldServerState(msg);
		
		if (msg.data && msg.data.client && msg.data.client.commander) {
			commanderId = msg.data.client.commander.id;
		}
		
		if (msg.data.armies) {
			for (var i = 0; i < msg.data.armies.length; i++) {
				colorByArmyId[msg.data.armies[i].id] = msg.data.armies[i].color;
				armyIndexIdMap[i] = msg.data.armies[i].id;
			}
		}
		
		if (msg.data.client.army_id) {
			selfArmyId = msg.data.client.army_id;
		}
		
		if (msg.data.armies && msg.data.client) {
			var idToIndexMap = {};
			var armies = msg.data.armies;
			for (var i = 0; i < armies.length; i++) {
				idToIndexMap[armies[i].id] = i;
			}
			selfArmyIndex = idToIndexMap[msg.data.client.army_id];
		}
		
		handlers.queryArmyInfo();
	};
	
	handlers.queryArmyInfo = function() {
		console.log("query army info called...");
		var info = [colorByArmyId, selfArmyId, selfArmyIndex, armyIndexIdMap];
		console.log(info);
		pmUberMap("setArmyInfo", info);
	};
	
	model.showsUberMap = ko.observable(false);
	
	var holodeck = $('.primary');
	handlers.setUberMapState = function(visible) {
		model.showsUberMap(visible);
		
		var focusBefore = api.Holodeck.focused;
		api.holodecks[0].focus();
		api.camera.setAllowZoom(!visible);
		if (focusBefore) {
			focusBefore.focus();
		}
		
		if (visible) {
			holodeck.attr("style", "top: "+0+"px; left: "+0+"px; width: "+1+"px; height: "+1+"px");
		} else {
			holodeck.attr("style", "");
		}
	};

	model.showsUberMap.subscribe(function(v) {
		pmUberMap("setUberMapVisible", v);
	});
	
	setTimeout(function() {
		model.mainCameraLocation = api.camera.getFocus(model.holodeck.id).location;
		model.mainCameraPlanetIndex = api.camera.getFocus(model.holodeck.id).planet;
		model.mainCameraPlanet = ko.computed(function() {
			var index = model.mainCameraPlanetIndex();
			return planetsIndexIdMap[index];
		});
		model.mainCameraPosition = ko.computed(function() {
			var l = model.mainCameraLocation();
			return {planet: model.mainCameraPlanet(),
					x: l.x,
					y: l.y,
					z: l.z};
		});
		model.mainCameraPosition.extend({rateLimit: 50});
		model.mainCameraPosition.subscribe(function(v) {
			pmUberMap("camLoc", v);
		});
		var oldLookAt = api.camera.lookAt;
		api.camera.lookAt = function(t, s) {
			oldLookAt(t, s);
			if (model.holodeck.id === api.Holodeck.focused.id) {
				var catchPosition = function() {
					model.mainCameraLocation(t.location);
					model.mainCameraPlanetIndex(planetsIdIndexMap[t.planet_id]);
				};
				catchPosition();
				setTimeout(function() {
					catchPosition();
				}, 100);
			}
		};
	}, 3000);
	
	handlers.setMainCamera = function(target) {
		var focusBefore = api.Holodeck.focused;
		model.holodeck.focus();
		
		api.camera.lookAt(target, false);
		api.camera.alignToPole();
		
		if (focusBefore) {
			focusBefore.focus();
		}
	};
}());

$(document).ready(function() {
	// put a lot of things above the ubermap z index, as they should always be on top
	$('.div_sidebar_left').css("z-index", "99999");
	$('#chat').css("z-index", "99999");
	$('#message').css("z-index", "99999");
	$('.div_game_paused').css("z-index", "99998");
	$('#settings').css("z-index", "99999");
	$('.div_gamestats_panel').css("z-index", "99999");
	$('#game_over').css("z-index", "99999");
	$('#message').css("z-index", "99999");
	$('#player_guide').css("z-index", "99999");
	$('#popup').css('z-index', "99999");
	
	var $panel;
	var func = function(v) {
		if (!v) {
			$panel = $('<panel id="ubermap_panel"></panel>').css({
				visibility : 'visible',
				position : 'fixed',
				top : 30,
				left : 0,
				'z-index' : 9999
			}).attr({
				name : "ubermap_panel",
				src : "coui://ui/mods/ubermap/ubermap.html",
				'no-keyboard' : true,
				'yield-focus' : true,
				fit : "dock-top-left",
				class: "ignoreMouse",
			});
			$panel.appendTo($('body'));
			api.Panel.bindPanels();
		} else {
			$('#ubermap_panel').remove();
		}
	};
	
//	func(model.isSpectator());
//	model.isSpectator.subscribe(func);
	func(false);
	
	model.uber_map_toggle_uber_map = function() {
		if (!model.chatSelected()) {
			model.showsUberMap(!model.showsUberMap());
		}
	};
	
	model.uber_map_toggle_select_fighters = function() {
		pmUberMap('toggleByName', "selectsAllFighters");
	};
	model.uber_map_toggle_select_workers = function() {
		pmUberMap('toggleByName', "selectsAllWorkers");
	};
	model.uber_map_toggle_select_all = function() {
		pmUberMap('toggleByName', "selectsAll");
	};
	model.uber_map_toggle_select_orbital = function() {
		pmUberMap('toggleByName', "selectsAllOrbital");
	};
	model.uber_map_toggle_select_air = function() {
		pmUberMap('toggleByName', "selectsAllAir");
	};
	model.uber_map_toggle_select_land = function() {
		pmUberMap('toggleByName', "selectsAllLand");
	};
	model.uber_map_toggle_select_navy = function() {
		pmUberMap('toggleByName', "selectsAllNavy");
	};
	model.uber_map_toggle_select_navy_fighters = function() {
		pmUberMap('toggleByName', "selectsNavyFighters");
	};
	model.uber_map_toggle_select_navy_workers = function() {
		pmUberMap('toggleByName', "selectsNavyWorkers");
	};
	model.uber_map_toggle_select_land_fighters = function() {
		pmUberMap('toggleByName', "selectsLandFighters");
	};
	model.uber_map_toggle_select_land_workers = function() {
		pmUberMap('toggleByName', "selectsLandWorkers");
	};
	model.uber_map_toggle_select_air_fighters = function() {
		pmUberMap('toggleByName', "selectsAirFighters");
	};
	model.uber_map_toggle_select_air_workers = function() {
		pmUberMap('toggleByName', "selectsAirWorkers");
	};
	model.uber_map_toggle_select_orbital_fighters = function() {
		pmUberMap('toggleByName', "selectsOrbitalFighters");
	};
	model.uber_map_toggle_select_orbital_workers = function() {
		pmUberMap('toggleByName', "selectsOrbitalWorkers");
	};
	
	$(document).keydown(function (e) {
		 if (e.which === 16) {
			 pmUberMap("shiftState", true);
		 } else if (e.which === 17) {
			 pmUberMap("ctrlState", true);
		 }
	});
	
	$(document).keyup(function(e) {
		if (e.which === 16) {
			pmUberMap("shiftState", false);
		} else if (e.which === 17) {
			pmUberMap("ctrlState", false);
		}
	});
	
	$(document).bind('mousewheel', function(e) {
		 if (model.chatSelected())
			 return;
		 
		if (e.originalEvent.wheelDelta > 0 && model.showsUberMap()) {
			pmUberMap("zoomIntoUberMap", [e.pageX - $panel.position().left, e.pageY - $panel.position().top]);
		}
	});
});