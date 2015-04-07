package info.nanodesu.reader;

import java.util.List;

public interface PaClientMemoryAccessor {
	void attach();
	boolean isAttached();
	List<FullUnitInfo> readUnitInfos();
	void detach();
}
