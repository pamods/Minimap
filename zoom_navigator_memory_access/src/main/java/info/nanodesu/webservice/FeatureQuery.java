package info.nanodesu.webservice;

import java.util.List;
import java.util.Map;

import info.nanodesu.reader.FeatureLocation;
import info.nanodesu.reader.PaClientMemoryAccessor;
import info.nanodesu.reader.patches.PaClientAccessor;

import org.restlet.Context;
import org.restlet.Request;
import org.restlet.Response;
import org.restlet.Restlet;
import org.restlet.data.MediaType;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

public class FeatureQuery extends Restlet {
	
	private static final ObjectMapper mapper = new ObjectMapper();
	
	private PaClientMemoryAccessor pa;
	
	public FeatureQuery(Context context, Map<String, Object> c) {
		super(context);
		this.pa = new PaClientAccessor();
		this.pa.setConfigMap(c);
	}
	
	@Override
	public void handle(Request request, Response response) {
		String key = (String) request.getAttributes().get("features");
		List<FeatureLocation> lst = null;
		pa.attach();
		try {
			lst = pa.readFeatureLocations(key);
		} finally {
			pa.detach();
		}
		
		try {
			response.setEntity(mapper.writeValueAsString(lst), MediaType.APPLICATION_JSON);
		} catch (JsonProcessingException e) {
			throw new RuntimeException(e);
		}
	}
}
