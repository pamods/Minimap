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
	var cursorKey = "info.nanodesu.defaultIconKey";
	var oldEngineCall = engine.call;
	engine.call = function() {
		if (arguments && arguments.length && arguments.length > 0 && arguments[0] === "pop_mouse_constraint_flag") {
			localStorage[cursorKey] = "coui://ui/main/game/live_game/img/cursors/cursor.png";
		}
		return oldEngineCall.apply(this, arguments);
	};
	
	var cursorTypeComputed = ko.computed(function() {
		var hasSelection = model.hasSelection();
		if ((model.mode() === "default" || model.mode() === "command_move") && hasSelection) {
			localStorage[cursorKey] ="coui://ui/main/game/live_game/img/cursors/icons_command_move.png";
		} else if (hasSelection && model.mode() === "command_patrol") {
			localStorage[cursorKey] ="coui://ui/main/game/live_game/img/cursors/icons_command_patrol.png";
		} else if (hasSelection && model.mode() === "command_attack") {
			localStorage[cursorKey] = "coui://ui/main/game/live_game/img/cursors/icons_command_attack.png";
		} else if (model.mode() === "command_ping") {
			localStorage[cursorKey] = "coui://ui/main/game/live_game/img/cursors/icons_command_ping.png";
		} else {
			localStorage[cursorKey] ="coui://ui/main/game/live_game/img/cursors/cursor.png";
		}
	});
	
	model.mode.subscribe(function(m) {
		if (m === "command_move" || m === "command_patrol" || m === "command_attack" || m === "command_ping") {
			pmUberMap('commandMode', m);
		} else {
			pmUberMap('commandMode', "default");
		}
	});
	
	handlers.quitCommandMode = model.endCommandMode;
	
	var unoptimizeStarted = false;
	var startUnoptimizeForPlanet = function(id, delay) {
		var flip = 1;
		setTimeout(function() {
			setInterval(function() {
				unitCommands.noopcam(0, 0, flip, id);
				flip *= -1;
			}, 250);
		}, delay);
	};
	
	var oldCelestialData = handlers.celestial_data;
	handlers.celestial_data = function(payload) {
		oldCelestialData(payload);
		if (!unoptimizeStarted) {
			unoptimizeStarted = true;
			for (var i = 0; i < payload.planets.length; i++) {
				startUnoptimizeForPlanet(payload.planets[i].id, 5000);
			}
		}
	};
	
	handlers.setTopRightPreview = function(s) {
		var h = $("holodeck.preview");
		if (!s) {
			h.css({"position": "relative", "top": "0px", "right": "0px"});
		} else {
			h.css({"position": "fixed", "top": "35px", "right": "-316px"});
		}
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
	
	handlers.runUnitCommand = function(payload) {
		unitCommands[payload.method].apply(null, payload.arguments);
	};
	
	var oldShowAlertPreview = model.showAlertPreview;
	model.showAlertPreview = function(target) {
		var oldLookAt = api.camera.lookAt;
		api.camera.lookAt = function(target) {
			oldLookAt(target);
			// locks the poles for the alerts preview pip
			api.camera.alignToPole();
		};
		oldShowAlertPreview(target);
		api.camera.lookAt = oldLookAt;
	};
	
	var colorByArmyId = {};
	var oldServerState = handlers.server_state;
	var selfArmyId = undefined;
	handlers.server_state = function(msg) {
		console.log("server state");
		console.log(msg);
		oldServerState(msg);
		if (msg.data.armies) {
			for (var i = 0; i < msg.data.armies.length; i++) {
				colorByArmyId[msg.data.armies[i].id] = msg.data.armies[i].color;
			}
		}
		
		if (msg.data.client.army_id) {
			selfArmyId = msg.data.client.army_id;
		}
		
		handlers.queryArmyInfo();
	};
	
	handlers.queryArmyInfo = function() {
		console.log("query army colors called...");
		pmUberMap("setArmyInfo", [colorByArmyId, selfArmyId]);
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
	
	handlers.setMainCamera = function(target) {
		var focusBefore = api.Holodeck.focused;
		api.holodecks[0].focus();
		
		api.camera.lookAt(target);
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