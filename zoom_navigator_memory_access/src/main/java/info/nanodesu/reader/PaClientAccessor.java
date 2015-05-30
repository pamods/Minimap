package info.nanodesu.reader;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

/*
 * Reminder: The key code part to find and to work from is:
 * 
nop [rax]
mov rax,[r15]
*
mov rsi,[rdx+r14*8] // RDX here is the base adr of the list of game entities
*
mov rax,[rsi]
mov rcx,rsi
call qword ptr [rax+30]
   
rcx is where the unit is. rax+30 has to have a specific value that can be guessed, as it is the one that is used the least when only one unit is visible.

	Reminder 2: The key part to get the base address of the holodeck list is handled here:

mov ecx,r9d
*
mov rsi,rax
*
mov rsi,rdi
mov [rbp+00000158],rsi
cmp byte ptr [r15+00000610],00
*
mov rcx,r15
*
mov rbx,[r15+000005D8] // r15 is the spot. Offsets will be changed
mov rdi,[r15+000005E0]
cmp rbx,rdi
*
mov rcx,[rbx]
test rcx,rcx
*
movaps xmm1,xmm6
*
add rbx,08

	
 */

public class PaClientAccessor extends AbstractPaAccessor {
	
	protected static void l(long x) {
		System.out.println(hex(x));
	}

	private static String hex(long x) {
		return Long.toHexString(x).toUpperCase();
	}
	
	private long cachedClientUnitClassAdr = -1; 
	private long cachedMexClassAdr = -1;
	private long cachedCommandClassAdr = -1;
	private long cachedRadarBlipClassAdr = -1;
	
	private byte[] readCacheSmall;
	private byte[] readCacheLarge;
	
	@Override
	public void setConfigMap(Map<String, Object> map) {
		super.setConfigMap(map);
		
		readCacheSmall = new byte[1024];
		readCacheLarge = new byte[10 * 1024];
	}
	
	private long followPointerPatch(long base, long[] path) {
		long a = pa.readLong(base);
		for (int i = 0; i < path.length; i++) {
			a = pa.readLong(a + path[i]);
		}
		return a;
	}
	
	private long findBaseUnitListPointer() {
		return followPointerPatch(c.baseAdr, c.basePointer) + c.finalBase;
	}
	
	private long findBaseHolodecksPointer() {
		return followPointerPatch(c.holodecksBase, c.holodecksBasePtrs) + c.holodecksFinalBase;
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
	
	private boolean isRadarBlipClass(long clazzAdr) {
		if (cachedRadarBlipClassAdr == -1 && isClassByString(clazzAdr, c.radarBlipClassInclude, c.radarBlipClassExclude)) {
			cachedRadarBlipClassAdr = clazzAdr;
		}
		return clazzAdr == cachedRadarBlipClassAdr;
	}
	
	private boolean isClientUnitClass(long clazzAdr) {
		if (cachedClientUnitClassAdr == -1 && isClassByString(clazzAdr, c.clientUnitClassInclude, c.clientUnitsClassExclude)) {
			cachedClientUnitClassAdr = clazzAdr;
		}
		return clazzAdr == cachedClientUnitClassAdr;
	}
	
	private boolean isMexClass(long clazzAdr) {
		if (cachedMexClassAdr == -1 && isClassByString(clazzAdr, c.featureClassInclude, c.featureClassExclude)) {
			cachedMexClassAdr = clazzAdr;
		}
		return clazzAdr == cachedMexClassAdr;
	}
	
	private boolean isCommandClass(long classAdr) {
		if (cachedCommandClassAdr == -1 && isClassByString(classAdr, c.commandClassInclude, c.commandClassExclude)) {
			cachedCommandClassAdr = classAdr;
		}
		return classAdr == cachedCommandClassAdr;
	}
	
	private boolean isInterestingUnit(long unit) {
		boolean isUnit = isClientUnitClass(pa.readLong(unit));
		boolean isVisibleUnit = pa.readByte(unit + c.visibilityBit) == 1;
		return isUnit && isVisibleUnit;
	}
	
	private FullUnitInfo readRadarBlip(long blip) {
		FullUnitInfo inf = new FullUnitInfo();
		inf.setDebugAdress(hex(blip));
		long base = pa.readLong(blip + c.radarBlipBase);
		pa.startBatchRead(base, readCacheSmall);
		inf.setId(pa.readInt(base + c.radarBlipId));
		inf.setArmy(pa.readInt(base + c.radarBlipArmyId));
		inf.setPlanetId(pa.readInt(base + c.radarBlipPlanet));
		inf.setX(pa.readFloat(base + c.radarBlipX));
		inf.setY(pa.readFloat(base + c.radarBlipY));
		inf.setZ(pa.readFloat(base + c.radarBlipZ));
		inf.setSpec("unknown");
		pa.endBatchRead();
		return inf;
	}
	
	private FullUnitInfo readUnit(long unit) {
		FullUnitInfo inf = new FullUnitInfo();
		inf.setDebugAdress(hex(unit));
		// the unitstruct offset likely is not necessary once only versions without radar hack are supported
		long base = pa.readLong(unit + c.unitBase) + c.unitStruct;
		
		pa.startBatchRead(base, readCacheSmall);
		
		inf.setId(pa.readInt(base + c.unitId));
		if (c.needsRadarHack && pa.readByte(pa.readLong(base + c.unitRadarPointer) + c.unitRadar) == 0) {
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
		
		if (c.supportsCommandQueries) {
			long cmdStart = pa.readLong(unit + c.commandsOffsetInUnit);
			long cmdEnd = pa.readLong(unit + c.commandsOffsetInUnit + 8);
			pa.endBatchRead();
			pa.startBatchRead(cmdStart, readCacheSmall);
			
			List<Integer> cmds = new ArrayList<>();
			
			for (long i = cmdStart; i < cmdEnd; i+=4) {
				cmds.add(pa.readInt(i));
			}
			
			inf.setCommandIds(cmds);
		}
		pa.endBatchRead();
		
		return inf;
	}
	
	private UnitCommand readUnitCommand(long adr) {
		UnitCommand r = new UnitCommand();
		
		r.setDebugAddress(hex(adr));
		
		r.setId(pa.readInt(adr + c.commandId));
		long base = pa.readLong(adr + c.commandBase);
		
		r.setType((byte) pa.readInt(adr + c.commandType));
		
		pa.startBatchRead(base, readCacheSmall);
		
		r.setPlanetId(pa.readInt(base + c.commandPlanet));
		r.setX(pa.readFloat(base + c.commandX));
		r.setY(pa.readFloat(base + c.commandY));
		r.setZ(pa.readFloat(base + c.commandZ));
		r.setUnitSpec(pa.readNullTerminatedString(pa.readLong(base + c.commandUnitSpec)));
		
		if (r.getUnitSpec() != null && !(r.getUnitSpec().startsWith("/pa/units/") && r.getUnitSpec().endsWith(".json"))) {
			r.setUnitSpec(null);
		}
		
		pa.endBatchRead();
		
		return r;
	}
	
	@Override
	public UnitInfoReadResult readUnitInfos() {
		long base = findBaseUnitListPointer();
		long startUnits = findUnitStartPointer(base);
		long endUnits = findUnitEndPointer(base);

		List<FullUnitInfo> units = new ArrayList<>();
		List<UnitCommand> commands = new ArrayList<>();
		
		int numUnits = (int) ((endUnits - startUnits) / 8);
		long[] unitsIds = new long[numUnits];

		pa.startBatchRead(startUnits, readCacheLarge);
		for (int i = 0; i < unitsIds.length; i++) {
			unitsIds[i] = pa.readLong(startUnits + i*8);
		}
		pa.endBatchRead();

		for (int i = 0; i < unitsIds.length; i++) {
			long unit = unitsIds[i];
			if (isInterestingUnit(unit)) {
				units.add(readUnit(unit));
			} else {
				long clazz = pa.readLong(unit);
				if (isCommandClass(clazz)) {
					commands.add(readUnitCommand(unit));
				} else if (isRadarBlipClass(clazz)) {
					units.add(readRadarBlip(unit));
				}
			}
		}
		
		UnitInfoReadResult result = new UnitInfoReadResult();
		result.unitInfos = units;
		result.commands = commands;
		return result;
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
						loc.setDebugAddress(hex(b1));
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
	
	@Override
	public CamPosition readCamPosition(int holodeckId) {
		CamPosition position = new CamPosition();
		if (c.supportsTrackingCamera) {
			
			long startHolodecks = findBaseHolodecksPointer();
			long endHolodecks = startHolodecks + 0x8;
			
			startHolodecks = pa.readLong(startHolodecks);
			endHolodecks = pa.readLong(endHolodecks);
			
			for (int i = 0; i + startHolodecks < endHolodecks; i+=8) {
				long hdeck = pa.readLong(startHolodecks + i);
				int id = pa.readInt(hdeck + c.holodecksId);
				if (id == holodeckId) {
					long hcam = pa.readLong(hdeck + c.holodecksCam);
					if (hcam != 0) {
						long camLoc = pa.readLong(hcam + c.camLocation);
						position.setDebugAddress(hex(camLoc));
						position.setX(pa.readFloat(camLoc + c.camX));
						position.setY(pa.readFloat(camLoc + c.camY));
						position.setZ(pa.readFloat(camLoc + c.camZ));
						position.setPlanet(pa.readInt(camLoc + c.camPlanet));
						position.setValidPosition(true);
					}
					break;
				}
			}
		}
		return position;
	}
}