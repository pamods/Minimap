package info.nanodesu.reader.patches;

import info.nanodesu.reader.PaClientAccessorConstants;


public class B79896Config extends PaClientAccessorConstants {
	{
		baseAdr = 0x14068BB90L;
		basePointer = new long[]{0x608, 0x18, 0x80};
		finalBase = 0x1D0;
		visibilityBit = 0x19D;
		classGuessStringLength= 2500;
		unitBase = 0x30;
		unitStruct = -0x18;
		unitId = 0x20;
		unitRadarPointer = 0x8;
		unitRadar = 0x10D;
		unitSpec = 0x38;
		currentHp = 0xF8;
		maxHp = 0xFC;
		armyId = 0x58;
		unitX = 0xC8;
		unitY = 0xCC;
		unitZ = 0xD0;
		planetId = 0x5C;
		clientUnitClassInclude = "ClientUnit";
		clientUnitsClassExclude = "ClientPlanet";

		supportsFeatureQueries = true;
		featureBase = 0x30;
		featureObjectBase = 0x18;
		featureSpecString = 0x48;
		featurePlanet = 0x68;
		featureX = 0x6C;
		featureY = 0x70;
		featureZ = 0x74;
		featureSpecStringBase = "/pa/effects/features/";
		featureClassInclude = "total_metal_value";
		featureClassExclude = null;
		
		supportsCommandQueries = true;
		commandId = 0x10;
		commandBase = 0x30;
		commandType = 0x68;
		commandPlanet= 0x38;
		commandX = 0x3C;
		commandY = 0x40;
		commandZ = 0x44;
		commandUnitSpec = 0x90;
		commandsOffsetInUnit = 0x398;
		commandClassInclude = "target positions for Multi";
		commandClassExclude = null;
		
		supportsTrackingCamera = true;
		holodecksBase = 0x14068BB90L;
		holodecksBasePtrs = new long[]{};
		holodecksFinalBase = 0x5D8;
		holodecksCam = 0x20;
		holodecksId = 0x10;
		camLocation = 0x8;
		camX = 0x18;
		camY = 0x1C;
		camZ = 0x20;
		camPlanet = 0x14;
	}
}
