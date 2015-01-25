var unitCommands =
	(typeof unitCommands === 'undefined') ?
(function() {
	var xHackPosition = -75;
	var yHackPosition = 250;
	
	// init these only after the document is ready!
	function HackDeck(planetId) {
		var self = this;
		
		var size = 71; // smaller means less precise clicks
		var cameraMoveWait = 30; // (ms) lower means faster command execution, but too low will cause failed commands due to the camera movement not finishing fast enough
		
		var clickTarget = Math.ceil(size / 2);;
		
		var deckId = 'unit_cmd_hack_pip_'+xHackPosition+"_"+yHackPosition;
		var deck = $('<holodeck class="pip"></holodeck>');
		var yPosition = yHackPosition;
		yHackPosition += size;
		deck.attr('style', "top: "+xHackPosition+"px; left: "+yPosition+"px; width: "+size+"px; height: "+size+"px;z-index: -1;position:fixed;");
		deck.attr('id', deckId);
		$('body').append(deck);
		self.hdeck = new api.Holodeck($('#'+deckId), {}, undefined);
		
		console.log("created hack holodeck for commands on planet "+planetId);
		
		self.setHdeckCamera = function(x, y, z) {
			var focusBefore = model.holodeck; // assumes we are in live_game
			self.hdeck.focus();
			api.camera.lookAt({planet_id: planetId, location: {x: x, y: y, z: z}, zoom: 'air'});
			if (focusBefore) {
				focusBefore.focus();
			}
		};
		
		setTimeout(function() {
			self.setHdeckCamera(1, 1, 1);
		}, 1000);
		
		var commandsWaiting = [];
		var movingCamera = false;
		
		var runNextPotentialNextCommand = function() {
			var next = commandsWaiting.splice(0, 1);
			if (next && next[0]) {
				next[0]();
			}
		};
		
		var runLocationCommand = function(x, y, z, queue, cmd) {
			if (!movingCamera) {
				movingCamera = true;
				self.setHdeckCamera(x, y, z);
				setTimeout(function() {
					cmd();
					movingCamera = false;
					runNextPotentialNextCommand();
				}, cameraMoveWait); // race condition vs camera movement
			} else {
				commandsWaiting.push(function() {
					runLocationCommand(x, y, z, queue, cmd);
				});
			}
		};
		
		self.moveSelected = function(x, y, z, queue) {
			runLocationCommand(x, y, z, queue, function() {
				self.hdeck.unitGo(clickTarget, clickTarget, queue === undefined ? false : queue);
			});
		};
		
		self.ping = function(x, y, z) {
			runLocationCommand(x, y, z, false, function() {
				self.hdeck.unitCommand("ping", clickTarget, clickTarget, false);
			});
		};
		
		// TODO add other commands
	}
	
	var hackPlanetMapping = {};
	
	var oldCelestialData = handlers.celestial_data
	handlers.celestial_data = function(payload) {
		var r = oldCelestialData(payload);
		
		console.log("does it include the camera id?");
		console.log(payload);
		

		hackPlanetMapping[0] = 0;
		
		$(document).ready(function() {
			for (p in hackPlanetMapping) {
				if (hackPlanetMapping.hasOwnProperty(p)) {
					var pid = hackPlanetMapping[p];
					hackPlanetMapping[p] = new HackDeck(pid);
				}
			}
		});
		
//		if (payload.planets) {
//			for (var i = 0; i < payload.planets.length; i++) {
//				var planet = payload.planets[i];
//				console.log(planet);
//				
//				hackPlanetMapping[payload.planets[i].index] = "";
//			}
//			console.log(hackPlanetMapping);
//		}
		return r;
	};
	
	var getHackDeck = function(p) {
		var hackDeck = hackPlanetMapping[p];
		if (hackDeck === undefined) { // TODO this should not be required if I had all planet ids at the start... with this it will fail on the first command due to the setuptime
			hackDeck = new HackDeck(p);
			hackPlanetMapping[p] = hackDeck;
		}
		return hackDeck;
	};
	
	return {
		ping: function(x, y, z, p) {
			getHackDeck(p).ping(x, y, z);
		},
		moveSelected: function(x, y, z, p, queue) {
			getHackDeck(p).moveSelected(x, y, z, queue);
		}
	};
}()) : unitCommands;

console.log("loaded unitcommands.js");