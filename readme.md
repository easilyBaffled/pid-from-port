# pid-from-port 
[![npm version](https://badge.fury.io/js/pid-from-port.svg)](https://badge.fury.io/js/pid-from-port)
[![Build Status](https://travis-ci.org/easilyBaffled/pid-from-port.svg?branch=master)](https://travis-ci.org/easilyBaffled/pid-from-port) 
[![Build status](https://ci.appveyor.com/api/projects/status/8mh3i140nq32c7vw/branch/master?svg=true)](https://ci.appveyor.com/project/easilyBaffled/pid-from-port/branch/master)
[![Coverage Status](https://coveralls.io/repos/github/easilyBaffled/pid-from-port/badge.svg?branch=master)](https://coveralls.io/github/easilyBaffled/pid-from-port?branch=master) [![Greenkeeper badge](https://badges.greenkeeper.io/easilyBaffled/pid-from-port.svg)](https://greenkeeper.io/)
> Get PID from a port


## Install

```
$ npm install pid-from-port
```


## Usage

```js
const pidFromPort = require('pid-from-port');

(async () => {
	try {
		console.log(await pidFromPort(8080));
		//=> 1337

		const pids = await pidFromPort.all([8080, 22]);

		console.log(pids.get(8080));
		//=> 1337

		console.log(pids.get(22));
		//=> 12345
	} catch (err) {
		console.log(err);
		//=> 'Couldn't find a process with port `8080`'
	}
})();
```


## API

### pidFromPort(port)

#### port

Type: `number`

Port to lookup.

### pidFromPort.all(ports)

Returns a `Promise<Map>` with the port as key and the PID as value.

#### ports

Type: `Array<number>`

Ports to lookup.

### pidFromPort.list()

Get all PIDs from ports.

Returns a `Promise<Map>` with the port as key and the PID as value.


## License

MIT © [Kevin Martensson](https://github.com/kevva)
