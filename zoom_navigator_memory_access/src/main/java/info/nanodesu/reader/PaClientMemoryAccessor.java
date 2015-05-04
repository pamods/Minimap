package info.nanodesu.reader;

import java.util.List;

public interface PaClientMemoryAccessor {
	void attach();
	boolean isAttached();
	List<FullUnitInfo> readUnitInfos();
	List<FeatureLocation> readFeatureLocations(String featureKey);
	void detach();
	void updatePid(int pid);
	int getPid();
}
