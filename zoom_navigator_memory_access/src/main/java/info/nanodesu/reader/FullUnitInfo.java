package info.nanodesu.reader;

import java.util.Collections;
import java.util.List;

public class FullUnitInfo {
	private int id;
	private String spec;
	private int army;
	private float x;
	private float y;
	private float z;
	private int planetId;
	private float currentHp;
	private float maxHp;
	
	private List<Integer> commands = Collections.emptyList();
	
	public List<Integer> getCommandIds() {
		return commands;
	}

	public void setCommandIds(List<Integer> commands) {
		this.commands = commands;
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
		return "FullUnitInfo [id=" + id + ", spec=" + spec + ", army=" + army
				+ ", x=" + x + ", y=" + y + ", z=" + z + ", planetId="
				+ planetId + ", currentHp=" + currentHp + ", maxHp=" + maxHp
				+ ", commands=" + commands + "]";
	}

	@Override
	public int hashCode() {
		final int prime = 31;
		int result = 1;
		result = prime * result + army;
		result = prime * result
				+ ((commands == null) ? 0 : commands.hashCode());
		result = prime * result + Float.floatToIntBits(currentHp);
		result = prime * result + id;
		result = prime * result + Float.floatToIntBits(maxHp);
		result = prime * result + planetId;
		result = prime * result + ((spec == null) ? 0 : spec.hashCode());
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
		if (commands == null) {
			if (other.commands != null)
				return false;
		} else if (!commands.equals(other.commands))
			return false;
		if (Float.floatToIntBits(currentHp) != Float
				.floatToIntBits(other.currentHp))
			return false;
		if (id != other.id)
			return false;
		if (Float.floatToIntBits(maxHp) != Float.floatToIntBits(other.maxHp))
			return false;
		if (planetId != other.planetId)
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