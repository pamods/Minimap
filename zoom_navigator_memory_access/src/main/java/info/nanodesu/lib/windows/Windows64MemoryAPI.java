package info.nanodesu.lib.windows;

import info.nanodesu.lib.Memory64API;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileReader;
import java.io.IOException;
import java.io.Reader;
import java.util.Arrays;
import java.util.List;

import org.restlet.engine.io.IoUtils;

import com.sun.jna.Memory;
import com.sun.jna.Native;
import com.sun.jna.Platform;
import com.sun.jna.Pointer;
import com.sun.jna.platform.win32.Tlhelp32;
import com.sun.jna.platform.win32.WinDef.DWORD;
import com.sun.jna.platform.win32.WinNT.HANDLE;
import com.sun.jna.ptr.IntByReference;
import com.sun.jna.win32.W32APIOptions;

public class Windows64MemoryAPI implements Memory64API {
	
    public Windows64MemoryAPI() {
    	if (!Platform.isWindows()) {
            throw new RuntimeException("This works only with windows! Maybe somebody could implement it for Linux, I cannot.");
        } else if (!Platform.is64Bit()) {
        	throw new RuntimeException("This assumes a 64 bit runtime! Please install a 64bit jvm");
        }
    }
    
    private HANDLE process = null;

    private static final int READ_MEMORY_CACHE_SIZE = 15 * 1024;
    private Memory readMemoryCache = new Memory(READ_MEMORY_CACHE_SIZE);
    private IntByReference readSizeIntCache = new IntByReference();
    
    private long batchCacheStartAdr = -1;
    private byte[] batchCache = null;
    
    @Override
	public boolean openProcessByPid(int pid) {
        int accessCode = Kernel32.PROCESS_VM_OPERATION | Kernel32.PROCESS_VM_READ | Kernel32.PROCESS_VM_WRITE;
        
        process = Kernel32.INSTANCE.OpenProcess(accessCode, false, pid);
        
        return process != null;
    }
    
    @Override
    public void close() {
        if (process != null) {
            Kernel32.INSTANCE.CloseHandle(process);
            process = null;
        }
    }
    
    private boolean isCached(long adr, int size) {
    	return batchCache != null && adr >= batchCacheStartAdr && adr + size < batchCacheStartAdr + batchCache.length;
    }
    
    @Override
	public byte readByte(long adr) {
    	if (isCached(adr, 1)) {
    		return batchCache[(int)(adr-batchCacheStartAdr)];
    	} else {
    		return readMemory(adr, 1)[0];
    	}
    }
    
    @Override
	public int readInt(long adr) {
    	if (isCached(adr, 4)) {
    		return bytesToInt(batchCache, (int)(adr-batchCacheStartAdr));
    	} else {
    		return bytesToInt(readMemory(adr, 4), 0);    		
    	}
    }
    
	@Override
	public long readLong(long adr) {
		if (isCached(adr, 8)) {
			return bytesToLong(batchCache, (int)(adr-batchCacheStartAdr));
		} else {
			return bytesToLong(readMemory(adr, 8), 0);			
		}
	}
    
    @Override
	public float readFloat(long adr) {
        return Float.intBitsToFloat(readInt(adr));
    }
    
    @Override
	public String readNullTerminatedString(long adr) {
    	StringBuilder builder = new StringBuilder();
    	byte[] r = null;
    	loop:	
    	do {
    		int batchSize = 32;
    		r = readMemory(adr, batchSize);
    		
    		for (int i = 0; i < r.length; i++) {
    			if (r[i] == 0) {
    				break loop;
    			} else {
    				builder.append((char) r[i]);
    			}
    		}
    		adr += 32;
    	} while(true);
    	
    	return builder.toString();
    }
   
	@Override
	public String readAsString(long adr, int length) {
		StringBuilder builder = new StringBuilder();
		
		byte[] r = readMemory(adr, length);
		
		for (int i = 0; i < r.length; i++) {
			builder.append((char) r[i]);
		}
		
		return builder.toString();
	}
   
    @Override
	public void writeByte(long adr, byte b) {
        writeMemory(adr, new byte[] {b});
    }
    
    @Override
	public void writeInt(long adr, int i) {
        writeMemory(adr, intToBytes(i));
    }
    
    @Override
	public void writeFloat(long adr, float f) {
        writeMemory(adr, intToBytes(Float.floatToIntBits(f)));
    }
    
	@Override
	public void writeLong(long adr, long l) {
		writeMemory(adr, longToBytes(l));
	}
    
	private static byte[] longToBytes(long i) {
        byte[] dest = new byte[8];
        dest[7] = (byte) (i >>> 56);
        dest[6] = (byte) (i >>> 48);
        dest[5] = (byte) (i >>> 40);
        dest[4] = (byte) (i >>> 32);
        dest[3] = (byte) (i >>> 24);
        dest[2] = (byte) (i >>> 16);
        dest[1] = (byte) (i >>> 8);
        dest[0] = (byte) (i);

        return dest;
	}
	
    private static byte[] intToBytes(int i) {
        byte[] dest = new byte[4];
        dest[3] = (byte) (i >>> 24);
        dest[2] = (byte) (i >>> 16);
        dest[1] = (byte) (i >>> 8);
        dest[0] = (byte) (i);

        return dest;
    }

    private static int bytesToInt(byte[] b, int offset) {
        int result = 0;
        
        for (int i = 3; i >= 0; i--) {
        	result |= (0xFF & b[offset + i]) << 8 * i;
        }

        return result;   
    }

    private static long bytesToLong(byte[] b, int offset) {
        long result = 0;
        
        for (int i = 7; i >= 0; i--) {
        	result |= (long) (0xFF & b[offset + i]) << i * 8;
        }

        return result;    	
    }
    
    private void readMemory(long adr, int count, byte[] output) {
        IntByReference bytesRead = readSizeIntCache;
        
        Memory mem = null; 

        if (output.length < READ_MEMORY_CACHE_SIZE) {
        	mem = readMemoryCache;
        } else {
        	System.out.println("WARN: reading " + count + " bytes from 0x" + Long.toHexString(adr) + ": size > cache!!!");
        	mem = new Memory(output.length);
        }
        
        Kernel32.INSTANCE.ReadProcessMemory(process, adr, mem, output.length, bytesRead);
        mem.read(0, output, 0, bytesRead.getValue());
    }
    
    @Override
	public byte[] readMemory(long adr, int count) {
    	byte[] output = new byte[count];
    	readMemory(adr, count, output);
    	return output;
    }
    
    // TODO optimize write: write currently is not as optimized as read is, as it is not used in this project (yet)
    @Override
	public int writeMemory(long adr, byte[] bytesToWrite) {
        IntByReference bytesWritten = new IntByReference();
        
        Memory mem = new Memory(bytesToWrite.length);
        mem.write(0, bytesToWrite, 0, bytesToWrite.length);
        
        Kernel32.INSTANCE.WriteProcessMemory(process, adr, mem, bytesToWrite.length, bytesWritten);
        
        return bytesWritten.getValue();
    }
    
    private static interface Kernel32 extends com.sun.jna.platform.win32.Kernel32 {
        public static int PROCESS_VM_OPERATION = 0x0008;
        public static int PROCESS_VM_READ = 0x0010;
        public static int PROCESS_VM_WRITE = 0x0020;
        
        Kernel32 INSTANCE = (Kernel32) Native.loadLibrary(Kernel32.class, W32APIOptions.DEFAULT_OPTIONS);

        public HANDLE OpenProcess(int dwDesiredAccess, boolean bInheritHandle, int dwProcessId);

        public boolean CloseHandle(HANDLE handle);

        public boolean ReadProcessMemory(HANDLE hProcess, long inBaseAddress, Pointer outputBuffer, int nSize,
                IntByReference outNumberOfBytesRead);      
        
        public boolean WriteProcessMemory(HANDLE hProcess, long inBaseAddress, Pointer inpputBuffer, int size,
                IntByReference outNumberOfBytesRead);
    }

	@Override
	public int findPAProcess() {
		HANDLE hProcessSnap = Kernel32.INSTANCE.CreateToolhelp32Snapshot(Tlhelp32.TH32CS_SNAPPROCESS, new DWORD(0));
		if (hProcessSnap != null) {
			try {
				Tlhelp32.PROCESSENTRY32.ByReference ref = new Tlhelp32.PROCESSENTRY32.ByReference() {
					@SuppressWarnings("rawtypes")
					protected List getFieldOrder() {
			            return Arrays.asList(new String[] { "dwSize", "cntUsage", "th32ProcessID", "th32DefaultHeapID", "th32ModuleID", "cntThreads", "th32ParentProcessID", "pcPriClassBase", "dwFlags", "szExeFile" });
			        }
				};
				while (Kernel32.INSTANCE.Process32Next(hProcessSnap, ref)) {
					if ("PA.exe".equals(Native.toString(ref.szExeFile))) {
						return ref.th32ProcessID.intValue();
					}
				}
				throw new RuntimeException("cannot find process PA.exe Please ensure your PA executable is called PA.exe and that PA is running.");
			} finally {
				Kernel32.INSTANCE.CloseHandle(hProcessSnap);
			}
		} else {
			throw new RuntimeException("cannot find pa process: process snap handle is null");
		}
	}

	@Override
	public String findPAVersion(int process) {
		DWORD paProc = new DWORD(process);
		HANDLE moduleSnapshot = 
                Kernel32.INSTANCE.CreateToolhelp32Snapshot(Tlhelp32.TH32CS_SNAPMODULE, paProc);
		try {
			 ProcessPathKernel32.MODULEENTRY32.ByReference me = new ProcessPathKernel32.MODULEENTRY32.ByReference();
	         ProcessPathKernel32.INSTANCE.Module32First(moduleSnapshot, me);
	         File exePath = new File(me.szExePath());
	         File versionFile = new File(exePath.getParentFile().getParentFile(), "version.txt");
	         Reader reader = new BufferedReader(new FileReader(versionFile));
	         try {
	        	 return IoUtils.toString(reader).trim();
	         } finally {
	        	 try {
					reader.close();
				} catch (IOException e) {
				}
	         }
		} catch (FileNotFoundException e) {
			throw new RuntimeException("cannot find version file", e);
		} catch (Exception e) {
			throw new RuntimeException("error finding version", e);
		} finally {
			Kernel32.INSTANCE.CloseHandle(moduleSnapshot);
		}
	}

	@Override
	public void startBatchRead(long adr, byte[] cache) {
		batchCache = cache;
		batchCacheStartAdr = adr;
		readMemory(adr, cache.length, cache);
	}

	@Override
	public void endBatchRead() {
		batchCache = null;
	}
}

