package info.nanodesu.webservice;

import info.nanodesu.lib.Memory64API;
import info.nanodesu.lib.windows.Windows64MemoryAPI;
import info.nanodesu.reader.PaClientMemoryAccessor;
import info.nanodesu.reader.patches.B79896Accessor;
import info.nanodesu.reader.patches.B80684Accessor;

import java.awt.BorderLayout;
import java.awt.Dimension;
import java.awt.EventQueue;
import java.io.IOException;
import java.io.OutputStream;
import java.io.PrintStream;
import java.util.logging.Level;

import javax.swing.JFrame;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTextArea;

import org.restlet.Application;
import org.restlet.Component;
import org.restlet.Restlet;
import org.restlet.data.Protocol;
import org.restlet.engine.Engine;
import org.restlet.routing.Router;

import com.sun.jna.Platform;

public class MemoryApiWebservice extends Application {
	
	public static Memory64API initNativeApi() {
		if (Platform.isWindows() && Platform.is64Bit()) {
			return new Windows64MemoryAPI();
		} else {
			System.out.println("ERROR: currently only windows 64 bit is supported");
			return null;
		}
	}
	
	public static PaClientMemoryAccessor findAccessor(Integer useProcessId, String version) {
		Memory64API api = initNativeApi();
		
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
		case "80187":
		case "80462":
			return new B79896Accessor(useProcessId);
		case "80684-pte":
		case "81029-pte":
			return new B80684Accessor(useProcessId);
		default:
			System.out.println("WARNING !!! : version "+version+ " is not tested and might not work.");
			return new B80684Accessor(useProcessId);
		}
	}
	
	public static void waitForPA() {
		Memory64API api = initNativeApi();
		while(true) {
			try {
				Thread.sleep(1000);
				api.findPAProcess();
				break;
			} catch (Exception ex) {
				// did not find pa.
				System.out.println("cannot find a running PA so far");
			}
		}
	}
	
	public static void main(String[] args) throws Exception {
		
		Integer forcedPid = null;
		String forceVersion = null;
		boolean headless = false;
		
		for (int i = 0; i < args.length; i++) {
			if (args[i] == "-version" && args.length > i+1) {
				forceVersion = args[i+1];
				System.out.println("will use version provided by arguments: "+forceVersion);
			}
			if (args[i] == "-pid" && args.length > i+1) {
				forcedPid = Integer.parseInt(args[i+1]);
				System.out.println("will use pid provided by arguments: "+forcedPid);
			}
			if (args[i] == "-headless") {
				headless = true;
			}
		}
		
		if (!headless) {
			EventQueue.invokeAndWait(new Runnable() {
				@Override
				public void run() {
					JFrame frm = new JFrame();
					frm.setTitle("PA Memory Accessor");
					frm.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
					JPanel content = new JPanel(new BorderLayout());
					frm.add(content);
					final JTextArea txt = new JTextArea();
					final JScrollPane scroll = new JScrollPane(txt);
					txt.setEditable(false);
					content.add(scroll, BorderLayout.CENTER);
					PrintStream txtAreaStream = new PrintStream(new OutputStream() {
						@Override
						public void write(int b) throws IOException {
							txt.append((char) b + "");
							txt.setCaretPosition(txt.getDocument().getLength());
						}
					});
					System.setOut(txtAreaStream);
					System.setErr(txtAreaStream);
					frm.setSize(new Dimension(800, 600));
					frm.setLocationRelativeTo(null);
					frm.setVisible(true);
				}
			});
		}

		if (forcedPid == null) {
			waitForPA();
		}
		
		PaClientMemoryAccessor pa = findAccessor(forcedPid, forceVersion);
		
		if (pa != null) {
			int port = 8184;
			System.out.println("version appears to be supported, starting webservice on http://127.0.0.1:"+port+"/pa/updateId/0/minPositionChange/1.5");
			Engine.setLogLevel(Level.WARNING);
			Component component = new Component();
			component.getServers().add(Protocol.HTTP, port);
			component.getDefaultHost().attach("/pa",
					new MemoryApiWebservice(pa));
			component.start();
		} else {
			System.out.println("could not find supported PA Client");
		}
		
		if (forcedPid == null) {
			Memory64API api = initNativeApi();
			int wTime = 15000;
			while(true) {
				try {
					Thread.sleep(wTime);
					int p = api.findPAProcess();
					wTime = 15000;
					if (p != pa.getPid()) {
						System.out.println("found a new pid for pa.exe, switching over to "+p);
						pa.updatePid(p);
					}
				} catch (Exception ex) {
					wTime = 1000;
					System.out.println("lost PA process, trying to find it again...");
				}
			}
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
		router.attach("/query/features/{features}", new FeatureQuery(getContext(), pa));
		return router;
	}
}