package info.nanodesu.reader;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class PaUnitInfoUpdate {

	private static Object mutex = new Object();
	private static long updateIdBase = System.currentTimeMillis();
	
	private long updateId;
	
	private List<FullUnitInfo> addedUnits;
	private List<UnitCommand> addedCommands;
	private List<UnitCommand> updatedCommands;
	private List<UnitUpdate> updatedUnits;
	private Set<Integer> removedUnits;
	private Set<Integer> removedCommands;
	private boolean reset;
	
	public PaUnitInfoUpdate() {
		addedUnits = new ArrayList<>();
		updatedUnits = new ArrayList<>();
		removedUnits = new HashSet<>();
		addedCommands = new ArrayList<>();
		removedCommands = new HashSet<>();
		updatedCommands = new ArrayList<>();
		reset = false;
		
		synchronized(mutex) {
			updateId = updateIdBase;
			updateIdBase++;
		}
	}
	
	public void printStats() {
		System.out.println("Update stats");
		System.out.println("Added units: " + addedUnits.size());
		System.out.println("Added commands: " + addedCommands.size());
		System.out.println("Updated commands: " + updatedCommands.size());
		System.out.println("Updated units: " + updatedUnits.size());
		System.out.println("Removed Units: " + removedUnits.size());
		System.out.println("Removed Commands: " + removedCommands.size());
	}
	
	public boolean isReset() {
		return reset;
	}

	public void setReset(boolean reset) {
		this.reset = reset;
	}

	public long getUpdateId() {
		return updateId;
	}
	public void setUpdateId(int updateId) {
		this.updateId = updateId;
	}
	public List<FullUnitInfo> getAddedUnits() {
		return addedUnits;
	}
	public List<UnitUpdate> getUpdatedUnits() {
		return updatedUnits;
	}
	public Set<Integer> getRemovedUnits() {
		return removedUnits;
	}
	
	public List<UnitCommand> getAddedCommands() {
		return addedCommands;
	}
	
	public Set<Integer> getRemovedCommands() {
		return removedCommands;
	}
	public List<UnitCommand> getUpdatedCommands() {
		return updatedCommands;
	}
	@Override
	public String toString() {
		return "PaUnitInfoUpdate [updateId=" + updateId + ", addedUnits="
				+ addedUnits + ", addedCommands=" + addedCommands
				+ ", updatedUnits=" + updatedUnits + ", removedUnits="
				+ removedUnits + ", removedCommands=" + removedCommands
				+ ", reset=" + reset + "]";
	}
}
