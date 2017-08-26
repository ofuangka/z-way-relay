/**
 * this script creates an express server that handles GET requests to /devices and 
 * PUT requests to /devices/:deviceId. /devices gets relayed as a device list request 
 * on the z-way network, and the device specific PUT request relays the request to the z-way server 
 * 
 * Usage: USERNAME=USERNAME PASSWORD=PASSWORD node index.js PORT TV_SERVER_HOST TV_SERVER_PORT
 * 	where PORT is the port to listen on,
 *  USERNAME and PASSWORD are the credentials to use when relaying to the z-way server, 
 *  and IR_SERVER_HOST IR_SERVER_PORT are the host and port are the TV server and port
 */
if (process.argv.length < 5) {
	console.log(`Usage: USERNAME=USERNAME PASSWORD=PASSWORD node ${__filename} PORT IR_SERVER_HOST IR_SERVER_PORT`);
	process.exit(-1);
}

const Z_WAY_PATH_PREFIX = '/ZAutomation/api/v1',
	DEFAULT_HEADERS = {
		accept: '*/*',
		'Content-Type': 'application/json'
	},
	DEFAULT_OPTIONS = {
		port: 8083
	},
	TV = {
		id: 'tv',
		type: 'television',
		name: 'TV',
		description: "Sharp AQUOS N6000U",
		manufacturer: 'Sharp'
	},
	TELEVISION = {
		id: 'television',
		type: 'television',
		name: 'Television',
		description: "Sharp AQUOS N6000U",
		manufacturer: 'Sharp'
	},
	ROKU = {
		id: 'roku',
		type: 'roku',
		name: 'Roku',
		description: 'Roku Streaming Stick 3600',
		manufacturer: 'Roku'
	},
	TV_KEYS = {
		power: 'KEY_POWER',
		volumeUp: 'KEY_VOLUMEUP',
		volumeDown: 'KEY_VOLUMEDOWN',
		mute: 'KEY_MUTE'
	},
	PAUSE_MS = 1000,
	MAX_IR_REPEAT = 50,
	SUPPORTED_RESOURCES = {
		power: 'power',
		channel: 'channel',
		input: 'input',
		volume: 'volume',
		playback: 'playback'
	};

var express = require('express'),
	bodyParser = require('body-parser'),
	http = require('http'),
	server = express(),
	port = process.argv[2],
	username = process.env.USERNAME,
	password = process.env.PASSWORD,
	irServerHost = process.argv[3],
	irServerPort = process.argv[4],
	isVerbose = process.env.IS_VERBOSE,
	sid;

/**
 * cheap polyfill for Object.assign()
 */
function assign(target) {
	for (var i = 1; i < arguments.length; i++) {
		var source = arguments[i];
		for (var nextKey in source) {
			if (source.hasOwnProperty(nextKey)) {
				target[nextKey] = source[nextKey];
			}
		}
	}
	return target;
}

/**
 * promise wrapper for http
 */
function httpPromise(options, postData) {
	return new Promise((resolve, reject) => {
		var outRequest = http.request(options, outResponse => {
			var data = '';
			outResponse.on('data', chunk => data += chunk);
			outResponse.on('end', () => {
				resolve({
					statusCode: outResponse.statusCode,
					headers: outResponse.headers,
					responseText: data
				});
			});
		});
		outRequest.on('error', error => reject(error));
		if (postData !== undefined) {
			outRequest.write(postData);
		}
		outRequest.end();
	});
}
function get(path, options) {
	return httpPromise(assign({ method: 'GET', path: path }, options));
}
function put(path, options, postData) {
	return httpPromise(assign({ method: 'PUT', path: path }, options), postData);
}
function post(path, options, postData) {
	return httpPromise(assign({ method: 'POST', path: path }, options), postData);
}

function waitFor(ms) {
	return new Promise((resolve, reject) => setTimeout(resolve, ms));
}

function pause() {
	return waitFor(PAUSE_MS);
}

function handleRokuPowerRequest(inRequest, inResponse) {
	sendError('Not yet implemented', inResponse);
}

function handleTvChannelRequest(inRequest, inResponse) {
	sendError('Not yet implemented', inResponse);
}

function handleRokuChannelRequest(inRequest, inResponse) {
	sendError('Not yet implemented', inResponse);
}

function handleTvInputRequest(inRequest, inResponse) {
	sendError('Not yet implemented', inResponse);
}

function handleTvPlaybackRequest(inRequest, inResponse) {
	sendError('Not yet implemented', inResponse);
}

function handleRokuPlaybackRequest(inRequest, inResponse) {
	sendError('Not yet implemented', inResponse);
}

function verbose(message) {
	if (isVerbose) {
		console.log(message);
	}
}

/**
 * Gets a z-way session ID using the USERNAME and PASSWORD
 */
function getZWaySession() {
	var fullPath = `${Z_WAY_PATH_PREFIX}/login`;
	return post(fullPath, JSON.stringify({ login: username, password: password }), getZWayOptions())
		.then(response => JSON.parse(response.responseText).data.sid);
}

/**
 * Returns options for http
 * 
 * @param {boolean?} includeSid Whether to include the sid
 * @param {string?} postData The postData 
 */
function getZWayOptions(includeSid, postData) {
	var ret = getOptions(postData);
	if (includeSid) {
		ret.headers.ZWAYSession = sid;
	}
	return ret;
}

function getIrOptions(postData) {
	var ret = getOptions(postData);
	ret.hostname = irServerHost;
	ret.port = irServerPort;
	return ret;
}

function getOptions(postData) {
	var headers = assign({
		'Content-Length': typeof postData === 'string' ? Buffer.byteLength(postData) : 0
	}, DEFAULT_HEADERS);
	return assign({ headers: headers }, DEFAULT_OPTIONS);
}


/**
 * Opens a z-way session and uses that session to make a GET request
 * 
 * @param {string} path The request path 
 */
function zWayAuthGet(path) {
	return getZWaySession()
		.then(_sid => sid = _sid)
		.then(() => get(path, getZWayOptions(true)));
}

/**
 * Checks if the request is for TV
 * 
 * @param {object} inRequest 
 */
function isTvRequest(inRequest) {
	var endpointId = getEndpointId(inRequest);
	return [TV.id, TELEVISION.id].indexOf(endpointId) !== -1;
}

function isRokuRequest(inRequest) {
	return getEndpointId(inRequest) === ROKU.id;
}

function handleTvPowerRequest(inRequest, inResponse) {
	var endpointId = getEndpointId(inRequest),
		powerState = inRequest.body.state,
		key = TV_KEYS.power;
	sendIrCommand(key, endpointId)
		.then(tvResponse => sendSuccess(inResponse, {
			state: powerState,
			isoTimestamp: now(),
			uncertaintyMs: 0
		}))
		.catch(error => sendError(inResponse, error));
}

function sendIrCommand(key, endpointId) {
	var irPath = `/receivers/${endpointId}/command`,
		postData = JSON.stringify({ key: key });
	verbose(`POST ${irPath} ${postData}`);
	return post(irPath, getIrOptions(postData), postData);
}

function irRepeat(key, endpointId, times) {
	if (times === 0) {
		return Promise.resolve();
	} else if (times === 1) {
		return sendIrCommand(key, endpointId);
	} else if (times > MAX_IR_REPEAT) {

		/* trying to prevent ddos */
		return irRepeat(key, endpointId, MAX_IR_REPEAT);
	} else {
		return sendIrCommand(key, endpointId)
			.then(pause)
			.then(irRepeat(key, endpointId, times - 1));
	}
}

function handleTvVolumeRequest(inRequest, inResponse) {
	var endpointId = getEndpointId(inRequest),
		volumeSteps = inRequest.body.volumeSteps,
		mute = inRequest.body.mute;

	/* no way to determine status, just return a success */
	sendSuccess(inResponse);

	if (typeof mute === 'boolean') {
		sendIrCommand(TV_KEYS.mute, endpointId);
	} else if (volumeSteps) {
		var key = volumeSteps < 0 ? TV_KEYS.volumeDown : TV_KEYS.volumeUp;
		irRepeat(key, endpointId, Math.abs(volumeSteps));
	} else {
		sendError(inResponse, 'Invalid request');
	}
}

function sendError(response, error) {
	var sendData = JSON.stringify({ error: (typeof error === 'string' ? new Error(error) : error) });
	verbose(`REPLY 500 ${sendData}`);
	response.status(500).send(sendData);
}

function sendSuccess(response, payload) {
	var sendData = JSON.stringify(payload === undefined ? { code: 200, message: '200 OK' } : payload);
	verbose(`REPLY 200 ${sendData}`);
	response.status(200).send(sendData);
}

function getEndpointId(inRequest) {
	return inRequest.params.endpointId;
}

function logRequest(inRequest) {
	verbose(`RECV ${JSON.stringify(inRequest)}`);
	console.log(`${inRequest.method} request for ${inRequest.path} received`);
}

function getEndpoint(resource) {
	return `/endpoints/:endpointId/${resource}`;
}

function getRequestResource(inRequest) {
	return inRequest.path.substr(inRequest.path.lastIndexOf('/'));
}

function sendUnsupportedDeviceError(inRequest, inResponse) {
	sendError(inResponse, `Endpoint ${getEndpointId(inRequest)} does not support ${getRequestResource(inRequest)}`);
}

/**
 * Attempts to make a GET request using an existing session ID. If the attempt 
 * fails with a 401 unauthorized, attempts to start a new session and then 
 * make the same GET request
 * 
 * @param {string} path The request path 
 */
function zwayGet(path) {
	var fullPath = `${Z_WAY_PATH_PREFIX}${path}`;
	if (sid) {
		return get(fullPath, getZWayOptions(true))
			.then(response => {
				if (response.statusCode === 401) {
					return zWayAuthGet(fullPath);
				}
				return response;
			});
	}
	return zWayAuthGet(fullPath);
}

function now() {
	return new Date().toISOString();
}

function isZWayDeviceValid(zWayDevice) {
	return zWayDevice 
		&& zWayDevice.id 
		&& zWayDevice.metrics 
		&& zWayDevice.metrics.title 
		&& zWayDevice.deviceType;
}

server.use(bodyParser.json());
server.use(bodyParser.urlencoded({ extended: true }));

/* express get handler */
server.get('/endpoints', (inRequest, inResponse) => {
	logRequest(inRequest);

	/* static endpoints */
	var endpoints = [
		TV,
		TELEVISION,
		ROKU
	];

	/* make a request to the z way server */
	zWayGet('/devices')
		.then(zWayResponse => {
			verbose(`zWayResponse: ${JSON.stringify(zWayResponse)}`);
			var zWayEndpoints = JSON.parse(zWayResponse.responseText).data.devices.
				filter(zWayDevice => isZWayDeviceValid)
				.map(zWayDevice => {
					return {
						id: zWayDevice.id,
						name: zWayDevice.metrics.name,
						description: zWayDevice.metrics.name,
						manufacturer: zWayDevice.metrics.name,
						type: zWayDevice.deviceType
					};
				})
			endpoints.concat(zWayEndpoints);
		})
		.catch(error => {
			console.log(`z-way device discovery error: ${JSON.stringify(error)}`);
		})

		/* even if there was an error, we reply with the static endpoints */
		.then(sendSuccess(inResponse, endpoints));
});

/* express put handler */
server.put(getEndpoint(SUPPORTED_RESOURCES.power), (inRequest, inResponse) => {
	logRequest(inRequest);
	if (isTvRequest(inRequest)) {
		handleTvPowerRequest(inRequest, inResponse);
	} else if (isRokuRequest(inRequest)) {
		sendUnsupportedDeviceError(inRequest, inResponse);
	} else {

		/* make a request to the z-way server */
		var powerState = inRequest.body.state;

		zWayGet(`/devices/${deviceId}/command/${powerState}`)
			.then(zWayResponse => {
				verbose(`zWayResponse: ${JSON.stringify(zWayResponse)}`);
				return sendSuccess(inResponse, {
					state: powerState,
					isoTimestamp: now(),
					uncertaintyMs: 0
				});
			})
			.catch(error => sendError(inResponse, error));
	}
});

server.put(getEndpoint(SUPPORTED_RESOURCES.channel), (inRequest, inResponse) => {
	logRequest(inRequest);
	if (isTvRequest(inRequest)) {
		handleTvChannelRequest(inRequest, inResponse);
	} else if (isRokuRequest(inRequest)) {
		handleRokuChannelRequest(inRequest, inResponse);
	} else {
		sendUnsupportedDeviceError(inRequest, inResponse);
	}

});

server.put(getEndpoint(SUPPORTED_RESOURCES.volume), (inRequest, inResponse) => {
	logRequest(inRequest);
	if (isTvRequest(inRequest)) {
		handleTvVolumeRequest(inRequest, inResponse);
	} else {
		sendUnsupportedDeviceError(inRequest, inResponse);
	}

});

server.put(getEndpoint(SUPPORTED_RESOURCES.input), (inRequest, inResponse) => {
	logRequest(inRequest);
	if (isTvRequest(inRequest)) {
		handleTvInputRequest(inRequest, inResponse);
	} else {
		sendUnsupportedDeviceError(inRequest, inResponse);
	}
});

server.put(getEndpoint(SUPPORTED_RESOURCES.playback), (inRequest, inResponse) => {
	logRequest(inRequest);
	if (isTvRequest(inRequest)) {
		handleTvPlaybackRequest(inRequest, inResponse);
	} else if (isRokuRequest(inRequest)) {
		handleRokuPlaybackRequest(inRequest, inResponse);
	} else {
		sendUnsupportedDeviceError(inRequest, inResponse);
	}
});

http.createServer(server).listen(port);
console.log(`Server listening on port ${port}`);