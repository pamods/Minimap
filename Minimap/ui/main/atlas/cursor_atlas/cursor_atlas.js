var model;
var handlers;

console.log("cursor_atlas.js loaded");

$(document).ready(function() {
	var defaultIcon = "coui://ui/main/game/live_game/img/cursors/cursor.png";
	function CursorAtlasViewModel() {
		var self = this;
		
		var defImg = $('#default-cursor-img');
		
		var curIcon = defaultIcon;
		
		self.setDefaultIcon = function(icon) {
			if (icon != curIcon) {
				curIcon = icon;
				defImg.attr('xlink:href', icon);
			}
		};
	}
	model = new CursorAtlasViewModel();
	handlers = {};
	
	var keyDefIcons = "info.nanodesu.defaultIconKey";
	
	if (!localStorage[keyDefIcons]) {
		localStorage[keyDefIcons] = defaultIcon;
	}
	
	setInterval(function() {
		model.setDefaultIcon(localStorage[keyDefIcons]);
	}, 250);
	
	if (scene_mod_list['cursor_atlas'])
		loadMods(scene_mod_list['cursor_atlas']);

	// setup send/recv messages and signals
	app.registerWithCoherent(model, handlers);

	// Activates knockout.js
	ko.applyBindings(model);
});
