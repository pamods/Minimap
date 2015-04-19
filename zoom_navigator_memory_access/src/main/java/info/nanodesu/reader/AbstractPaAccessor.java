package info.nanodesu.reader;

import info.nanodesu.lib.Memory64API;
import info.nanodesu.lib.windows.Windows64MemoryAPI;

import com.sun.jna.Platform;

public abstract class AbstractPaAccessor implements PaClientMemoryAccessor {
	private boolean attached = false;
	private volatile int pid;
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
			throw new RuntimeException("this program only supports 64 bit systems");
		}
	}
	
	@Override
	public boolean isAttached() {
		return attached;
	}
	
	@Override
	public void updatePid(int pid) {
		boolean wasAttached = false;
		if (isAttached()) {
			wasAttached = true;
			detach();
		}
		
		this.pid = pid;
		
		if (wasAttached) {
			attach();
		}
	}
	
	@Override
	public int getPid() {
		return pid;
	}
	
	@Override
	public void attach() {
		if (!isAttached()) {
			attached = pa.openProcessByPid(pid);
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
