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
}());
$(document).ready(function() {
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