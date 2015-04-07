package info.nanodesu.reader;

import java.util.List;

public class B79896Accessor extends AbstractPaAccessor {

	public static void l(long x) {
		System.out.println(Long.toHexString(x).toUpperCase());
	}
	
	public static void main(String[] args) {
		B79896Accessor t = new B79896Accessor(9916);
		t.attach();
		t.readUnitInfos();
		t.detach();
	}
	
	public B79896Accessor(int pid) {
		super(pid);
	}
	
	private long findBaseUnitListPointer() {
		long a = pa.readLong(0x14068BB90L);
		long b = pa.readLong(a + 0x608);
		long c = pa.readLong(b + 0x18);
		long d = pa.readLong(c + 0x80);
		return d + 0x1D0;
	}
	
	private long findUnitStartPointer(long listPointer) {
		return pa.readLong(listPointer);
	}
	
	private long findUnitEndPointer(long listPointer) {
		return pa.readLong(listPointer + 0x8);
	}
	
	private boolean isInterestingUnit(long unit) {
		return 0x1404C58D8L == pa.readLong(unit) + 0x30;
	}
	
	@Override
	public List<FullUnitInfo> readUnitInfos() {
		long base = findBaseUnitListPointer();
		long startUnits = findUnitStartPointer(base);
		long endUnits = findUnitEndPointer(base);
		
		for (int i = 0; i + startUnits < endUnits; i+=8) {
			long unit = pa.readLong(startUnits + i);
			if (isInterestingUnit(unit)) {
				// TODO
			}
		}
		
		return null;
	}
}