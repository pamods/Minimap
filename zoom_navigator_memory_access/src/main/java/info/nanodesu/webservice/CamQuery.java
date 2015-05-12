package info.nanodesu.webservice;

import info.nanodesu.reader.CamPosition;
import info.nanodesu.reader.PaClientMemoryAccessor;

import org.restlet.Context;
import org.restlet.Request;
import org.restlet.Response;
import org.restlet.Restlet;
import org.restlet.data.MediaType;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

public class CamQuery extends Restlet {
	private static final ObjectMapper mapper = new ObjectMapper();
	
	private PaClientMemoryAccessor pa;
	
	public CamQuery(Context context, PaClientMemoryAccessor pa) {
		super(context);
		this.pa = pa;
	}
	
	@Override
	public void handle(Request request, Response response) {
		int hdeck = Integer.parseInt((String)request.getAttributes().get("hdeck"));
		CamPosition position = null;
		
		synchronized(pa) {
			pa.attach();
			try {
				position = pa.readCamPosition(hdeck);
			} finally {
				pa.detach();
			}
		}
		
		try {
			response.setEntity(mapper.writeValueAsString(position), MediaType.APPLICATION_JSON);
		} catch (JsonProcessingException e) {
			throw new RuntimeException(e);
		}
		
	}
}
