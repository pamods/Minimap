package info.nanodesu.reader;

import java.util.List;

public class UnitUpdate {
	private int id;
	private float x;
	private float y;
	private float z;
	private int planetId;
	private float currentHp;

	// null => do not set
	// list => overwrite state in the client with new commands
	private List<Integer> newCommands;
	
	public List<Integer> getNewCommandIds() {
		return newCommands;
	}
	public void setNewCommandIds(List<Integer> newCommands) {
		this.newCommands = newCommands;
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
	public float getCurrentHp() {
		return currentHp;
	}
	public void setCurrentHp(float currentHp) {
		this.currentHp = currentHp;
	}
	
	@Override
	public String toString() {
		return "UnitUpdate [id=" + id + ", x=" + x + ", y=" + y + ", z=" + z
				+ ", planetId=" + planetId + ", currentHp=" + currentHp
				+ ", newCommands=" + newCommands + "]";
	}
	@Override
	public int hashCode() {
		final int prime = 31;
		int result = 1;
		result = prime * result + Float.floatToIntBits(currentHp);
		result = prime * result + id;
		result = prime * result
				+ ((newCommands == null) ? 0 : newCommands.hashCode());
		result = prime * result + planetId;
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
		if (newCommands == null) {
			if (other.newCommands != null)
				return false;
		} else if (!newCommands.equals(other.newCommands))
			return false;
		if (planetId != other.planetId)
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