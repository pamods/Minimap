package info.nanodesu.reader;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class PaUnitsChangeDetector {

	private PaClientMemoryAccessor pa;
	
	private Map<Integer, FullUnitInfo> unitsMap;
	private Map<Integer, UnitCommand> commandsMap;	
	
	public PaUnitsChangeDetector(PaClientMemoryAccessor acc) {
		this.pa = acc;
		this.unitsMap = new HashMap<>();
		this.commandsMap= new HashMap<>();
	}
	
	private boolean positionChangeIsRelevant(FullUnitInfo newUnit, float minPositionChange) {
		FullUnitInfo oldUnit = unitsMap.get(newUnit.getId());
		if (newUnit.getPlanetId() != oldUnit.getPlanetId()) {
			return true;
		} else {
			float dx = newUnit.getX() - oldUnit.getX();
			float dy = newUnit.getY() - oldUnit.getY();
			float dz = newUnit.getZ() - oldUnit.getZ();
			
			float distSq = dx*dx + dy*dy + dz*dz;
			return distSq >= minPositionChange * minPositionChange;
		}
	}
	
	private boolean hpChangeIsRelevant(FullUnitInfo newUnit) {
		return Math.abs(newUnit.getCurrentHp() - unitsMap.get(newUnit.getId()).getCurrentHp()) >= 1;
	}
	
	private boolean commandsChanged(FullUnitInfo newUnit) {
		return !newUnit.getCommandIds().equals(unitsMap.get(newUnit.getId()).getCommandIds());
	}
	
	public PaUnitInfoUpdate generateUpdate(long lastUpdateId, float minPositionChange) {
		PaUnitInfoUpdate update = new PaUnitInfoUpdate();

		List<FullUnitInfo> units = null;
		List<UnitCommand> cmds = null;
		synchronized (pa) {
			pa.attach();
			try {
				UnitInfoReadResult r = pa.readUnitInfos();
				units = r.unitInfos;
				cmds = r.commands;
			} finally {
				pa.detach();
			}
		}
		
		if (update.getUpdateId() - lastUpdateId > 1) {
			System.out.println("received a bad update id " + update.getUpdateId() + " vs " + lastUpdateId + ". Will send a reset update!");
			unitsMap.clear();
			commandsMap.clear();
			update.setReset(true);
		}
		
		Map<Integer, FullUnitInfo> newKnownUnits = new HashMap<>();
		
		for (FullUnitInfo unit: units) {
			boolean knownUnit = unitsMap.containsKey(unit.getId());
			boolean newCommands = knownUnit && commandsChanged(unit);
			if (!knownUnit) {
				update.getAddedUnits().add(unit);
			} else if (positionChangeIsRelevant(unit, minPositionChange) || hpChangeIsRelevant(unit) || newCommands) {
				UnitUpdate unitUpdate = new UnitUpdate();
				unitUpdate.setId(unit.getId());
				unitUpdate.setX(unit.getX());
				unitUpdate.setY(unit.getY());
				unitUpdate.setZ(unit.getZ());
				unitUpdate.setCurrentHp(unit.getCurrentHp());
				unitUpdate.setPlanetId(unit.getPlanetId());
				if (newCommands) {
					unitUpdate.setNewCommandIds(unit.getCommandIds());
				} else {
					unitUpdate.setNewCommandIds(null);
				}
				update.getUpdatedUnits().add(unitUpdate);
			} else {
				// if the unit position is not changed enough to be notified to the client, keep the last position that the client was told for the next time
				FullUnitInfo oldUnit = unitsMap.get(unit.getId());
				unit.setX(oldUnit.getX());
				unit.setY(oldUnit.getY());
				unit.setZ(oldUnit.getZ());
				unit.setCurrentHp(oldUnit.getCurrentHp());
			}
			newKnownUnits.put(unit.getId(), unit);
		}
		
		for (Integer oldUnit: unitsMap.keySet()) {
			if (!newKnownUnits.containsKey(oldUnit)) {
				update.getRemovedUnits().add(oldUnit);
			}
		}
		
		unitsMap = newKnownUnits;
		
		Map<Integer, UnitCommand> newKnownCommands = new HashMap<>();
		for (UnitCommand cmd: cmds) {
			if (!commandsMap.containsKey(cmd.getId())) {
				update.getAddedCommands().add(cmd);
			} // commmands never changed. They are only created and removed
			
			newKnownCommands.put(cmd.getId(), cmd);
		}
		
		for (Integer oldCmd: commandsMap.keySet()) {
			if (!newKnownCommands.containsKey(oldCmd)) {
				update.getRemovedCommands().add(oldCmd);
			}
		}
		
		commandsMap = newKnownCommands;
		
		return update;
	}
}
