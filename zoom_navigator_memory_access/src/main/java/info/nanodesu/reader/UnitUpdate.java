package info.nanodesu.reader;

public class UnitUpdate {
	private int id;
	private float x;
	private float y;
	private float z;
	private float planetId;
	private float currentHp;
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
	@Override
	public String toString() {
		return "UnitUpdate [id=" + id + ", x=" + x + ", y=" + y + ", z=" + z
				+ ", currentHp=" + currentHp + "]";
	}
	@Override
	public int hashCode() {
		final int prime = 31;
		int result = 1;
		result = prime * result + Float.floatToIntBits(currentHp);
		result = prime * result + id;
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
		UnitUpdate other = (UnitUpdate) obj;
		if (Float.floatToIntBits(currentHp) != Float
				.floatToIntBits(other.currentHp))
			return false;
		if (id != other.id)
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