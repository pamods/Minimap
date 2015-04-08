package info.nanodesu.webservice;

import info.nanodesu.lib.Memory64API;
import info.nanodesu.lib.windows.Windows64MemoryAPI;
import info.nanodesu.reader.PaClientMemoryAccessor;
import info.nanodesu.reader.patches.B79896Accessor;
import info.nanodesu.reader.patches.B80187Accessor;

import java.util.logging.Level;

import org.restlet.Application;
import org.restlet.Component;
import org.restlet.Restlet;
import org.restlet.data.Protocol;
import org.restlet.engine.Engine;
import org.restlet.routing.Router;

import com.sun.jna.Platform;

public class MemoryApiWebservice extends Application {
	
	public static PaClientMemoryAccessor findAccessor(Integer useProcessId, String version) {
		Memory64API api = null;
		if (Platform.isWindows() && Platform.is64Bit()) {
			api = new Windows64MemoryAPI();
		} else {
			System.out.println("ERROR: currently only windows 64 bit is supported");
			return null;
		}
		
		if (useProcessId == null) {
			useProcessId = api.findPAProcess();
			System.out.println("automatically detected PA Client pid "+useProcessId);
		}
		
		if (version == null) {
			version = api.findPAVersion(useProcessId).trim();
			System.out.println("automatically detected PA Client version "+version);
		}
		
		switch (version) {
		case "79896-pte":
		case "80155-pte":
			return new B79896Accessor(useProcessId);
		case "80187":
			return new B80187Accessor(useProcessId);
		default:
			System.out.println("ERROR: version "+version+ " is not supported");
			return null;
		}
	}
	
	public static void main(String[] args) throws Exception {
//		args = new String[]{"-pid", "1924", "-version", "80187"};
		Integer forcedPid = null;
		String forceVersion = null;
		
		for (int i = 0; i < args.length; i++) {
			if (args[i] == "-version" && args.length > i+1) {
				forceVersion = args[i+1];
				System.out.println("will use version provided by arguments: "+forceVersion);
			}
			if (args[i] == "-pid" && args.length > i+1) {
				forcedPid = Integer.parseInt(args[i+1]);
				System.out.println("will use pid provided by arguments: "+forcedPid);
			}
		}

		PaClientMemoryAccessor pa = findAccessor(forcedPid, forceVersion);
		
		if (pa != null) {
			System.out.println("version appears to be supported, starting webservice");
			Engine.setLogLevel(Level.WARNING);
			Component component = new Component();
			component.getServers().add(Protocol.HTTP, 8184);
			component.getDefaultHost().attach("/pa",
					new MemoryApiWebservice(pa));
			component.start();
		} else {
			System.out.println("could not find supported PA Client");
		}
	}

	private PaClientMemoryAccessor pa;
	
	public MemoryApiWebservice(PaClientMemoryAccessor pa) {
		this.pa = pa;
		testAttach(pa);
	}

	private void testAttach(PaClientMemoryAccessor pa) {
		pa.attach();
		if (!pa.isAttached()) {
			throw new RuntimeException("Could not attach to process");
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