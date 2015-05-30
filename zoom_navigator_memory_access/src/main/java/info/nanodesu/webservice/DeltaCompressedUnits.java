package info.nanodesu.webservice;

import info.nanodesu.reader.PaClientAccessor;
import info.nanodesu.reader.PaUnitInfoUpdate;
import info.nanodesu.reader.PaUnitsChangeDetector;

import java.util.Map;

import org.restlet.Context;
import org.restlet.Request;
import org.restlet.Response;
import org.restlet.Restlet;
import org.restlet.data.MediaType;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

public class DeltaCompressedUnits extends Restlet {
	
	private static final ObjectMapper mapper = new ObjectMapper();
	
	private PaUnitsChangeDetector changeDetector;
	
	public DeltaCompressedUnits(Context context, Map<String, Object> c) {
		super(context);
		changeDetector = new PaUnitsChangeDetector(new PaClientAccessor());
		changeDetector.getAccessor().setConfigMap(c);
	}
	
	@Override
	public void handle(Request req, Response resp) {
		long updateId = Long.parseLong(req.getAttributes().get("updateId") + "");
		float minPositionChange = Float.parseFloat(req.getAttributes().get("minPositionChange") + "");
		
		PaUnitInfoUpdate update = changeDetector.generateUpdate(updateId, minPositionChange);
		
//		update.printStats();
		
		try {
			resp.setEntity(mapper.writeValueAsString(update), MediaType.APPLICATION_JSON);
		} catch (JsonProcessingException e) {
			throw new RuntimeException(e);
		}
	}
}
