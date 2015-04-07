package info.nanodesu.webservice;

import info.nanodesu.reader.B79896Accessor;
import info.nanodesu.reader.PaClientMemoryAccessor;

import java.util.logging.Level;

import org.restlet.Application;
import org.restlet.Component;
import org.restlet.Restlet;
import org.restlet.data.Protocol;
import org.restlet.engine.Engine;
import org.restlet.routing.Router;

public class MemoryApiWebservice extends Application {

	public static void main(String[] args) throws Exception {
		Engine.setLogLevel(Level.WARNING);
		Component component = new Component();
		component.getServers().add(Protocol.HTTP, 8184);
		component.getDefaultHost().attach("/pa",
				new MemoryApiWebservice(7468));
		component.start();
	}

	private PaClientMemoryAccessor pa;
	
	public MemoryApiWebservice(int pid) {
		System.out.println("TODO: detect pid and version");
		pa = new B79896Accessor(pid);
		pa.attach();
		if (!pa.isAttached()) {
			throw new RuntimeException("Could not attach to process with pid "+pid);
		}
		pa.detach();
	}
	
	@Override
	public Restlet createInboundRoot() {
		Router router = new Router(getContext());
		router.attach(
				"/updateId/{updateId}/minPositionChange/{minPositionChange}",
				new DeltaCompressedUnits(getContext(), pa));
		return router;
	}
}