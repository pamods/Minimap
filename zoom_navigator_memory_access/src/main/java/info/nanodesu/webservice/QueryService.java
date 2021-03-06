package info.nanodesu.webservice;

import info.nanodesu.reader.UnitsReader;

import org.restlet.Server;
import org.restlet.data.Protocol;
import org.restlet.resource.Get;
import org.restlet.resource.ServerResource;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

// legacy stuff
public class QueryService extends ServerResource {
    public static void main(String[] args) throws Exception {
        new Server(Protocol.HTTP, 8184, QueryService.class).start();
    }
    
    public static int baseAdr = 0x2BBFE38;
    public static int pid = 10192;
    
    public static ObjectMapper mapper = new ObjectMapper();
    
    @Get("txt")
    public String getUnitsInfo() {
    	UnitsReader reader = new UnitsReader(baseAdr);
    	reader.log = false;
    	String result = "";
    	try {
			if (reader.open(pid)) {
				result = mapper.writeValueAsString(reader.getUnitsMap());
			} else {
				System.out.println("could not open server process with pid " + pid);
			}
		} catch (JsonProcessingException e) {
			e.printStackTrace();
		} finally {
			reader.close();
		}
    	return result;
    }
}
