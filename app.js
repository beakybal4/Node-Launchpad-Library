var Launchpad = function(midiPort){
	var midi = require('midi');
	var lp = this;
	var midiPort = midiPort || 0;
	var mappings = {}; 

	// yellow low and medium are debatably wrong
	this.colors =  {
		off: 0,
		red: {
			low: 1,
			medium:2,
			high:3
		},
		yellow: {
			low: 29,
			medium:62,
			high:63
		},
		orange: {
			low: 45,
			medium:46,
			high:23
		},
		green: {
			low: 16,
			medium:32,
			high:48
		}
	};

	var output = new midi.output();
	var input = new midi.input();

	output.openPort(midiPort);
	input.openPort(midiPort);
	
	input.ignoreTypes(false, false, false);

	console.log("opened output to "+output.getPortName(midiPort));

	this.reset = function(){
		sendMessage([176, 0, 0]);
	}

	var currentBuffer = 49;
	var nextBuffer = 52;

	this.bulkUpdate = function(frames){
		var newFrames = [];
		for (var i in frames){
			newFrames.push(frames[i]);
		}
		frames = newFrames;
		var frame = frames.pop();
		if (frame){
			
			var duration = frame.duration;
			var messages = frame.buttons;

			// copy currentBuffer into nextBuffer
			sendMessage([176, 0, currentBuffer]);
			
			// add to nextBuffer
			for (var j in messages){
				lp.update(messages[j]);
			}
			
			// display nextBuffer
			sendMessage([176, 0, nextBuffer]);
			
			// flip the buffers
			var tb = nextBuffer;
			nextBuffer = currentBuffer;
			currentBuffer = tb;
			setTimeout(function(){
				lp.bulkUpdate(frames);
			},duration);
		} else {
			// finished bulk updating
			sendMessage([176, 0, 48]);
		}
		if (frames[0]==null){
			this.reset();
		}
	}

	this.update = function(message){
		var button = lp.coordToButton(message.coords);
		if (message.frames){
			lp.bulkUpdate(message.frames)
		} else if (message.color){
			sendMessage([button[0],button[1],message.color]);
		}
	}

	this.end = function(message){
		var button = lp.coordToButton(message.coords);
		sendMessage([button[0],button[1],0]);
	}

	this.reset();

	// TODO: support animation
	input.on('message', function(deltaTime, message) {
		// console.log('m:' + message + ' d:' + deltaTime);
		var action = message[2]!=0 ? "pressed" : "released";
		var mapping = getMapping(message[0],message[1]);
		if (action=="pressed"){
			// console.log(mapping);
			// console.log("Button "+action+": "+JSON.stringify(getMapping(message[0],message[1])["coords"]));
		}
		if (message[2]!=0){
			if (mapping){
				// start animation
				lp.update(mapping);
			}
		} else {
			// stop animation?
			if (mapping && !mapping.frames){
				lp.end(mapping);
			}
		}
	});

	this.enableFlashing = function(){
		output.sendMessage([176, 0, 40]);
	}

	function sendMessage(message){
		console.log(message);
		output.sendMessage(message);
	}
	var p = 0;
	this.buttonToCoord = function(note){
		var code = note[1];
		var note = note[0];

		var x = note % 8;
		var y = Math.floor(note / 8/ 2);
		if (code!=144){
			y=8
		}
		/*
		if (x==0){
			x=8;
		}
		*/
		return {'x':x, 'y':y};
	}

	this.coordToButton = function(coord){
		if(coord.y == 8)
            return [176,104 + coord.x];
        else
            return [144,(coord.y * 16) + coord.x];
	}

	/**
	 * Set the mapping for the colour each button should change to when pressed. A mapping can optionally contain an animation (array of frames)
	 * [
	 * 	{'coords': {'x':0,'y':0}, 'color': lp.colors.red.high},
	 * 	{'coords': {'x':0,'y':1}, 'color': lp.colors.yellow.high, 'frames': [frame1,frame2] }
	 * ]
	 * @param Object map [description]
	 */
	this.setMappings = function(map){

		var multiMappings = [];
		for (var i in map){
			var mapping = map[i];
			if (mapping.coords.x!="*" && mapping.coords.y!="*"){
				setMapping(mapping);
			} else {
				multiMappings.push(mapping);
			}
		}

		for (var i in multiMappings){
			var resolvedMultiMappings = resolveMultiMappings(multiMappings[i]);
			for (var j in resolvedMultiMappings){
				setMapping(resolvedMultiMappings[j]);
			}
		}

		/*
		var xOverrides = map.filter(function(mapping){
			if (mapping.coords.x=="*" && mapping.coords.y!="*"){return mapping;}
		});
		var yOverrides = map.filter(function(mapping){
			if (mapping.coords.y=="*" && mapping.coords.x!="*"){return mapping;}
		});
		var globalOverrides = map.filter(function(mapping){
			if (mapping.coords.y=="*" && mapping.coords.x=="*"){return mapping;}
		})

		// there MUST be a better way of doing this...
		for (var i in xOverrides){
			var mapping = xOverrides[i];
			for(var x=0; x<9; x++){
				var mapping = {'coords':{'x':x,'y':mapping.coords.y},'color':mapping.color,'frames':mapping.frames};
				setMapping(mapping);
			}
		}
		for (var i in yOverrides){
			var mapping = xOverrides[i];
			for(var y=0; y<9; y++){
				var mapping = {'coords':{'x':mapping.coords.x,'y':y},'color':mapping.color,'frames':mapping.frames};
				setMapping(mapping);
			}
		}
		for (var i in globalOverrides){
			var mapping = globalOverrides[i];
			for(var y=0; y<9; y++){
				for(var x=0; x<9; x++){
					var mapping = {'coords':{'x':x,'y':y},'color':mapping.color,'frames':mapping.frames};
					setMapping(mapping);
				}
			}
		}
		*/
	


	}

	function setMapping(mapping){
		var button = lp.coordToButton(mapping.coords);
		if (!mappings[button]){
			mappings[button] = {};
		}
		mappings[button].coords = mapping.coords;
		mappings[button].color = mapping.color;
		if (mapping.frames){
			for (var i in mapping.frames){
				if (mapping.frames[i]){
					var buttons = mapping.frames[i].buttons;
					var resolvedButtons = [];
					var buttonsToResolve = [];
					for (var j in buttons){
						if (buttons[j].coords.x=="*" || buttons[j].coords.x=="*"){
							buttonsToResolve.push(buttons[j]);
						} else {
							resolvedButtons.push(buttons[j])
						}
					}
					for (var j in buttonsToResolve){
						resolvedButtons.splice(resolveMultiMappings(buttonsToResolve[j]));
					}
					mapping.frames[i].buttons = resolvedButtons;
				}
			}
			mappings[button].frames = mapping.frames;
		}
	}

	function resolveMultiMappings(mapping){
		var toReturn = [];

		if (mapping.coords.y=="*" && mapping.coords.x!="*"){
			for (var y=0; y<9; y++)	{
				toReturn.push({'coords':{'x':mapping.coords.x,'y':y},'color':mapping.color,'frames':mapping.frames});
			}
		}
		if (mapping.coords.y!="*" && mapping.coords.x=="*"){
			for (var x=0; x<9; x++)	{
				toReturn.push({'coords':{'x':x,'y':mapping.coords.y},'color':mapping.color,'frames':mapping.frames});
			}
		}
		if (mapping.coords.y=="*" && mapping.coords.x=="*"){
			for (var y=0; y<9; y++)	{
				for (var x=0; x<9; x++)	{
					toReturn.push({'coords':{'x':x,'y':y},'color':mapping.color,'frames':mapping.frames});
				}
			}
		}

		return toReturn;
	}

	function getMapping(code,note){
		return mappings[[code,note].join(",")];
	}

	this.setMappings([{
		'coords' : {'x':'*','y':'*'},
		'color' : this.colors.green.high
	}]);

	// console.log(mappings);
}

var lp = new Launchpad();

lp.setMappings([
	{'coords': {'x':8,'y':0},
	'frames': [
		{
			'duration': 500, 'buttons': [
				{'coords':{'x':"*",'y':0}, 'color':lp.colors.red.high},
				{'coords':{'x':"*",'y':5}, 'color':lp.colors.orange.high},
				{'coords':{'x':2,'y':2}, 'color':lp.colors.yellow.high}
			]
		},
		{
			'duration': 1000, 'buttons': [
				{'coords':{'x':3,'y':1}, 'color':lp.colors.orange.high},
				{'coords':{'x':2,'y':2}, 'color':lp.colors.red.high},
				{'coords':{'x':1,'y':3}, 'color':lp.colors.yellow.high}
			]
		}, null
	]}
]);

// lp.enableFlashing();
// lp.sendMessage([146, 15, 31, 47, 63, 63, 62, 61, 60]); 



// Send a MIDI message.
/*
function stringToHex(str){
	.split ('').map (function (c) { return c.charCodeAt (0); })
}
*/	