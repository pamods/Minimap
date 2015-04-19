console.log("loaded ubermap.js");

ko.bindingHandlers.datum = {
	update : function(element, valueAccessor, allBindings, viewModel, bindingContext) {
		value = ko.unwrap(valueAccessor());
		/*
		if (typeof value === "function") {
			value = value();
		}
		element['__data__'] = value;
		*/
		d3.select(element).datum(value);
	}
};

ko.bindingHandlers.d = {
	update : function(element, valueAccessor, allBindings, viewModel, bindingContext) {
		value = ko.unwrap(valueAccessor());
		d3.select(element).attr('d', value);
	}
};

ko.bindingHandlers.svguse = {
	update : function(element, valueAccessor, allBindings, viewModel, bindingContext) {
		value = ko.unwrap(valueAccessor());
		d3.select(element).attr('xlink:href', '#'+value);
	}
};

ko.bindingHandlers.id = {
	update : function(element, valueAccessor, allBindings, viewModel, bindingContext) {
		value = ko.unwrap(valueAccessor());
		d3.select(element).attr('xlink:href', '#'+value);
	}
};


var model = undefined;
var handlers = {};

loadScript("coui://ui/mods/minimap/unitInfoParser.js");
loadScript("coui://ui/mods/minimap/alertsManager.js");

$(document).ready(function() {
	
	var appendLayoutFields = function(self) {
		self.minimapsBottomMargin = ko.observable(300);
		self.minimapAreaWidth = ko.observable(400);
		self.mapSidesRatio = ko.observable(1.5); 
		// height = width / sidesRatio
		self.minimapWidthBig = ko.observable(400);
		self.minimapWidthMedium = ko.observable(200);
		self.minimapWidthSmall = ko.observable(133);
		self.minimapUbermapGap = ko.observable(5);
		self.ubermapTop = ko.observable(80);
		self.ubermapBottomGap = ko.observable(160);

		self.parentWidth = ko.observable(0);
		self.parentHeight = ko.observable(0);
		self.minimapHeightBig = ko.computed(function() {
			return self.minimapWidthBig() / self.mapSidesRatio();
		});
		self.minimapHeightMedium = ko.computed(function() {
			return self.minimapWidthMedium() / self.mapSidesRatio();
		});
		self.minimapHeightSmall = ko.computed(function() {
			return self.minimapWidthSmall() / self.mapSidesRatio();
		});
		
		self.maxPlanetsForBig = ko.computed(function() {
			var maxHeight = self.parentHeight() - self.minimapsBottomMargin();
			return Math.floor(maxHeight / self.minimapHeightBig()) * (self.minimapAreaWidth() / self.minimapWidthBig());
		});
		self.maxPlanetsForMedium = ko.computed(function() {
			var maxHeight = self.parentHeight() - self.minimapsBottomMargin();
			return Math.floor(maxHeight / self.minimapHeightMedium()) * (self.minimapAreaWidth() / self.minimapWidthMedium());
		});

		self.minimapWidth = ko.computed(function() {
			if (self.planetCount() <= self.maxPlanetsForBig()) {
				return self.minimapWidthBig();
			} else if (self.planetCount() <= self.maxPlanetsForMedium()) {
				return self.minimapWidthMedium();
			} else {
				return self.minimapWidthSmall();
			}
		});
		
		self.minimapHeight = ko.computed(function() {
			if (self.planetCount() <= self.maxPlanetsForBig()) {
				return self.minimapHeightBig();
			} else if (self.planetCount() <= self.maxPlanetsForMedium()) {
				return self.minimapHeightMedium();
			} else {
				return self.minimapHeightSmall();
			}
		});
		
		self.optimalUberMapWidth = ko.computed(function() {
			return self.parentWidth() - self.minimapAreaWidth() - self.minimapUbermapGap();
		});
		
		self.optimalUberMapHeight = ko.computed(function() {
			return self.parentHeight() - self.ubermapTop() - self.ubermapBottomGap();
		});
		
		self.uberMapWidthDedicatesHeight = ko.computed(function() {
			var widthForHeight = self.optimalUberMapHeight() * self.mapSidesRatio();
			return widthForHeight > self.optimalUberMapWidth();
		});
		
		self.uberMapWidth = ko.computed(function() {
			return Math.floor(self.uberMapWidthDedicatesHeight() ? self.optimalUberMapWidth() : self.optimalUberMapHeight() * self.mapSidesRatio()); 
		});
		
		self.uberMapHeight = ko.computed(function() {
			return Math.floor(self.uberMapWidthDedicatesHeight() ? self.optimalUberMapWidth() / self.mapSidesRatio() : self.optimalUberMapHeight());
		});
		
		self.bodyWidth = ko.computed(function() {
			return self.minimapAreaWidth() + self.minimapUbermapGap() + self.uberMapWidth();
		});
		
		self.bodyHeight = ko.computed(function() {
			return self.ubermapTop() + self.uberMapHeight();
		});
	};
	
	function MiniMapModel(p, scene) {
		var self = this;
		self.width = scene.minimapWidth;
		self.height = scene.minimapHeight;
		self.planet = ko.observable(p);
		self.dead = ko.computed(function() {
			return self.planet().dead;
		});
		self.name = ko.computed(function() {
			return self.planet().name;
		});
		self.mappingObject = ko.computed(function() {
			var result = {
				id: "p-id-"+self.planet().id,
				name: self.name(),
			};
			if (scene.mappingData() !== undefined) {
				var ps = scene.mappingData().planets;
				for (var i = 0; i < ps.length; i++) {
					if (ps[i].name === self.name()) {
						result = ps;
						break;
					}
				}
			}
			return result;
		});
		
		self.graticule = ko.computed(function() {
			return d3.geo.graticule();
		});
		
		// rotation is only possible in the x-axis, so north always points up
		self.rotationX = ko.observable(0);
		self.rotation = ko.computed(function() {
			return [self.rotationX(), 0];
		});
		
		self.projection = ko.computed(function() {
			var w = self.width();
			var h = self.height();
			// TODO this currently is fixed onto one projection. I am not yet sure if I want the options for more back.
			return d3.geo.winkel3().scale(39*(w/200)).translate([w/2, h/2]).precision(.1);
		});
		
		var thePath = d3.geo.path();
		self.path = ko.computed(function() {
			self.projection().rotate(self.rotation());
			thePath.projection(self.projection());
			return thePath;
		});
		
		
		console.log("created minimap: "+p.name);
	}
	
	function SceneModel() {
		var self = this;
		
		self.mappingData = ko.observable();
		
		self.planets = ko.observable([]);
		self.planetCount = ko.computed(function() {
			return self.planets().length;
		});
		
		self.minimaps = ko.observableArray([]);
		
		appendLayoutFields(self);
		
		self.updateMinimaps = function() {
			var foundPlanets = [];
			for (var i = 0; i < self.minimaps().length; i++) {
				for (var j = 0; j < self.planets().length; j++) {
					if (self.planets()[j].name === self.minimaps()[i].name()) {
						foundPlanets.push(j);
						self.minimaps()[i].planet(self.planets()[j]);
						found = true;
						break;
					}
				}
			}
			for (var i = 0; i < self.planets().length; i++) {
				if (foundPlanets.indexOf(i) === -1) {
					var map = new MiniMapModel(self.planets()[i], self);
					self.minimaps.push(map);
				}
			}
		};
		self.planets.subscribe(self.updateMinimaps);
		
		self.loadMappingData = function(payload) {
			var mapList = decode(localStorage["info.nanodesu.minimapkeys"]) || {};
			var dbName = "info.nanodesu.info.minimaps";
			
			if (mapList[payload.name]) {
				console.log("found minimap data in indexdb, will load key "+mapList[payload.name]);
				DataUtility.readObject(dbName, mapList[payload.name]).then(function(data) {
					console.log(data);
					//initBySystem(data);
					//processRemovals(payload);
				});
			} else if (mapData) {
				console.log("found minimap data in systems.js");
				console.log(mapData);
				//initBySystem(mapData);
			} else {
				console.log("No minimap data available for map with name "+payload.name);
			}
		};
	}
	
	model = new SceneModel();
	
	handlers.celestial_data = function(payload) {
		console.log(payload);
		model.planets(payload.planets);
		model.loadMappingData(payload);
	};
	
	handlers.setSize = function(size) {
		model.parentWidth(size[0]);
		model.parentHeight(size[1]);
	};
	
	app.registerWithCoherent(model, handlers);
	ko.applyBindings(model);
	
	setTimeout(function() {
		api.Panel.message(api.Panel.parentId, 'queryViewportSize');
	}, 500);
});