(function() {
	var func = function(v) {
		if (v) {
			api.Panel.message(api.Panel.parentId, 'changeMinimapZ', {z: -9999});
		} else {
			api.Panel.message(api.Panel.parentId, 'changeMinimapZ', {z: 9999});
		}
	};
	model.pinPlayerListPanel.subscribe(func);
}());