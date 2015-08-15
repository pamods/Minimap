(function() {
	var oldLookAt = api.camera.lookAt;
	api.camera.lookAt = function() {
		api.Panel.message("ubermap_panel", "setUberMapVisible", false);
		if (arguments[0]) {
			arguments[0].zoom = "orbital";
		}
		return oldLookAt.apply(this, arguments);
	};
}());