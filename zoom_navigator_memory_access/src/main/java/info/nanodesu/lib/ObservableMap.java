package info.nanodesu.lib;

import java.util.List;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

public class ObservableMap<K, V> extends ConcurrentHashMap<K, V>{
	public static interface PutListener<K, V> {
		void putEvent(K k, V v);
	}
	
	private static final long serialVersionUID = -5120918423245586921L;
	
	private List<PutListener<K, V>> listeners;
	
	public ObservableMap() {
		listeners = new CopyOnWriteArrayList<>();
	}
	
	public void addListener(PutListener<K, V> l) {
		listeners.add(l);
	}
	
	public void removeListener(PutListener<K, V> l) {
		listeners.remove(l);
	}
	
	@Override
	public V put(K key, V value) {
		V v = super.put(key, value);
		if (!Objects.equals(v, value)) {
			for (PutListener<K, V> l: listeners) {
					l.putEvent(key, value);
			}
		}
		return v;
	}
}
