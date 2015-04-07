package info.nanodesu.reader;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class PaUnitsChangeDetector {

	private PaClientMemoryAccessor pa;
	
	private Map<Integer, FullUnitInfo> unitsMap;
		
	public PaUnitsChangeDetector(PaClientMemoryAccessor acc) {
		this.pa = acc;
		this.unitsMap = new HashMap<>();
	}
	
	private boolean positionChangeIsRelevant(FullUnitInfo newUnit, float minPositionChange) {
		FullUnitInfo oldUnit = unitsMap.get(newUnit.getId());
		float dx = newUnit.getX() - oldUnit.getX();
		float dy = newUnit.getY() - oldUnit.getY();
		float dz = newUnit.getZ() - oldUnit.getZ();
		
		float distSq = dx*dx + dy*dy + dz*dz;
		return distSq >= minPositionChange * minPositionChange;
	}
	
	private boolean hpChangeIsRelevant(FullUnitInfo newUnit) {
		return Math.abs(newUnit.getCurrentHp() - unitsMap.get(newUnit.getId()).getCurrentHp()) >= 1;
	}
	
	public PaUnitInfoUpdate generateUpdate(long lastUpdateId, float minPositionChange) {
		PaUnitInfoUpdate update = new PaUnitInfoUpdate();
		
		pa.attach();
		List<FullUnitInfo> units = null;
		try {
			units = pa.readUnitInfos();
		} finally {
			pa.detach();
		}
		
		if (update.getUpdateId() - lastUpdateId > 1) {
			System.out.println("received a bad update id " + update.getUpdateId() + " vs " + lastUpdateId + ". Will send a reset update!");
			unitsMap.clear();
			update.setReset(true);
		}
		
		Map<Integer, FullUnitInfo> newKnownUnits = new HashMap<>();
		
		for (FullUnitInfo unit: units) {
			if (!unitsMap.containsKey(unit.getId())) {
				update.getAddedUnits().add(unit);
			} else if (positionChangeIsRelevant(unit, minPositionChange) || hpChangeIsRelevant(unit)) {
				UnitUpdate unitUpdate = new UnitUpdate();
				unitUpdate.setId(unit.getId());
				unitUpdate.setX(unit.getX());
				unitUpdate.setY(unit.getY());
				unitUpdate.setZ(unit.getZ());
				unitUpdate.setCurrentHp(unit.getCurrentHp());
				update.getUpdatedUnits().add(unitUpdate);
			}
			newKnownUnits.put(unit.getId(), unit);
		}
		
		for (Integer oldUnit: unitsMap.keySet()) {
			if (!newKnownUnits.containsKey(oldUnit)) {
				update.getRemovedUnits().add(oldUnit);
			}
		}
		
		unitsMap = newKnownUnits;
		
		return update;
	}
}
