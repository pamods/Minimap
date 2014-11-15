landing.js around line 95 to make the server show all spawns to all players, instead of the while loop

    _.forEach(zones, function (zone) {
		_.forEach(zone.positions, function(spawn) {
				_.forEach(armies, function (army) {
                army.zones.push({
                    position: spawn,
                    planet_index: zone.planet_index,
                    radius: zone.radius
                });
            });
		});
    });
