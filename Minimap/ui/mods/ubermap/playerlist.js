(function() {
	var func = function() {
		if (model.pinPlayerListPanel() || model.pinSpectatorPanel()) {
			api.Panel.message(api.Panel.parentId, 'changeMinimapZ', {z: -9999});
		} else {
			api.Panel.message(api.Panel.parentId, 'changeMinimapZ', {z: 9999});
		}
	};
	model.pinPlayerListPanel.subscribe(func);
	model.pinSpectatorPanel.subscribe(func);
}());