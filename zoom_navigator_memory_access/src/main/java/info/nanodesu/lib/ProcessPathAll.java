package info.nanodesu.lib;

import java.util.Arrays;
import java.util.List;

import com.sun.jna.Native;
import com.sun.jna.platform.win32.Kernel32;
import com.sun.jna.platform.win32.Kernel32Util;
import com.sun.jna.platform.win32.Tlhelp32;
import com.sun.jna.platform.win32.WinDef;
import com.sun.jna.platform.win32.WinNT;
import com.sun.jna.win32.W32APIOptions;

// http://stackoverflow.com/questions/24101134/jna-windows-get-process-path
public class ProcessPathAll {

    public static void main(String ... args) {
        Kernel32 kernel32 = (Kernel32) Native.loadLibrary(Kernel32.class, W32APIOptions.DEFAULT_OPTIONS);
        Tlhelp32.PROCESSENTRY32.ByReference processEntry = new Tlhelp32.PROCESSENTRY32.ByReference() {
        	protected List getFieldOrder() {
	            return Arrays.asList(new String[] { "dwSize", "cntUsage", "th32ProcessID", "th32DefaultHeapID", "th32ModuleID", "cntThreads", "th32ParentProcessID", "pcPriClassBase", "dwFlags", "szExeFile" });
	        }
        };
        WinNT.HANDLE processSnapshot = 
                kernel32.CreateToolhelp32Snapshot(Tlhelp32.TH32CS_SNAPPROCESS, new WinDef.DWORD(0));
        try {

            while (kernel32.Process32Next(processSnapshot, processEntry)) {
                // looks for a specific process
                // if (Native.toString(processEntry.szExeFile).equalsIgnoreCase("textpad.exe")) {
                System.out.print(processEntry.th32ProcessID + "\t" + Native.toString(processEntry.szExeFile) + "\t");
                WinNT.HANDLE moduleSnapshot = 
                    kernel32.CreateToolhelp32Snapshot(Tlhelp32.TH32CS_SNAPMODULE, processEntry.th32ProcessID);
                try {
                     ProcessPathKernel32.MODULEENTRY32.ByReference me = new ProcessPathKernel32.MODULEENTRY32.ByReference();
                     ProcessPathKernel32.INSTANCE.Module32First(moduleSnapshot, me);
                     System.out.print(": " + me.szExePath() );
                     System.out.println();
                 }
                 finally {
                     kernel32.CloseHandle(moduleSnapshot);
                 }
                // }
            }
        } 
        finally {
            kernel32.CloseHandle(processSnapshot);
        }
    }
}