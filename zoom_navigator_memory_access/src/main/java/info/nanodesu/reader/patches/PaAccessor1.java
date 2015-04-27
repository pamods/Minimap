package info.nanodesu.reader.patches;

import info.nanodesu.reader.AbstractPaAccessor;
import info.nanodesu.reader.FullUnitInfo;

import java.util.ArrayList;
import java.util.List;

/*
 * Reminder: The key code part to find and to work from is:
 * nop [rax]
   mov rax,[r15]
   *
   mov rsi,[rdx+r14*8] // RDX here is the base adr of the list of game entities
   *
   mov rax,[rsi]
   mov rcx,rsi
   call qword ptr [rax+30]
   
   rcx is where the unit is. rax+30 has to have a specific value that can be guessed, as it is the one that is used the least when only one unit is visible.
 */

public class PaAccessor1 extends AbstractPaAccessor {
	
	public static class PaAccessor1Constants {
		public long baseAdr;
		public long[] basePointer;
		public long finalBase;
		public long visibilityBit;
		public int classGuessStringLength;
		public long unitBase;
		public long unitStruct;
		public long unitId;
		public long unitRadarPointer;
		public long unitRadar;
		public long unitSpec;
		public long currentHp;
		public long maxHp;
		public long armyId;
		public long x;
		public long y;
		public long z;
		public long planetId;
	}
	
	protected static void l(long x) {
		System.out.println(Long.toHexString(x).toUpperCase());
	}
	
	private PaAccessor1Constants c;
	private long cachedClientUnitClassAdr = -1; 
	
	public PaAccessor1(int pid, PaAccessor1Constants constants) {
		super(pid);
		c = constants;
	}
	
	private long findBaseUnitListPointer() {
		long a = pa.readLong(c.baseAdr);
		for (int i = 0; i < c.basePointer.length; i++) {
			a = pa.readLong(a + c.basePointer[i]);
		}
		return a + c.finalBase;
	}
	
	private long findUnitStartPointer(long listPointer) {
		return pa.readLong(listPointer);
	}
	
	private long findUnitEndPointer(long listPointer) {
		return pa.readLong(listPointer + 0x8);
	}
	
	private boolean isClientUnitClass(long clazzAdr) {
		if (cachedClientUnitClassAdr == -1) {
			String testStr = pa.readAsString(clazzAdr, c.classGuessStringLength);
			if (testStr.contains("ClientUnit") && !testStr.contains("ClientPlanet")) {
				cachedClientUnitClassAdr = clazzAdr;
			}
		}
		
		return clazzAdr == cachedClientUnitClassAdr;
	}
	
	private boolean isInterestingUnit(long unit) {
		return isClientUnitClass(pa.readLong(unit)) && pa.readByte(unit + c.visibilityBit) == 1;
	}
	
	private FullUnitInfo readUnit(long unit) {
		FullUnitInfo inf = new FullUnitInfo();
		long base = pa.readLong(unit + c.unitBase) + c.unitStruct;
		inf.setId(pa.readInt(base + c.unitId));
		if (pa.readByte(pa.readLong(base + c.unitRadarPointer) + c.unitRadar) == 0) {
			inf.setId(inf.getId() + Integer.MIN_VALUE);
			inf.setSpec("unknown");
		} else {
			inf.setSpec(pa.readNullTerminatedString(pa.readLong(base + c.unitSpec)));
			inf.setCurrentHp(pa.readFloat(base + c.currentHp));
			inf.setMaxHp(pa.readFloat(base + c.maxHp));
		}
		inf.setArmy(pa.readInt(base + c.armyId));
		inf.setX(pa.readFloat(base + c.x));
		inf.setY(pa.readFloat(base + c.y));
		inf.setZ(pa.readFloat(base + c.z));
		inf.setPlanetId(pa.readInt(base + c.planetId));
		return inf;
	}
	
	@Override
	public List<FullUnitInfo> readUnitInfos() {
		long base = findBaseUnitListPointer();
		long startUnits = findUnitStartPointer(base);
		long endUnits = findUnitEndPointer(base);
		List<FullUnitInfo> lst = new ArrayList<>();
		for (int i = 0; i + startUnits < endUnits; i+=8) {
			long unit = pa.readLong(startUnits + i);
			if (isInterestingUnit(unit)) {
				lst.add(readUnit(unit));
			}
		}
		return lst;
	}
}