(function() {
	var oldEngineCall = engine.call;
	engine.call = function() {
		// this is triggered when the user clicks an alert to go there with the camera
		if (arguments && arguments.length && arguments.length > 0 && arguments[0] === "camera.lookAt") {
			api.Panel.message("ubermap_panel", "setUberMapVisible", false);
		}
		return oldEngineCall.apply(this, arguments);
	};
}());