console.log("inject ubermap");

(function() {
	
	// TODO optimize the unoptimization by doing fast constant camera movements instead of tons of static pips
	// at best combine it with the hackdecks from unitcommands
	var unoptimizeNetworkForPlanet = function(planetId) {
		var makeHackHoloDeck = function(deckId) {
			var deck = $('<holodeck class="network_unoptimization"></holodeck>');
			var size = 1;
			var yPosition = 1;
			var xPosition = 1;
			deck.attr('style', "top: "+yPosition+"px; left: "+xPosition+"px; width: "+size+"px; height: "+size+"px;z-index: -1;position:fixed;");
			deck.attr('id', deckId);
			$('body').append(deck);
			return new api.Holodeck($('#'+deckId), {}, undefined);
		};
		
		var setDeckCamera = function(deck, planet, x, y, z, zoom) {
			var focusBefore = model.holodeck; // assumes live_game
			deck.focus();
			api.camera.lookAt({planet_id: planet, location: {x: x, y: y, z: z}, zoom: zoom});
			if (focusBefore) {
				focusBefore.focus();
			}
		};
		
		var deckA = makeHackHoloDeck("network_unoptimization_planet_"+planetId+"_a");
		var deckB = makeHackHoloDeck("network_unoptimization_planet_"+planetId+"_b");
		setTimeout(function() {
			setDeckCamera(deckA, planetId, 0, 0, 1, "orbital");	
		}, 5000);
		setTimeout(function() {
			setDeckCamera(deckB, planetId, 0, 0, -1, "orbital");
		}, 5000);
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
	
});