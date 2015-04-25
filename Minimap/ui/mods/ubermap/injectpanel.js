console.log("inject ubermap");

(function() {
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
		api.panels.ubermap_panel.message('setSize', [window.screen.width, window.screen.height]);
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
	handlers.server_state = function(msg) {
		oldServerState(msg);
//		if (msg.data.client && msg.data.client.commander && msg.data.client.commander.id && msg.data.client.commander.army) {
//			commanderId = msg.data.client.commander.id;
//			commanderArmy = msg.data.client.commander.army.id;
//		}
		if (msg.data.armies) {
			for (var i = 0; i < msg.data.armies.length; i++) {
				colorByArmyId[msg.data.armies[i].id] = msg.data.armies[i].color;
			}
		}
		
		handlers.queryArmyColors();
		
//		if (msg.data.client.army_id) {
//			api.panels.minimap_panel.message("setMyArmyId", msg.data.client.army_id);
//		}
		
//		playing = msg.state === "playing";
//		handlers.queryIsPlaying();
	};
	
	handlers.queryArmyColors = function() {
		console.log("query army colors called...");
		api.panels.ubermap_panel.message("setArmyColors", colorByArmyId);
	};
	

	
}());

$(document).ready(function() {
	// the main menu should be on top of everything, always
	$('.div_sidebar_left').css("z-index", "99999");
	var func = function(v) {
		if (!v) {
			var $panel = $('<panel id="ubermap_panel"></panel>').css({
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
	
	func(model.isSpectator());
	model.isSpectator.subscribe(func);
	
	 $(document).keydown(function (e) {
		 if (model.chatSelected())
			 return;
		 
		 if (e.which === 32) {
			 api.panels.ubermap_panel.message("toggleUberMap");
		 }
	 });
	
});