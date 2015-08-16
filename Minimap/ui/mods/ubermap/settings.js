(function() {
	console.log("modify settings for ubermap");
	
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