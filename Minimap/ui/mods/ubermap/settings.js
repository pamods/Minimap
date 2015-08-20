(function() {
	console.log("modify settings for ubermap");
	
	var dbName = "info.nanodesu.ubermap";
	
	var getMapCache = function() {
		return decode(localStorage[dbName]) || {};
	};
	
	var setMapCache = function(cache) {
		localStorage[dbName] = encode(cache);
	};
	
	model.clearUberMapCache = function() {
		var cache = getMapCache();
		
		_.forEach(cache, function(dbKey) {
			DataUtility.deleteObject(dbName, dbKey).then(function() {
				console.log("deleted", arguments);
			});
		});
		
		setMapCache({});
	};
	
	_.extend(api.settings.definitions.ui.settings, {
        ubermap_enabled: {
            title: 'Ubermap Enabled',
            type: 'select',
            default: 'ON',
            options: ['ON','OFF']
        },
	});
	
    $(".option-list.ui .form-group").append(
        $.ajax({
            type: "GET",
            url: 'coui://ui/mods/ubermap/ubermap_ui_settings.html',
            async: false
        }).responseText
    );
    
    model.settingGroups.notifySubscribers();
})();