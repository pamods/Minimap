var makeSelector = (function() {
	var html = '<div id="dragmask" class="highlight-drag"></div>';
	
	$('body').append(html);
	
	var isHighlightEnabled = true;
	var listeners = [];
	var startX, startY;
	var isDragging = false;
	
	return {
		bindToElement: function(elemSelector) {
			$(elemSelector).mousedown(function(event){
			    if(event.button === 0 && isHighlightEnabled){
			        startX = event.pageX;
			        startY = event.pageY;
			        isDragging = true;
			        // prevent default behavior of text selection
			        //return false;
			    }
			});
			
			$(elemSelector).mousemove(function(event){
			    if(isDragging){
			        var left, top, width, height;
			        if(event.pageX>startX){
			            left = startX;
			            width = event.pageX - startX;
			        }
			        else {
			            left = event.pageX;
			            width = startX - event.pageX;
			        }
			        if(event.pageY>startY){
			            top = startY;
			            height = event.pageY - startY;
			        }
			        else {
			            top = event.pageY;
			            height = startY - event.pageY;
			        }

			        $("#dragmask").css(
				            {
				                'left'   :    left,
				                'top'    :    top,
				                'width'  :    width,
				                'height' :    height
				            }
				        );
			        
			        if (width * height > 25) {
				        $("#dragmask").show();
				        return false;
			        }
			    }
			});
			
			$(elemSelector).mouseup(function(event){
			    if(event.button === 0 && isDragging){
			        isDragging = false;
			        $("#dragmask").hide();
			        var screenWidth = $(document).width();
			        var screenHeight = $(document).height();
			        var topOfHighlight, bottomOfHighlight;
			        if(event.pageY>startY){
			            topOfHighlight = startY;
			            bottomOfHighlight = event.pageY;
			        }
			        else{
			            topOfHighlight = event.pageY;
			            bottomOfHighlight = startY;
			        }
			        var leftOfHighlight, rightOfHighlight;
			        if(event.pageX>startX){
			            leftOfHighlight = startX;
			            rightOfHighlight = event.pageX;
			        } else {
			            leftOfHighlight = event.pageX;
			            rightOfHighlight = startX;
			        }
			        
			        var w = rightOfHighlight-leftOfHighlight;
			        var h = bottomOfHighlight-topOfHighlight;
			        
			        if (w * h > 25) {
				        for (var i = 0; i < listeners.length; i++) {
				        	listeners[i](leftOfHighlight, topOfHighlight, w, h);
				        }
			        }
			    }
			});
		},
		addListener: function(listener) {
			listeners.push(listener);
		},
		setEnabled: function(en) {
			isHighlightEnabled = en;
			if (!isHighlightEnabled && isDragging) {
				isDragging = false;
				$("#dragmask").hide();
			}
		}
	};
});

console.log("loaded selector.js");