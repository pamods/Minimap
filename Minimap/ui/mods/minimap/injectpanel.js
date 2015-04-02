console.log("inject minimap");
(function() {
	

	/*
	var lastWheelMove = 0;
	$(window).bind('mousewheel DOMMouseScroll', function(event){
		lastWheelMove = new Date().getTime();
	});*/
	
	var holodeck = $('.primary');
	var hMidX = 0;
	var hMidY = 0;
	var hx = 0;
	var hy = 0;
	var w = 100;
	var h = 100;
	handlers.focusMainViewHack = function(params) {
		return;
		var x = params[0];
		var y = params[1];
		var leftX = x - w/2;
		var topY = y - h/2;
		hx = leftX;
		hy = topY;
		hMidX = x;
		hMidY = y;
		holodeck.attr("style", "top: "+topY+"px; left: "+leftX+"px; width: "+w+"px; height: "+h+"px");
		
		if (params[2]/* && (new Date().getTime() - lastWheelMove > 1000)*/) {
			api.camera.lookAt({
				location: {
					x: params[2][0],
					y: params[2][1],
					z: params[2][2],
				},
				planet_id: params[2][3],
				zoom: 'invalid' // by pure chance I found that when I pass in an unknown string it just keeps the current zoom level. YEY that is what I wanted to do.
			});
			api.camera.alignToPole();
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
//		holodeck.attr("style", "");
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