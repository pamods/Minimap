package info.nanodesu.reader;

import java.util.ArrayList;
import java.util.List;

public class B79896Accessor extends AbstractPaAccessor {

	public static void l(long x) {
		System.out.println(Long.toHexString(x).toUpperCase());
	}
	
	public static void main(String[] args) {
		B79896Accessor t = new B79896Accessor(7468);
		t.attach();
		System.out.println(t.readUnitInfos());
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
		return 0x1404C58D8L == pa.readLong(unit) + 0x30 && pa.readByte(unit + 0x19D) == 1;
	}
	
	private FullUnitInfo readUnit(long unit) {
		FullUnitInfo inf = new FullUnitInfo();
		long base = pa.readLong(unit + 0x30) - 0x18;
		inf.setId(pa.readInt(base + 0x20));
		if (pa.readByte(pa.readLong(base + 0x8) + 0x10D) == 0) {
			inf.setId(inf.getId() + Integer.MIN_VALUE);
			inf.setUnitSpec("unknown");
		} else {
			inf.setUnitSpec(pa.readNullTerminatedString(pa.readLong(base + 0x38)));
			inf.setCurrentHp(pa.readFloat(base + 0xF8));
			inf.setMaxHp(pa.readFloat(base + 0xFC));
		}
		inf.setArmyId(pa.readInt(base + 0x58));
		inf.setX(pa.readFloat(base + 0xC8));
		inf.setY(pa.readFloat(base + 0xCC));
		inf.setZ(pa.readFloat(base + 0xD0));
		
		return inf;
	}
	
	@Override
	public List<FullUnitInfo> readUnitInfos() {
		long base = findBaseUnitListPointer();
		long startUnits = findUnitStartPointer(base);
		long endUnits = findUnitEndPointer(base);
		List<FullUnitInfo> lst = new ArrayList<>();
		for (int i = 0; i + startUnits < endUnits; i+=8) {
			long unit = pa.readLong(startUnits + i);
			if (isInterestingUnit(unit)) {
				lst.add(readUnit(unit));
			}
		}
		return lst;
	}
}