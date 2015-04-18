package info.nanodesu.reader;

public class FullUnitInfo {
	private int id;
	private String spec;
	private int army;
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

	public String getSpec() {
		return spec;
	}

	public void setSpec(String unitSpec) {
		this.spec = unitSpec;
	}

	public int getArmy() {
		return army;
	}

	public void setArmy(int armyId) {
		this.army = armyId;
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
		return "UnitAdd [id=" + id + ", unitSpec=" + spec + ", armyId="
				+ army + ", x=" + x + ", y=" + y + ", z=" + z
				+ ", currentHp=" + currentHp + ", maxHp=" + maxHp + "]";
	}

	@Override
	public int hashCode() {
		final int prime = 31;
		int result = 1;
		result = prime * result + army;
		result = prime * result + Float.floatToIntBits(currentHp);
		result = prime * result + id;
		result = prime * result + Float.floatToIntBits(maxHp);
		result = prime * result
				+ ((spec == null) ? 0 : spec.hashCode());
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
		if (army != other.army)
			return false;
		if (Float.floatToIntBits(currentHp) != Float
				.floatToIntBits(other.currentHp))
			return false;
		if (id != other.id)
			return false;
		if (Float.floatToIntBits(maxHp) != Float.floatToIntBits(other.maxHp))
			return false;
		if (spec == null) {
			if (other.spec != null)
				return false;
		} else if (!spec.equals(other.spec))
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