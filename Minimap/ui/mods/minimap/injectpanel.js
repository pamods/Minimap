console.log("inject minimap");
(function() {
	handlers.queryViewportSize = function() {
		api.panels.minimap_panel.message('setSize', window.screen.width);
	};
	var oldOnResize = window.onresize;
	window.onresize = function(w) {
		if (typeof oldOnResize === "function") {
			oldOnResize(w);
		}
		
		api.panels.minimap_panel.message('setSize', window.screen.width);
	};
	
	handlers.runUnitCommand = function(payload) {
		unitCommands[payload.method].apply(null, payload.arguments);
	};
	handlers.changeMinimapZ = function(payload) {
		$('#minimap_panel').css('z-index', payload.z);
	}
	
	var colorByArmyId = {};
	var commanderId = undefined;
	var commanderArmy = undefined;
	
	var playing = false;
	
	var oldServerState = handlers.server_state;
	handlers.server_state = function(msg) {
		oldServerState(msg);
		if (msg.data.client && msg.data.client.commander && msg.data.client.commander.id && msg.data.client.commander.army) {
			commanderId = msg.data.client.commander.id;
			commanderArmy = msg.data.client.commander.army.id;
		}
		if (msg.data.armies) {
			for (var i = 0; i < msg.data.armies.length; i++) {
				colorByArmyId[msg.data.armies[i].id] = msg.data.armies[i].color;
			}
		}
		
		playing = msg.state === "playing";
		handlers.queryIsPlaying();
	};
	
	handlers.queryCommanderId = function() {
		console.log("query commander id called...");
		api.panels.minimap_panel.message("setCommanderId", [commanderId, commanderArmy]);
	};
	
	handlers.queryArmyColors = function() {
		console.log("query army colors called...");
		api.panels.minimap_panel.message("setArmyColors", colorByArmyId);
	};
	
	handlers.queryIsPlaying = function() {
		if (playing) {
			api.panels.minimap_panel.message("startPlaying");
		}
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
	
}());
$(document).ready(function() {
	$('.div_sidebar_left').css("z-index", "99999");
	var func = function(v) {
		if (!v) {
			var $panel = $('<panel id="minimap_panel"></panel>').css({
				visibility : 'visible',
				position : 'fixed',
				top : 30,
				left : 0,
				'z-index' : 9999
			}).attr({
				name : "minimap_panel",
				src : "coui://ui/mods/minimap/minimap.html",
				'no-keyboard' : true,
				'yield-focus' : true,
				fit : "dock-top-left",
				class: "ignoreMouse",
			});
			$panel.appendTo($('body'));
			api.Panel.bindPanels();
		} else {
			$('#minimap_panel').remove();
		}
	};
	
	func(model.isSpectator());
	model.isSpectator.subscribe(func);
});