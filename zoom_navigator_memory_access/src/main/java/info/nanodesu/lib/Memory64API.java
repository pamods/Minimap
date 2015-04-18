package info.nanodesu.lib;


/**
 * There is no support for 32 bit systems. It would be possible to rewrite this with int for the addresses, but I see
 * little value in the extra work just for systems that will crash all the time anyway, as running the zoom system will require extra memory
 * @author ColaColin
 */
public interface Memory64API {

	int findPAProcess();
	
	String findPAVersion(int process);
	
	boolean openProcessByPid(int pid);

	void close();

	byte readByte(long adr);

	int readInt(long adr);

	long readLong(long adr);
	
	float readFloat(long adr);

	String readNullTerminatedString(long adr);
	
	String readAsString(long adr, int length);
	
	void writeByte(long adr, byte b);

	void writeInt(long adr, int i);
	
	void writeLong(long adr, long l);
	
	void writeFloat(long adr, float f);

	byte[] readMemory(long adr, int count);

	int writeMemory(long adr, byte[] bytesToWrite);

}