package info.nanodesu.reader;

public class FullUnitInfo {
	private int id;
	private String unitSpec;
	private int armyId;
	private float x;
	private float y;
	private float z;
	private float planetId;
	private float currentHp;
	private float maxHp;
		
	public float getPlanetId() {
		return planetId;
	}
	
	public void setPlanetId(float planetId) {
		this.planetId = planetId;
	}
	
	public int getId() {
		return id;
	}

	public void setId(int id) {
		this.id = id;
	}

	public String getUnitSpec() {
		return unitSpec;
	}

	public void setUnitSpec(String unitSpec) {
		this.unitSpec = unitSpec;
	}

	public int getArmyId() {
		return armyId;
	}

	public void setArmyId(int armyId) {
		this.armyId = armyId;
	}

	public float getX() {
		return x;
	}

	public void setX(float x) {
		this.x = x;
	}

	public float getY() {
		return y;
	}

	public void setY(float y) {
		this.y = y;
	}

	public float getZ() {
		return z;
	}

	public void setZ(float z) {
		this.z = z;
	}

	public float getCurrentHp() {
		return currentHp;
	}

	public void setCurrentHp(float currentHp) {
		this.currentHp = currentHp;
	}

	public float getMaxHp() {
		return maxHp;
	}

	public void setMaxHp(float maxHp) {
		this.maxHp = maxHp;
	}

	@Override
	public String toString() {
		return "UnitAdd [id=" + id + ", unitSpec=" + unitSpec + ", armyId="
				+ armyId + ", x=" + x + ", y=" + y + ", z=" + z
				+ ", currentHp=" + currentHp + ", maxHp=" + maxHp + "]";
	}

	@Override
	public int hashCode() {
		final int prime = 31;
		int result = 1;
		result = prime * result + armyId;
		result = prime * result + Float.floatToIntBits(currentHp);
		result = prime * result + id;
		result = prime * result + Float.floatToIntBits(maxHp);
		result = prime * result
				+ ((unitSpec == null) ? 0 : unitSpec.hashCode());
		result = prime * result + Float.floatToIntBits(x);
		result = prime * result + Float.floatToIntBits(y);
		result = prime * result + Float.floatToIntBits(z);
		return result;
	}

	@Override
	public boolean equals(Object obj) {
		if (this == obj)
			return true;
		if (obj == null)
			return false;
		if (getClass() != obj.getClass())
			return false;
		FullUnitInfo other = (FullUnitInfo) obj;
		if (armyId != other.armyId)
			return false;
		if (Float.floatToIntBits(currentHp) != Float
				.floatToIntBits(other.currentHp))
			return false;
		if (id != other.id)
			return false;
		if (Float.floatToIntBits(maxHp) != Float.floatToIntBits(other.maxHp))
			return false;
		if (unitSpec == null) {
			if (other.unitSpec != null)
				return false;
		} else if (!unitSpec.equals(other.unitSpec))
			return false;
		if (Float.floatToIntBits(x) != Float.floatToIntBits(other.x))
			return false;
		if (Float.floatToIntBits(y) != Float.floatToIntBits(other.y))
			return false;
		if (Float.floatToIntBits(z) != Float.floatToIntBits(other.z))
			return false;
		return true;
	}
}