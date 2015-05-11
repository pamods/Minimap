package info.nanodesu.reader;

public class UnitCommand {
	private int id;
	private float x;
	private float y;
	private float z;
	private int planetId;
	private byte type;
	
	public byte getType() {
		return type;
	}
	public void setType(byte type) {
		this.type = type;
	}
	public int getPlanetId() {
		return planetId;
	}
	public void setPlanetId(int planetId) {
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
	@Override
	public int hashCode() {
		final int prime = 31;
		int result = 1;
		result = prime * result + id;
		result = prime * result + planetId;
		result = prime * result + type;
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
		UnitCommand other = (UnitCommand) obj;
		if (id != other.id)
			return false;
		if (planetId != other.planetId)
			return false;
		if (type != other.type)
			return false;
		if (Float.floatToIntBits(x) != Float.floatToIntBits(other.x))
			return false;
		if (Float.floatToIntBits(y) != Float.floatToIntBits(other.y))
			return false;
		if (Float.floatToIntBits(z) != Float.floatToIntBits(other.z))
			return false;
		return true;
	}
	@Override
	public String toString() {
		return "UnitCommand [id=" + id + ", x=" + x + ", y=" + y + ", z=" + z
				+ ", planetId=" + planetId + ", type=" + type + "]";
	}
	
	
	
}
