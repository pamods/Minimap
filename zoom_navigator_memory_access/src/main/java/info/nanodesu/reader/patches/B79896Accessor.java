package info.nanodesu.reader.patches;


public class B79896Accessor extends PaAccessor1 {
	
	public static void main(String[] args) {
		B79896Accessor t = new B79896Accessor(4768);
		t.attach();
		System.out.println(t.readUnitInfos());
		t.detach();
	}
	
	public B79896Accessor(int pid) {
		super(pid, new PaAccessor1Constants() {
			{
				baseAdr = 0x14068BB90L;
				basePointer = new long[]{0x608, 0x18, 0x80};
				finalBase = 0x1D0;
				visibilityBit = 0x19D;
				classGuessStringLength= 2500;
				unitBase = 0x30;
				unitStruct = -0x18;
				unitId = 0x20;
				unitRadarPointer = 0x8;
				unitRadar = 0x10D;
				unitSpec = 0x38;
				currentHp = 0xF8;
				maxHp = 0xFC;
				armyId = 0x58;
				x = 0xC8;
				y = 0xCC;
				z = 0xD0;
				planetId = 0x5C;
			}
		});
	}
}