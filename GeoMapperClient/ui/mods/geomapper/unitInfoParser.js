var unitInfoParser = 
	(typeof unitInfoParser === "undefined") ?
	(function() {
			var _coherentHost = "coui://";
			var _unitListPath = _coherentHost+"pa/units/unit_list.json";
			
			// function parses all units, following unit bases recursively
			// onComplete is given the finished map of spec => custom piece of data per spec
			// dataGetter gets the data from the unit json, it expects one parameter: the parsed unit json
			// datamerger expected two parameters, the data further up the definition tree of the unit and further down
			// examples see the next 2 functions after this
			var _loadUnitData = function(onComplete, dataGetter, dataMerger) {
			  var resultTypeMapping = {};
			  var spawnedUnitCalls = 0;
			  $.getJSON(_unitListPath, function(data) {
			   var units = data.units;
			   var finishedAll = false;
			   
			   var countDown = function() {
				  spawnedUnitCalls--;
				  if (spawnedUnitCalls === 0) {
					onComplete(resultTypeMapping);
				  }
			   };
			   
			   function readUnitDataFromFile(file, callback) {
				  $.getJSON(file, function(unit) {
					var freshDataFromUnit = dataGetter(unit);
					var baseSpec = unit.base_spec;
					
					if (baseSpec != undefined) {
					  readUnitDataFromFile(_coherentHost+baseSpec, function(unitData) {
						callback(dataMerger(freshDataFromUnit, unitData));
					  });
					} else {
					  if (freshDataFromUnit != undefined) {
						callback(freshDataFromUnit);
					  }
					  countDown();
					}
				  }).fail(function(e) {
					  console.log("PA Stats found an invalid unit json file: "+file+", both PA itself and PA Stats will probably choke and die when such units are build.");
					  countDown();
				  });
				}
				 
				spawnedUnitCalls = units.length;
				function processUnitPath(unitPath) {
				  readUnitDataFromFile(_coherentHost+unitPath, function(unitData) {
					resultTypeMapping[unitPath] = unitData;
				  });
				}
				for (var i = 0; i < units.length; i++) {
				  processUnitPath(units[i]);
				}
			  });
			};
			
			// load an array with a list of all known unittypes. duplicates are filtered out
			var _loadUnitTypesArray = function(onComplete) {
				loadUnitTypeMapping(function(mapping) {
				var types = [];
				for (unit in mapping) {
				  types = types.concat(mapping[unit]);
				}
				types = types.filter(function(elem, pos) {
				  return types.indexOf(elem) == pos;
				});
				onComplete(types);
			  });
			};
			
			//creates a map of all unit specs to their display name
			var _loadUnitNamesMapping = function(onComplete) {
			  _loadUnitData(onComplete, function(unit) {
				return unit.display_name;
			  }, function (dataUpTheTree, dataDownTheTree) {
				return dataUpTheTree; // first name encountered is used
			  });
			};
			
			//creates a map of all unit spec to an array of their type
			var _loadUnitTypeMapping = function(onComplete) {
			  _loadUnitData(onComplete, function(unit) {
				var unitTypes = unit.unit_types;
				if (unitTypes != undefined) {
				  for (var u = 0; u < unitTypes.length; u++) {
					unitTypes[u] = unitTypes[u].replace("UNITTYPE_", "");
				  }
				}
				return unitTypes;
			  }, function(dataUpTheTree, dataDownTheTree) {
				if (dataUpTheTree === undefined) {
				  dataUpTheTree = [];
				}
				if (dataDownTheTree === undefined) {
				  dataDownTheTree = [];
				}
				return dataUpTheTree.concat(dataDownTheTree);
			  });
			};
			
			return {
				loadUnitData: _loadUnitData,
				loadUnitTypesArray: _loadUnitTypesArray,
				loadUnitNamesMapping: _loadUnitNamesMapping,
				loadUnitTypeMapping: _loadUnitTypeMapping
			};
		}()) : unitInfoParser;