var midiConnector = require('midi-launchpad').connect(0);

// wait for the connector to be ready
midiConnector.on("ready",function(launchpad) {
	console.log("Launchpad ready");
	launchpad.scrollString("ANNA", launchpad.colors.yellow.high);
});