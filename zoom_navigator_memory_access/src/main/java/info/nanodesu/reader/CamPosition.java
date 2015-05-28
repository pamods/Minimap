package info.nanodesu.reader;

public class CamPosition {
	private float x;
	private float y;
	private float z;
	private int planet;
	private boolean validPosition;
	private String debugAddress;
	
	public CamPosition() {
		validPosition = false;
	}
	
	public void setDebugAddress(String debugAddress) {
		this.debugAddress = debugAddress;
	}
	
	public String getDebugAddress() {
		return debugAddress;
	}
	
	public void setValidPosition(boolean validPosition) {
		this.validPosition = validPosition;
	}
	public boolean isValidPosition() {
		return validPosition;
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
	public int getPlanet() {
		return planet;
	}
	public void setPlanet(int planet) {
		this.planet = planet;
	}

	@Override
	public int hashCode() {
		final int prime = 31;
		int result = 1;
		result = prime * result + planet;
		result = prime * result + (validPosition ? 1231 : 1237);
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
		CamPosition other = (CamPosition) obj;
		if (planet != other.planet)
			return false;
		if (validPosition != other.validPosition)
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
		return "CamPosition [x=" + x + ", y=" + y + ", z=" + z + ", planet="
				+ planet + ", validPosition=" + validPosition + "]";
	}

	
}
