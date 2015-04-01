package info.nanodesu.reader;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import com.sun.jna.ptr.IntByReference;

import info.nanodesu.lib.MemoryAPI;

public class UnitsReader {
	
	public static class Unit {
		public float x;
		public float y;
		public float z;
		public int id;
		public String planet;
		@Override
		public String toString() {
			return "Unit [x=" + x + ", y=" + y + ", z=" + z + ", id=" + id
					+ "]";
		}
	}
	
	public static void main(String[] args) {
		int startAdr = 0x2B5FE38;
		int pid = 10008;
		
		UnitsReader reader = new UnitsReader(startAdr);
		try {
			if (reader.open(pid)) {
				System.out.println(reader.getUnitsMap());
			} else {
				System.out.println("could not open server process with pid " + pid);
			}
		} finally {
			reader.close();
		}
	}
	
	public boolean log = true;
	private int rootAddress;
	
	private MemoryAPI mem = new MemoryAPI();

	public UnitsReader(int b) {
		rootAddress = b + 0x8;
	}
	
	private void logValue(String name, int val) {
		if (log) {
			System.out.println(name + " = 0x" + Integer.toHexString(val).toUpperCase());
		}
	}
	
	private void logValue(String name, String val) {
		if (log) {
			System.out.println(name + " = " + val);
		}
	}
	
	public boolean open(int pid) {
		return mem.openProcessByPid(new IntByReference(pid));
	}
	
	public void close() {
		mem.close();
	}
	
	public Map<Integer, Unit> getUnitsMap() {
		int[] borders = getPointerPlanetListBorders();
		int pStart = borders[0];
		int pStop = borders[1];
		
		Map<Integer, Unit> map = new HashMap<>();
		
		do {
			logValue("====== planet for", pStart);
			int planetRef = mem.readInt(pStart);
			logValue("planetRef", planetRef);
			
			int nameStringStart = mem.readInt(planetRef + 0x30);
			
			String pName = mem.readNullTerminatedString(nameStringStart);
			
			logValue("name", pName);

			int unitsRef = mem.readInt(planetRef + 0x40);
			logValue("unitsRef", unitsRef);
			
			for (Unit unit: getUnitsForPlanet(unitsRef)) {
				unit.planet = pName;
				map.put(unit.id, unit);
			}
			
			pStart += 0x8;
		} while (pStart != pStop);
		
		return map;
	}
	
	private int[] getPointerPlanetListBorders() {
		int rcx4 = mem.readInt(rootAddress);
		logValue("rcx4", rcx4);
		
		int r12 = mem.readInt(rcx4 + 0x1D8);
		logValue("r12", r12);
		
		int rdi2 = mem.readInt(r12 + 0x120);
		int rsi2 = mem.readInt(r12 + 0x128);
		
		logValue("rdi2", rdi2);
		logValue("rsi2", rsi2);
		
		return new int[]{rdi2, rsi2};
	}
	
	private List<Unit> getUnitsForPlanet(int adr) {
		int unitListAdr = adr + 0x9B0;
		
		int unitListHolder = mem.readInt(unitListAdr);
		
		logValue("unitListAdr2", unitListHolder);
		int i = 0;
		
		int firstUnit = mem.readInt(unitListHolder);
		int nextUnit = mem.readInt(unitListHolder);
		
		List<Unit> units = new ArrayList<>();
		
		if (unitListHolder != firstUnit) {
			do {
				logValue("a unit", nextUnit);
				i++;
				if (i > 25000) {
					System.out.println("FAIL: more than 25k units seems unrealistic?!");
					break;
				}
				units.add(getUnitData(nextUnit));
				nextUnit = mem.readInt(nextUnit);
			} while(firstUnit != nextUnit && nextUnit != unitListHolder);
		}
		logValue("units found", ""+i);
		return units;
	}
	
	private Unit getUnitData(int adr) {
		Unit u = new Unit();
		int physicsEntity = mem.readInt(adr + 0x18);
		u.x = mem.readFloat(physicsEntity + 4);
		u.y = mem.readFloat(physicsEntity + 8);
		u.z = mem.readFloat(physicsEntity + 12);
		u.id = mem.readInt(adr+0x10);
		return u;
	}
}
