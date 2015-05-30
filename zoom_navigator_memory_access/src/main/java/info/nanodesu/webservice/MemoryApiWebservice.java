package info.nanodesu.webservice;

import info.nanodesu.lib.Memory64API;
import info.nanodesu.lib.ObservableMap;
import info.nanodesu.lib.ObservableMap.PutListener;
import info.nanodesu.lib.windows.Windows64MemoryAPI;
import info.nanodesu.reader.PaClientAccessor;
import info.nanodesu.reader.PaClientAccessorConstants;

import java.awt.BorderLayout;
import java.awt.Dimension;
import java.awt.EventQueue;
import java.awt.event.ItemEvent;
import java.awt.event.ItemListener;
import java.io.IOException;
import java.io.OutputStream;
import java.io.PrintStream;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.Map.Entry;
import java.util.logging.Level;

import javax.swing.JCheckBox;
import javax.swing.JComboBox;
import javax.swing.JFrame;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTextArea;
import javax.swing.JTextField;
import javax.swing.ToolTipManager;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import javax.swing.event.DocumentEvent;
import javax.swing.event.DocumentListener;

import org.restlet.Application;
import org.restlet.Component;
import org.restlet.Restlet;
import org.restlet.data.Protocol;
import org.restlet.engine.Engine;
import org.restlet.routing.Router;

import com.sun.jna.Platform;

public class MemoryApiWebservice extends Application {
	
	private static final String AUTODISCOVER = "autodiscover";

	public static Memory64API initNativeApi() {
		if (Platform.isWindows() && Platform.is64Bit()) {
			return new Windows64MemoryAPI();
		} else {
			System.out.println("ERROR: currently only windows 64 bit is supported");
			return null;
		}
	}
	
	public static boolean attemptToFillInPid(Map<String, Object> config) {
		try {
			config.put(PaClientAccessor.PID_KEY, initNativeApi().findPAProcess());
		} catch (Exception ex) {
			System.out.println("Cannot find PA client process");
			return false;
		}
		return true;
	}
	
	public static boolean attemptToFillInVersion(Map<String, Object> config) {
		try {
			String version = initNativeApi().findPAVersion((int) config.get(PaClientAccessor.PID_KEY));
			if (PaClientAccessorConstants.getSupportedVersions().contains(version)) {
				config.put(PaClientAccessor.VERSION_KEY, version);
			} else {
				System.out.println("!!! found PA version " + version + " which is not supported. You may try to select a version by hand and "
						+ "attempt to handle your PA like that version with a little chance for success. !!!");
				return false;
			}
		} catch (Exception ex) {
			System.out.println("error reading version");
			ex.printStackTrace();
			return false;
		}
		return true;
	}
	
	public static void main(String[] args) throws Exception {
		
		Integer forcedPid = null;
		String forceVersion = null;
		boolean headless = false;
		int port = 8184;
		
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
			if (args[i] == "-port" && args.length > i+1) {
				port = Integer.parseInt(args[i+1]);
				System.out.println("will use port provided by arguments: "+port);
			}
		}
		
		final ObservableMap<String, Object> configMap = new ObservableMap<>();
		if (forcedPid != null) {
			configMap.put(PaClientAccessor.PID_KEY, forcedPid);
		}
		if (forceVersion != null) {
			configMap.put(PaClientAccessor.VERSION_KEY, forceVersion);
		}
		configMap.put(AUTODISCOVER, true);
		
		if (!headless) {
			EventQueue.invokeAndWait(new Runnable() {
				@Override
				public void run() {
					ToolTipManager.sharedInstance().setDismissDelay(120 * 10000);
					
					JFrame frm = new JFrame();
					frm.setTitle("PA Memory Accessor");
					frm.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
					
					final JCheckBox autoCheck = new JCheckBox();
					autoCheck.setSelected((boolean) configMap.get(AUTODISCOVER));
					autoCheck.addChangeListener(new ChangeListener() {
						@Override
						public void stateChanged(ChangeEvent e) {
							configMap.put(AUTODISCOVER, autoCheck.isSelected());
						}
					});
					autoCheck.setText("Automatic PA Client discovery");
					autoCheck.setToolTipText("Attempts to automatically detect the pid and version. Does overwrite values only if successful.");
					
					final JTextField pidInput = new JTextField();
					pidInput.setToolTipText("The pid of the PA process. Be nice and enter a valid pid integer or get Exceptions thrown at you.");
					pidInput.getDocument().addDocumentListener(new DocumentListener() {
						private void update() {
							EventQueue.invokeLater(new Runnable() {
								@Override
								public void run() {
									configMap.put(PaClientAccessor.PID_KEY, Integer.parseInt(pidInput.getText()));
								}
							});
						}
						@Override
						public void removeUpdate(DocumentEvent e) {
							update();
						}
						@Override
						public void insertUpdate(DocumentEvent e) {
							update();
						}
						@Override
						public void changedUpdate(DocumentEvent e) {
							update();
						}
					});
					
					final JComboBox<String> versionInput = new JComboBox<>(PaClientAccessorConstants.getSupportedVersions().toArray(new String[]{}));
					versionInput.setSelectedIndex(versionInput.getItemCount()-1);
					versionInput.setToolTipText("The version of PA you are trying to access. When your PA version is not listed you are likely out of luck, but you may try the available versions.");
					versionInput.addItemListener(new ItemListener() {
						@Override
						public void itemStateChanged(ItemEvent e) {
							if (e.getID() == ItemEvent.SELECTED) {
								String v = (String) e.getItem();
								configMap.put(PaClientAccessor.VERSION_KEY, v);
							}
						}
					});
					
					configMap.addListener(new PutListener<String, Object>() {
						@Override
						public void putEvent(final String k, final Object v) {
							EventQueue.invokeLater(new Runnable() {
								@Override
								public void run() {
									switch(k) {
									case PaClientAccessor.PID_KEY:
										pidInput.setText(v+"");
										break;
									case PaClientAccessor.VERSION_KEY:
										versionInput.setSelectedItem(v);
										break;
									case AUTODISCOVER:
										autoCheck.setSelected((boolean) v);
										break;
									}
								}
							});
						}
					});
					
					JPanel head = new JPanel(new BorderLayout());
					head.add(autoCheck, BorderLayout.WEST);
					JPanel labeled = new JPanel(new BorderLayout());
					labeled.add(new JLabel("PID"), BorderLayout.WEST);
					labeled.add(pidInput, BorderLayout.CENTER);
					head.add(labeled, BorderLayout.CENTER);
					head.add(versionInput, BorderLayout.EAST);
					
					JPanel content = new JPanel(new BorderLayout());
					content.add(head, BorderLayout.NORTH);
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
					frm.setSize(new Dimension(1200, 600));
					frm.setLocationRelativeTo(null);
					frm.setVisible(true);
				}
			});
		}
		
		Engine.setLogLevel(Level.WARNING);
		Component component = new Component();
		component.getServers().add(Protocol.HTTP, port);
		MemoryApiWebservice target = new MemoryApiWebservice(configMap);
		component.getDefaultHost().attach("/pa", target);
		component.start();
		
		System.out.println("Started webservices");
		for (Entry<String, Restlet> e: target.getWebservices().entrySet()) {
			System.out.println(e.getValue().getClass().getSimpleName() + ": http://127.0.0.1:"+port+"/pa" + e.getKey());
		}
		
		boolean pidSuccess = false;
		int wTime = 3000;
		do {
			if ((boolean) configMap.get(AUTODISCOVER)) {
				if (!attemptToFillInPid(configMap)) {
					if (pidSuccess) {
						System.out.println("could not automatically determine pid of PA. Maybe it is not running? Try to enter the pid by hand if this persists");
						System.out.println("Unless you disable automatic discovery of PA this program will continue to poll for a PA client");
						pidSuccess = false;
					}
					wTime = 3000;
				} else {
					if (!pidSuccess) {
						System.out.println("found PA process with pid " + configMap.get(PaClientAccessor.PID_KEY));
						if (!attemptToFillInVersion(configMap)) {
							System.out.println("could not automatically determine version. Maybe there is a rights problem with your version.txt file. This process needs to be allowed to read it. Try to select the version by hand if this persists");
						} else {
							System.out.println("automatically determined PA version to be " + configMap.get(PaClientAccessor.VERSION_KEY));
						}
						pidSuccess = true;
					}
					wTime = 10000;
				}
			}
			Thread.sleep(wTime);
		} while(true);
	}
	
	private Map<String, Object> config;
	private Map<String, Restlet> services;
	
	public MemoryApiWebservice(Map<String, Object> c) {
		config = c;
		services = new HashMap<>();
		services.put("/updateId/{updateId}/minPositionChange/{minPositionChange}", new DeltaCompressedUnits(getContext(), config));
		services.put("/query/features/{features}", new FeatureQuery(getContext(), config));
		services.put("/query/holodeck/cam/{hdeck}", new CamQuery(getContext(), config));
	}
	
	public Map<String, Restlet> getWebservices() {
		return Collections.unmodifiableMap(services);
	}
	
	@Override
	public Restlet createInboundRoot() {
		Router router = new Router(getContext());
		
		for (Entry<String, Restlet> e: services.entrySet()) {
			router.attach(e.getKey(), e.getValue());
		}
		
		return router;
	}
}