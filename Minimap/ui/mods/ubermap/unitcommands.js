var unitCommands =
	(typeof unitCommands === 'undefined') ?
(function() {
	var xHackPosition = -500;
	var yHackPosition = 50;
	
	// init these only after the document is ready!
	function HackDeck(planetId) {
		var self = this;
		
		var size = 71; // smaller means less precise clicks
		var cameraMoveWait = 100; // (ms) lower means faster command execution, but too low will cause failed commands due to the camera movement not finishing fast enough
		
		var clickTarget = Math.ceil(size / 2);;
		
		var deckId = 'unit_cmd_hack_pip_'+xHackPosition+"_"+yHackPosition;
		var deck = $('<holodeck class="pip"></holodeck>');
		var yPosition = yHackPosition;
		yHackPosition += size;
		deck.attr('style', "top: "+yHackPosition+"px; left: "+xHackPosition+"px; width: "+size+"px; height: "+size+"px;z-index: -1;position:fixed;");
		deck.attr('id', deckId);
		$('body').append(deck);
		self.hdeck = new api.Holodeck($('#'+deckId), {}, undefined);
		
		console.log("created hack holodeck for commands on planet "+planetId);
		
		self.setHdeckCamera = function(x, y, z, zoom) {
			var focusBefore = api.Holodeck.focused;
			self.hdeck.focus();
			var zoom = zoom === undefined ? 'air' : zoom;
			api.camera.lookAt({planet_id: planetId, location: {x: x, y: y, z: z}, zoom: zoom});
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
		
		var runLocationCommand = function(x, y, z, queue, cmd, zoom) {
			if (!movingCamera) {
				movingCamera = true;
				self.setHdeckCamera(x, y, z, zoom);
				setTimeout(function() {
					cmd();
					movingCamera = false;
					setTimeout(runNextPotentialNextCommand, cameraMoveWait);
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
		
		self.noopcam = function(x, y, z) {
			runLocationCommand(x, y, z, false, function() {
				// noop. This is used for invisible camera movements to get rid of network optimizations for the unit icons
			}, "orbital");
		}
		
		// TODO add other commands
	}
	
	var hackPlanetMapping = {};
	
	var getHackDeck = function(p) {
		var hackDeck = hackPlanetMapping[p];
		if (hackDeck === undefined) {
			hackDeck = new HackDeck(p);
			hackPlanetMapping[p] = hackDeck;
			console.log("created hackdeck for planet with id "+p);
		}
		return hackDeck;
	};
	
	var oldCelestialData = handlers.celestial_data
	handlers.celestial_data = function(payload) {
		var r = oldCelestialData(payload);
		
		if (payload.planets) {
			for (var i = 0; i < payload.planets.length; i++) {
				if (hackPlanetMapping[payload.planets[i].id] === undefined) {
					var planet = payload.planets[i];
					console.log("prepare for creation of hackdeck for planet");
					console.log(planet);
					hackPlanetMapping[payload.planets[i].id] = 42;
				}
			}
		}
		
		$(document).ready(function() {
			for (p in hackPlanetMapping) {
				if (hackPlanetMapping[p] === 42) {
					console.log("create hackdeck for planet id "+p);
					var pid = hackPlanetMapping[p];
					hackPlanetMapping[p] = new HackDeck(p);
				}
			}
		});
		
		return r;
	};
	
	return {
		ping: function(x, y, z, p) {
			getHackDeck(p).ping(x, y, z);
		},
		moveSelected: function(x, y, z, p, queue) {
			getHackDeck(p).moveSelected(x, y, z, queue);
		},
		noopcam: function(x, y, z, p) {
			getHackDeck(p).noopcam(x, y, z);
		},
	};
}()) : unitCommands;

console.log("loaded unitcommands.js");