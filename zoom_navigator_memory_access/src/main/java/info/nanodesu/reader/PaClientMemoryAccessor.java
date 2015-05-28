package info.nanodesu.reader;

import java.util.List;
import java.util.Map;

public interface PaClientMemoryAccessor {
	void attach();
	boolean isAttached();
	UnitInfoReadResult readUnitInfos();
	List<FeatureLocation> readFeatureLocations(String featureKey);
	void detach();
	void setConfigMap(Map<String, Object> map);
	CamPosition readCamPosition(int holodeckId);
}
