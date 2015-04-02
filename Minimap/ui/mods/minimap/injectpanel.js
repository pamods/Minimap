console.log("inject minimap");
(function() {
	
	// http://stackoverflow.com/questions/2360655/jquery-event-handlers-always-execute-in-order-they-were-bound-any-way-around-t
	// [name] is the name of the event "click", "mouseover", ..
	// same as you'd pass it to bind()
	// [fn] is the handler function
	$.fn.bindFirst = function(name, fn) {
		// bind as you normally would
		// don't want to miss out on any jQuery magic
		this.on(name, fn);
	
		// Thanks to a comment by @Martin, adding support for
		// namespaced events too.
		this.each(function() {
			var handlers = $._data(this, 'events')[name.split('.')[0]];
			// take out the handler we just inserted from the end
			var handler = handlers.pop();
			// move it at the beginning
			handlers.splice(0, 0, handler);
		});
	};
	
	var planetIdToIndexMap = {};
	
	var oldCelestialH = handlers.celestial_data;
	handlers.celestial_data = function(payload) {
		oldCelestialH(payload);
		var ps = payload.planets;
		for (var i = 0; i < ps.length; i++) {
			planetIdToIndexMap[ps[i].id] = ps[i].index;
		}
	};
	
	var focusView = false;
	var focusLocation = undefined;
	var focusInterval = undefined;
	
	var clearFocusInterval = function() {
		clearInterval(focusInterval);
		focusInterval = undefined;
	};
	
	var lastWheelMove = 0;
	$(window).bind('mousewheel DOMMouseScroll', function(event){
		lastWheelMove = new Date().getTime();
		if (focusView) {
			if (focusLocation !== undefined && focusInterval === undefined) {
				focusInterval = setInterval(function() {
					var focusP = planetIdToIndexMap[focusLocation[2]];
					api.camera.focusPlanet(focusP);
					lookAtFocus();
					if (new Date().getTime() - lastWheelMove > 1000) {
						clearFocusInterval()
					}
				}, 10);
			}
		}
	});
	
	var mouseDownHandler = function(e) {
		if (e.button === 1) {
			console.log("clear focus due to mouse movement");
			clearFocusInterval();
		}
	};
	$(document).bindFirst("mousedown", mouseDownHandler);
	$('holodeck').bindFirst("mousedown", mouseDownHandler);
	
	var holodeck = $('.primary');
	var hMidX = 0;
	var hMidY = 0;
	var hx = 0;
	var hy = 0;
	var w = 100;
	var h = 100;
	
	var lookAtFocus = function() {
		var lookTarget = {
			location: {
				x: focusLocation[0],
				y: focusLocation[1],
				z: focusLocation[2],
			},
			planet_id: focusLocation[3],
			zoom: 'invalid' // by pure chance I found that when I pass in an unknown string it just keeps the current zoom level. YEY that is what I wanted to do.
		};
		console.log(lookTarget);
		api.camera.lookAt(lookTarget);
		api.camera.alignToPole();
	};
	
	handlers.focusMainViewHack = function(params) {
		/*
		var x = params[0];
		var y = params[1];
		var leftX = x - w/2;
		var topY = y - h/2;
		hx = leftX;
		hy = topY;
		hMidX = x;
		hMidY = y;
		holodeck.attr("style", "top: "+topY+"px; left: "+leftX+"px; width: "+w+"px; height: "+h+"px");
		*/
		
		focusView = true;
		
		if (params[2]/* && (new Date().getTime() - lastWheelMove > 1000)*/) {
			focusLocation = params[2];
			lookAtFocus();
		}
	};
	
	handlers.fullMainView = function() {
//		var leftExtend = hx;
//		var rightExtend = window.screen.width - leftExtend;
//		var extendW = Math.max(leftExtend, rightExtend) * 2;
//		
//		console.log("extendW = " + extendW);
//		
//		var topExtend = hy;
//		var bottomExtend = window.screen.height - topExtend;
//		var extendH = Math.max(topExtend, bottomExtend) * 2;
//		
//		console.log("extendH = "+extendH);
//		
//		var leftX = hMidX - extendW/2;
//		var topY = hMidY - extendH/2;
//		
//		console.log("leftX = "+leftX);
//		console.log("topY = "+topY);
		
//		holodeck.attr("style", "top: "+topY+"px; left: "+leftX+"px; width: "+extendW+"px; height: "+extendH+"px");
		//holodeck.attr("style", "");
		
		focusView = false;
		api.camera.freeze(false);
	};
	
	handlers.queryViewportSize = function() {
		api.panels.minimap_panel.message('setSize', [window.screen.width, window.screen.height]);
	};
	var oldOnResize = window.onresize;
	window.onresize = function(w) {
		if (typeof oldOnResize === "function") {
			oldOnResize(w);
		}
		
		handlers.queryViewportSize();
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
		
		if (msg.data.client.army_id) {
			api.panels.minimap_panel.message("setMyArmyId", msg.data.client.army_id);
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