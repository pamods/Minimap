package info.nanodesu.lib;

import java.io.Closeable;

import com.sun.jna.Memory;
import com.sun.jna.Native;
import com.sun.jna.Platform;
import com.sun.jna.Pointer;
import com.sun.jna.platform.win32.WinNT.HANDLE;
import com.sun.jna.ptr.IntByReference;
import com.sun.jna.win32.StdCallLibrary;

public class MemoryAPI implements Closeable {
    
    static {
        if (!Platform.isWindows()) {
            throw new RuntimeException("This works only with windows! Maybe somebody could implement it for Linux, I cannot.");
        }
    }

    private HANDLE process = null;
    
    private HANDLE window = null;
    
    public boolean processWindowHasFocus() {
        return window.equals(User32.INSTANCE.GetForegroundWindow());
    }
    
    public boolean openProcessByWindow(String windowClass, String windowName) {
        if (process != null) {
            close();
        }
        
        IntByReference pid = new IntByReference();
        User32.INSTANCE.GetWindowThreadProcessId(window = User32.INSTANCE.FindWindowA(windowClass, windowName), pid);
        return openProcessByPid(pid);
    }
    
    public boolean openProcessByPid(IntByReference pid) {
        int accessCode = Kernel32.PROCESS_VM_OPERATION | Kernel32.PROCESS_VM_READ | Kernel32.PROCESS_VM_WRITE;
        
        process = Kernel32.INSTANCE.OpenProcess(accessCode, false, pid.getValue());
        
        return process != null;
    }
    
    @Override
    public void close() {
        if (process != null) {
        	//System.out.println("Close process handle: "+process);
            Kernel32.INSTANCE.CloseHandle(process);
        }
    }
    
    public byte readByte(int adr) {
        return readMemory(adr, 1)[0];
    }
    
    public int readInt(int adr) {
        return bytesToInt(readMemory(adr, 4));
    }
    
    public float readFloat(int adr) {
        return Float.intBitsToFloat(bytesToInt(readMemory(adr, 4)));
    }
    
    public String readNullTerminatedString(int adr) {
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
    
    public void writeByte(int adr, byte b) {
        writeMemory(adr, new byte[] {b});
    }
    
    public void writeInt(int adr, int i) {
        writeMemory(adr, intToBytes(i));
    }
    
    public void writeFloat(int adr, float f) {
        writeMemory(adr, intToBytes(Float.floatToIntBits(f)));
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
    
    public byte[] readMemory(int adr, int count) {
        IntByReference bytesRead = new IntByReference();
        
        byte[] output = new byte[count];
        
        Memory mem = new Memory(output.length);
        Kernel32.INSTANCE.ReadProcessMemory(process, adr, mem, output.length, bytesRead);
        
        System.arraycopy(mem.getByteArray(0, bytesRead.getValue()), 0, output, 0, bytesRead.getValue());
        
        return output;
    }
    
    public int writeMemory(int adr, byte[] bytesToWrite) {
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

        public boolean ReadProcessMemory(HANDLE hProcess, int inBaseAddress, Pointer outputBuffer, int nSize,
                IntByReference outNumberOfBytesRead);      
        
        public boolean WriteProcessMemory(HANDLE hProcess, int inBaseAddress, Pointer inpputBuffer, int size,
                IntByReference outNumberOfBytesRead);
    }
    
    private static interface User32 extends StdCallLibrary {
        User32 INSTANCE = (User32) Native.loadLibrary("user32.dll", User32.class);
        
        public HANDLE FindWindowA(String ClassName, String WindowName);
        
        public HANDLE GetForegroundWindow();
        
        public int GetWindowThreadProcessId(HANDLE hWnd, IntByReference lpdwProcessId);
    }
}

