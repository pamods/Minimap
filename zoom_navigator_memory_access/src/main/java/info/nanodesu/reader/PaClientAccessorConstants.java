package info.nanodesu.reader;

import info.nanodesu.reader.patches.B79896Config;
import info.nanodesu.reader.patches.B80684Config;
import info.nanodesu.reader.patches.B82098Config;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;
import java.util.Objects;

public class PaClientAccessorConstants {
	private static Map<String, PaClientAccessorConstants> initMapping() {
		Map<String, PaClientAccessorConstants> m = new HashMap<String, PaClientAccessorConstants>();

		B79896Config b79896 = new B79896Config();
		for (String v: Arrays.asList("79896-pte", "80155-pte", "80187", "80462")) {
			m.put(v, b79896);
		}
		
		B80684Config b80684 = new B80684Config();
		for (String v: Arrays.asList("80684-pte", "81029-pte")) {
			m.put(v, b80684);
		}
		
		B82098Config b82098 = new B82098Config();
		for (String v: Arrays.asList("82098-pte", "82293")) {
			m.put(v, b82098);
		}
		
		return m;
	}
	
	private static Map<String, PaClientAccessorConstants> map = initMapping();
	
	public static PaClientAccessorConstants getConfigFor(String version) {
		return map.get(version);
	}
	
	public static List<String> getSupportedVersions() {
		List<String> strs = new ArrayList<>(map.keySet());
		Collections.sort(strs);
		return strs;
	}
	
	public static String getVersionOf(PaClientAccessorConstants config) {
		for(Entry<String, PaClientAccessorConstants> entries: map.entrySet()) {
			if (Objects.equals(entries.getValue().getClass(), config.getClass())) {
				return entries.getKey();
			}
		}
		
		throw new RuntimeException("it seems somebody forgot to register that constants class in the global mapping?!");
	}
	
	public boolean needsRadarHack = true;
	public String radarBlipClassInclude;
	public String radarBlipClassExclude;
	public long radarBlipBase;
	public long radarBlipId;
	public long radarBlipArmyId;
	public long radarBlipPlanet;
	public long radarBlipX;
	public long radarBlipY;
	public long radarBlipZ;
	
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
	
	public boolean supportsCommandQueries = false;
	public long commandId;
	public long commandBase;
	public long commandX;
	public long commandY;
	public long commandZ;
	public long commandPlanet;
	public long commandUnitSpec;
	public long commandType;
	public long commandsOffsetInUnit;
	public String commandClassInclude;
	public String commandClassExclude;
	
	public boolean supportsTrackingCamera = false;
	public long holodecksBase;
	public long[] holodecksBasePtrs;
	public long holodecksFinalBase;
	public long holodecksCam;
	public long holodecksId;
	public long camLocation;
	public long camX;
	public long camY;
	public long camZ;
	public long camPlanet;
}
