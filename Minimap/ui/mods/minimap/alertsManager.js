console.log("load alertsManager");
var alertsManager =
	(typeof alertsManager === 'undefined') ? 
	(function(){
			function contains(ar, val) {
				return ar !== undefined && $.inArray(val, ar) !== -1;
			}
		
			// currently this internally asks for all created and destroyed events
		    // this may change in the future
		
			// damage alerts trigger whenever health changes, even when it goes up.
		  	// so this is kind of useless, thus no support for them is implemented
		  	// that means: only the commander damage alert will trigger by default
		  	// I am also concerned about the amount of damaged alerts that could be triggered
		// sight buggy, changing it kills enemy located messages
		  	var _hookIntoAlerts = ['watchlist.setCreationAlertTypes', 'watchlist.setDeathAlertTypes', 'watchlist.setSightAlertTypes', 'watchlist.setTargetDestroyedAlertTypes'/*, 'watchlist.setDamageAlertTypes'*/];
		  	var _allAlertsTypes = ['Mobile', 'Structure', 'Recon'];

			var _watchTypes = {
				CREATED: 0,
				DAMAGED: 1,
				DESTROYED: 2,
				PING: 3,
				SIGHT: 4,
				PROJECTILE: 5,
				FIRST_CONTACT: 6,
				TARGET_DESTROYED: 7,
				ALLIED_DEATH: 8
			};
			
			var _makeEmptyFilterSettings = function() {
				return {selectedTypes: {}, excludedTypes: {}, includedUnits: {}, excludedUnits: {}};
			};
			
			var _defaultFilterSettings = _makeEmptyFilterSettings();
			_defaultFilterSettings.selectedTypes[_watchTypes.CREATED] = ['Factory', 'Recon', 'Important'];
			
			_defaultFilterSettings.selectedTypes[_watchTypes.DAMAGED] = ['Commander'];
			
			_defaultFilterSettings.selectedTypes[_watchTypes.DESTROYED] = ['Factory', 'Commander', 'Recon', 'Important'];
			_defaultFilterSettings.excludedTypes[_watchTypes.DESTROYED] = ['Wall'];
			
			_defaultFilterSettings.selectedTypes[_watchTypes.SIGHT] = ['Factory', 'Commander', 'Recon', 'Important'];
			_defaultFilterSettings.excludedTypes[_watchTypes.SIGHT] = ['Wall'];
			
			_defaultFilterSettings.selectedTypes[_watchTypes.TARGET_DESTROYED] = ['Factory', 'Commander', 'Recon', 'Important'];
			_defaultFilterSettings.excludedTypes[_watchTypes.TARGET_DESTROYED] = ['Wall'];
			
			_defaultFilterSettings.selectedTypes[_watchTypes.ALLIED_DEATH] = ['Factory', 'Commander', 'Recon', 'Important'];
			_defaultFilterSettings.excludedTypes[_watchTypes.ALLIED_DEATH] = ['Wall'];
			
			// includedUnits and excludedUnits are not used by the default settings
			
			var _unitSpecMapping = undefined;
			unitInfoParser.loadUnitTypeMapping(function(mapping) {
				_unitSpecMapping = mapping;
			});
			
			var _seenArmyIds = {};
			
			var _listenerCounter = 0;
			var _listeners = {};
			var _watchListHandler = function(payload) {
				for (var i = 0; i < payload.list.length; i++) {
					var alert = payload.list[i];
					if (alert.watch_type === _watchTypes.SIGHT && _seenArmyIds[alert.army_id] === undefined && _unitSpecMapping) {
						_seenArmyIds[alert.army_id] = true;
						var unitTypeBySpec = _unitSpecMapping[alert.spec_id];
						var selTypes = _defaultFilterSettings.selectedTypes[_watchTypes.SIGHT];
						var isPartOfSight = false;
						for (var n = 0; n < selTypes.length; n++) {
							if (contains(unitTypeBySpec, selTypes[n])) {
								isPartOfSight = true;
							}
						}
						if (!isPartOfSight) {
							alert.watch_type = _watchTypes.FIRST_CONTACT;
						}
					}
				}
				
				for (listener in _listeners) {
					if (_listeners.hasOwnProperty(listener)) {
						var copy = {};
						$.extend(true, copy, payload);
						_listeners[listener](copy);
					}
				}
			};
			
			var _addListener = function(listener) {
				_listenerCounter += 1;
				var cnt = _listenerCounter;
				_listeners[cnt] = listener;
				return function() {
					delete _listeners[cnt];
				};
			};
			
			// make a filter function by the given settings object
			// the settings object should have the following properties:
			// selectedTypes, includedUnits, excludedUnits
			// each of these should have a property with the watch_type key (see the enums at the top of the file)
			// this property should be an array with either the type or the unit spec-id
			// if there is no mapping for a watch type it will not be filtered at all
			var _makeFilterBy = function(settings) {
				return function(payload) {
					var selectedTypes = settings.selectedTypes;
					var excludedTypes = settings.excludedTypes;
					var includedUnits = settings.includedUnits;
					var excludedUnits = settings.excludedUnits;
					
					function shouldBeRetained(notice) {
						var wt = notice.watch_type;
						// prevent killing yet unknown alert types or types we do not handle, like i.e. projectile or ping
						if (wt !== _watchTypes.CREATED && 
								wt !== _watchTypes.DAMAGED && 
								wt !== _watchTypes.DESTROYED &&
								wt !== _watchTypes.SIGHT && 
								wt !== _watchTypes.TARGET_DESTROYED &&
								wt !== _watchTypes.ALLIED_DEATH) {
							return true;
						}
						var checkTypes = selectedTypes[wt] || [];
						var exTypes = excludedTypes[wt] || [];
						var includeSpecs = includedUnits[wt] || [];
						var excludeSpecs = excludedUnits[wt] || [];
						
						if (contains(includeSpecs, notice.spec_id)) {
							return true;
						} else if (contains(excludeSpecs, notice.spec_id)) {
							return false;
						} else {
							var unitTypeBySpec = _unitSpecMapping[notice.spec_id];
							
							// units not in the unit_list, this can happen when other mods are involved
							if (unitTypeBySpec === undefined) { 
								return true;
							}
							
							for (var i = 0; i < exTypes.length; i++) {
								if (contains(unitTypeBySpec, exTypes[i])) {
									return false;
								}
							}
							for (var n = 0; n < checkTypes.length; n++) {
								if (contains(unitTypeBySpec, checkTypes[n])) {
									return true;
								}
							}
							return false; // nothing matched
						}
					}
					payload.list = payload.list.filter(shouldBeRetained);
					return payload;
				};
			};
			
			var _addFilteredListener = function(listener, filterSettings) {
				var filter = _makeFilterBy(filterSettings);
				var actualListener = function(payload) {
					var filtered = filter(payload);
					if (filtered.list.length > 0) {
						listener(filtered);
					}
				};
				return _addListener(actualListener);
			};
			
			var _displayHandler = undefined;
			var _removeDisplayListener = undefined;
			
			var _initHook = function() {
				function listenToAllAlerts() {
					for (var i = 0; i < _hookIntoAlerts.length; i++) {
//						console.log("engine.call('"+_hookIntoAlerts[i]+"', '"+JSON.stringify(_allAlertsTypes)+"', '"+JSON.stringify([])+"');");
						engine.call(_hookIntoAlerts[i], JSON.stringify(_allAlertsTypes), JSON.stringify([])); // I am assuming the 2nd on is an exclusion, tests need to validate it. If yes it should be used, too
					 }
				}
				for (var i = 0; i < 9; i+=2) {
					window.setTimeout(listenToAllAlerts, i*1000);					
				}
				   
				_displayHandler = handlers.watch_list;
				if (_displayHandler !== undefined) {
					_removeDisplayListener = _addFilteredListener(_displayHandler, _defaultFilterSettings);					
				} else {
					_removeDisplayListener = function() {};
				}
				
				handlers.watch_list = function(payload) {
					_watchListHandler(payload);
				};
			};
			
			var _getDisplayListener = function() {
				return _displayHandler;
			};
			
			var _replaceDisplayFilter = function(settings) {
				_removeDisplayListener();
				if (_displayHandler !== undefined) {
					_removeDisplayListener = _addFilteredListener(_displayHandler, settings);					
				} else {
					_removeDisplayListener = function() {};
				}
			};
			
			_initHook();
			
			return {
				// add a listener method to the alertsManager
				// this add method returns a function that, when called, removes the added listener from the manager
				// expects a settings to filter for types with specific unit inclusions and exclusions
				addFilteredListener: _addFilteredListener,
				// add a listener that listens for all events.
				// this is the same as calling addFilteredListener with filter settings that accept the types Mobile and Structure for all alerts
				addListener: function(listener) {
					var settings = _makeEmptyFilterSettings();
					for (typ in _watchTypes) {
						if (_watchTypes.hasOwnProperty(typ)) {
							settings.selectedTypes[_watchTypes[typ]] = _allAlertsTypes;
						}
					}
					_addFilteredListener(listener, settings);
				},
				// return the orginal handler of the watch_list even in PA
				getDisplayListener: _getDisplayListener,
				// creates a filter from settings
				makeDisplayFilterForSettings: _makeFilterBy,
				makeEmptyFilterSettings: _makeEmptyFilterSettings,
				// pass an object with filter settings to use a default filter for types/unit inclusions/exclusions
				replaceDisplayFilter: _replaceDisplayFilter,
				// "constants" you can use instead of magic numbers
				WATCH_TYPES: _watchTypes
			};
		}()) : alertsManager;