package info.nanodesu.reader.patches;

import info.nanodesu.reader.AbstractPaAccessor;
import info.nanodesu.reader.FullUnitInfo;
import info.nanodesu.reader.FeatureLocation;

import java.util.ArrayList;
import java.util.Collections;
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
		public long unitX;
		public long unitY;
		public long unitZ;
		public long planetId;
		public String clientUnitClassInclude;
		public String clientUnitsClassExclude;
		
		public boolean supportsFeatureQueries = false;
		public long featureBase;
		public long featureObjectBase;
		public long featureSpecString;
		public long featurePlanet;
		public long featureX;
		public long featureY;
		public long featureZ;
		public String featureSpecStringBase;
		public String featureClassInclude;
		public String featureClassExclude;
	}
	
	protected static void l(long x) {
		System.out.println(Long.toHexString(x).toUpperCase());
	}
	
	private PaAccessor1Constants c;
	private long cachedClientUnitClassAdr = -1; 
	private long cachedMexClassAdr = -1;
	
	public PaAccessor1(int pid, PaAccessor1Constants constants) {
		super(pid);
		c = constants;
	}
	
	private long findBaseUnitListPointer() {
		long a = pa.readLong(c.baseAdr);
		for (int i = 0; i < c.basePointer.length; i++) {
			a = pa.readLong(a + c.basePointer[i]);
		}
		a =  a + c.finalBase;
		return a;
	}
	
	private long findUnitStartPointer(long listPointer) {
		return pa.readLong(listPointer);
	}
	
	private long findUnitEndPointer(long listPointer) {
		return pa.readLong(listPointer + 0x8);
	}
	
	private boolean isClassByString(long clazzAdr, String containString, String disallowString) {
		if (clazzAdr != 0) {
			String testStr = pa.readAsString(clazzAdr, c.classGuessStringLength);
			return testStr != null && (containString == null || testStr.contains(containString)) && (disallowString == null || !testStr.contains(disallowString));
		} else {
			return false;
		}
	}
	
	private boolean isClientUnitClass(long clazzAdr) {
		if (cachedClientUnitClassAdr == -1 && isClassByString(clazzAdr, c.clientUnitClassInclude, c.clientUnitsClassExclude)) {
			cachedClientUnitClassAdr = clazzAdr;
		}
		return clazzAdr == cachedClientUnitClassAdr;
	}
	
	private boolean isMexClass(long clazzAdr) {
		if (cachedMexClassAdr == -1 && isClassByString(clazzAdr, c.featureClassInclude, null)) {
			cachedMexClassAdr = clazzAdr;
		}
		return clazzAdr == cachedMexClassAdr;
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
		inf.setX(pa.readFloat(base + c.unitX));
		inf.setY(pa.readFloat(base + c.unitY));
		inf.setZ(pa.readFloat(base + c.unitZ));
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

	@Override
	public List<FeatureLocation> readFeatureLocations(String featureKey) {
		if (c.supportsFeatureQueries) {
			long base = findBaseUnitListPointer();
			long startUnits = findUnitStartPointer(base);
			long endUnits = findUnitEndPointer(base);
			List<FeatureLocation> lst = new ArrayList<>();
			
			for (int i = 0; i + startUnits < endUnits; i+=8) {
				long unit = pa.readLong(startUnits + i);
				if (isMexClass(pa.readLong(unit))) {
					long b = pa.readLong(unit + c.featureBase);
					long b1 = pa.readLong(b + c.featureObjectBase);
					String fK = pa.readNullTerminatedString(pa.readLong(b1 + c.featureSpecString));
					if ((c.featureSpecStringBase + featureKey).equals(fK)) {
						FeatureLocation loc = new FeatureLocation();
						loc.setX(pa.readFloat(b1 + c.featureX));
						loc.setY(pa.readFloat(b1 + c.featureY));
						loc.setZ(pa.readFloat(b1 + c.featureZ));
						loc.setPlanetId(pa.readInt(b1 + c.featurePlanet));
						lst.add(loc);
					}
				}
			}
			return lst;
		} else {
			return Collections.emptyList();
		}
	}
}