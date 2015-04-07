package info.nanodesu.reader;

import info.nanodesu.lib.Memory64API;
import info.nanodesu.lib.Windows64MemoryAPI;

import com.sun.jna.Platform;

public abstract class AbstractPaAccessor implements PaClientMemoryAccessor {
	private boolean attached = false;
	private int pid;
	protected Memory64API pa;
	
	public AbstractPaAccessor(int pid) {
		this.pid = pid;
		if (Platform.is64Bit()) {
			if (Platform.isWindows()) {
				pa = new Windows64MemoryAPI();
			} else {
				throw new RuntimeException("support is implemented only for windows. If you know how to implement this on linux or OSX please help me implement it.");
			}
		} else {
			throw new RuntimeException("this program only supports 64 bits systems");
		}
	}
	
	@Override
	public boolean isAttached() {
		return attached;
	}
	
	@Override
	public void attach() {
		pa.openProcessByPid(pid);
		attached = true;
	}
	
	@Override
	public void detach() {
		pa.close();
		attached = false;
	}
}
