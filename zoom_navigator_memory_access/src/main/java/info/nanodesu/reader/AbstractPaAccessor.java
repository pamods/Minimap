package info.nanodesu.reader;

import java.util.Map;

import info.nanodesu.lib.Memory64API;
import info.nanodesu.lib.windows.Windows64MemoryAPI;

import com.sun.jna.Platform;

public abstract class AbstractPaAccessor implements PaClientMemoryAccessor {
	public static final String PID_KEY = "pid";
	public static final String VERSION_KEY = "version";
	
	private boolean attached = false;
	protected Memory64API pa;
	protected Map<String, Object> configMap;
	protected PaClientAccessorConstants c;
	
	public AbstractPaAccessor() {
		if (Platform.is64Bit()) {
			if (Platform.isWindows()) {
				pa = new Windows64MemoryAPI();
			} else {
				throw new RuntimeException("support is implemented only for windows. If you know how to implement this on linux or OSX please help me implement it.");
			}
		} else {
			throw new RuntimeException("this program only supports 64 bit systems");
		}
	}
	
	@Override
	public boolean isAttached() {
		return attached;
	}
	
	@Override
	public void setConfigMap(Map<String, Object> map) {
		configMap = map;
	}
	
	@Override
	public void attach() {
		if (!isAttached()) {
			c = PaClientAccessorConstants.getConfigFor((String)configMap.get(VERSION_KEY));
			attached = pa.openProcessByPid((int)configMap.get(PID_KEY));
		}
	}
	
	@Override
	public void detach() {
		if (attached) {
			pa.close();
			attached = false;
		}
	}
}
