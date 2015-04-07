package info.nanodesu.lib;

import com.sun.jna.Memory;
import com.sun.jna.Native;
import com.sun.jna.Platform;
import com.sun.jna.Pointer;
import com.sun.jna.platform.win32.WinNT.HANDLE;
import com.sun.jna.ptr.IntByReference;
import com.sun.jna.win32.StdCallLibrary;

public class Windows64MemoryAPI implements Memory64API {
    public Windows64MemoryAPI() {
    	if (!Platform.isWindows()) {
            throw new RuntimeException("This works only with windows! Maybe somebody could implement it for Linux, I cannot.");
        } else if (!Platform.is64Bit()) {
        	throw new RuntimeException("This assumes a 64 bit runtime! Please install a 64bit jvm");
        }
    }
    
    private HANDLE process = null;

    @Override
	public boolean openProcessByPid(int pid) {
        int accessCode = Kernel32.PROCESS_VM_OPERATION | Kernel32.PROCESS_VM_READ | Kernel32.PROCESS_VM_WRITE;
        
        process = Kernel32.INSTANCE.OpenProcess(accessCode, false, pid);
        
        return process != null;
    }
    
    @Override
    public void close() {
        if (process != null) {
        	//System.out.println("Close process handle: "+process);
            Kernel32.INSTANCE.CloseHandle(process);
        }
    }
    
    @Override
	public byte readByte(long adr) {
        return readMemory(adr, 1)[0];
    }
    
    @Override
	public int readInt(long adr) {
        return bytesToInt(readMemory(adr, 4));
    }
    
	@Override
	public long readLong(long adr) {
		return bytesToLong(readMemory(adr, 8));
	}
    
    @Override
	public float readFloat(long adr) {
        return Float.intBitsToFloat(bytesToInt(readMemory(adr, 4)));
    }
    
    @Override
	public String readNullTerminatedString(long adr) {
    	StringBuilder builder = new StringBuilder();
    	byte[] r = null;
    	loop:	
    	do {
    		r = readMemory(adr, 8);
    		
    		for (int i = 0; i < r.length; i++) {
    			if (r[i] == 0) {
    				break loop;
    			} else {
    				builder.append((char) r[i]);
    			}
    		}
    		adr += 8;
    	} while(true);
    	
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

    private static int bytesToInt(byte[] b) {
        int result = 0;

        result |= (0xFF & b[3]) << 24;
        result |= (0xFF & b[2]) << 16;
        result |= (0xFF & b[1]) << 8;
        result |= (0xFF & b[0]);

        return result;   
    }

    private static long bytesToLong(byte[] b) {
        long result = 0;

        result |= (long) (0xFF & b[7]) << 56;
        result |= (long) (0xFF & b[6]) << 48;
        result |= (long) (0xFF & b[5]) << 40;
        result |= (long) (0xFF & b[4]) << 32;
        result |= (long) (0xFF & b[3]) << 24;
        result |= (long) (0xFF & b[2]) << 16;
        result |= (long) (0xFF & b[1]) << 8;
        result |= (long) (0xFF & b[0]);

        return result;    	
    }
    
    @Override
	public byte[] readMemory(long adr, int count) {
        IntByReference bytesRead = new IntByReference();
        
        byte[] output = new byte[count];
        
        Memory mem = new Memory(output.length);
        Kernel32.INSTANCE.ReadProcessMemory(process, adr, mem, output.length, bytesRead);
        
        System.arraycopy(mem.getByteArray(0, bytesRead.getValue()), 0, output, 0, bytesRead.getValue());
        
        return output;
    }
    
    @Override
	public int writeMemory(long adr, byte[] bytesToWrite) {
        IntByReference bytesWritten = new IntByReference();
        
        Memory mem = new Memory(bytesToWrite.length);
        mem.write(0, bytesToWrite, 0, bytesToWrite.length);
        
        Kernel32.INSTANCE.WriteProcessMemory(process, adr, mem, bytesToWrite.length, bytesWritten);
        
        return bytesWritten.getValue();
    }
    
    private static interface Kernel32 extends StdCallLibrary {
        public static int PROCESS_VM_OPERATION = 0x0008;
        public static int PROCESS_VM_READ = 0x0010;
        public static int PROCESS_VM_WRITE = 0x0020;
        
        Kernel32 INSTANCE = (Kernel32) Native.loadLibrary("kernel32.dll", Kernel32.class);

        public HANDLE OpenProcess(int dwDesiredAccess, boolean bInheritHandle, int dwProcessId);

        public boolean CloseHandle(HANDLE handle);

        public boolean ReadProcessMemory(HANDLE hProcess, long inBaseAddress, Pointer outputBuffer, int nSize,
                IntByReference outNumberOfBytesRead);      
        
        public boolean WriteProcessMemory(HANDLE hProcess, long inBaseAddress, Pointer inpputBuffer, int size,
                IntByReference outNumberOfBytesRead);
    }
}

