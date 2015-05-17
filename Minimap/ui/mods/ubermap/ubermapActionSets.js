(function() {
	var kb = function(name, set, def) {
		action_sets[set][name] = function () {
			if (model[name]) {
				model[name].apply(this, arguments);
			}
		};
		api.settings.definitions.keyboard.settings[name] = {
			title: name.replace(/_/g, ' '),
			type: 'keybind',
			set: set,
			display_group: 'UberMap',
			display_sub_group: 'UberMap',
			default: def || ''
		};
	};
	
	kb('uber_map_toggle_uber_map', 'gameplay', "space");
	
	kb('uber_map_toggle_select_fighters', 'gameplay');
	kb('uber_map_toggle_select_workers', 'gameplay');
	kb('uber_map_toggle_select_all', 'gameplay');
	kb('uber_map_toggle_select_orbital', 'gameplay');
	kb('uber_map_toggle_select_air', 'gameplay');
	kb('uber_map_toggle_select_land', 'gameplay');
	kb('uber_map_toggle_select_navy', 'gameplay');
	kb('uber_map_toggle_select_navy_fighters', 'gameplay');
	kb('uber_map_toggle_select_navy_workers', 'gameplay');
	kb('uber_map_toggle_select_land_fighters', 'gameplay');
	kb('uber_map_toggle_select_land_workers', 'gameplay');
	kb('uber_map_toggle_select_air_fighters', 'gameplay');
	kb('uber_map_toggle_select_air_workers', 'gameplay');
	kb('uber_map_toggle_select_orbital_fighters', 'gameplay');
	kb('uber_map_toggle_select_orbital_workers', 'gameplay');
})();