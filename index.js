'use strict';

const execa = require('execa');

// :: n -> Boolean
const isNumber = n => typeof n === 'number' && !Number.isNaN(n); // Typeof n === 'number' isn't good enough, you want to catch NaN, as well
// :: String -> Boolean
const isProtocol = str => /^\s*(?:tcp|udp)/i.test(str); // Don't capture if you don't have to, it's probably more efficient. It was (tcp|udp)
// :: Regexp -> String -> [ String ]
const splitOn = rx => str => str.trim().split(rx); // Re-use for two similar scenarios
// :: String -> [ String ]
const splitOnWs = splitOn(/\s+/);
// :: String -> [ String ]
const splitOnLf = splitOn(/\r?\n/);

// Associates the Strings from one array to the Strings of another to create single object of key, value pairs
//  :: [ String ] -> [ String ] -> Object
const zipToObject = keys => values => keys.reduce((obj, key, i) => {
	obj[key] = values[i];
	return obj;
}, {});

/**
 * Turns an ascii table-like output string into headers and rows.
 *
 * @param {string} str
 * @return {{headers: [String], rows: [[String]]}}
 */
function stringToTable(str) {
	str = str || '';
	const rows = splitOnLf(str);
	const headers = splitOnWs(rows.shift()).map(str => str.toLowerCase());

	return {
		headers,
		rows: rows.map(splitOnWs)
	};
}

/**
 * Turns a table of headers and rows into an array of standard objects.
 *
 * @param {{headers: [String], rows: [[String]]}} table
 * @return {[[Object]]}
 */
function tableToDict(table) {
	const addAsValues = zipToObject(table.headers);

	return table.rows.map(addAsValues);
}

/**
 * Takes an ascii table-like output string,
 * filters out non-tcp and non-udp related rows,
 * and converts what's left into a list of arrays
 * @param {string} [str='']
 * @return {[String]}
 */
function stringToProtocolList(str) {
	str = str || '';
	return splitOnLf(str)
		.reduce((result, x) => {
			if (isProtocol(x)) {
                result.push(x.match(/\S+/g) || []);
			}

			return result;
		}, []);
}
// :: void -> Promise [Object] []
const lsof = () =>
		execa.stdout('lsof', ['-Pn', '-i'])
			.then(stringToTable)
			.then(tableToDict)
			.catch(() => []); // When nothing is found, pass the empty array along to the user and let them decide how to handle the situation
// :: void -> Promise [String]
const win32 = () => execa.stdout('netstat', ['-ano']).then(stringToProtocolList);

const os = process.platform;
const cols = os === 'darwin' || os === 'linux' ? {port: 'name', pid: 'pid'} : {port: 1, pid: 4};
const getList = os === 'win32' ? win32 : lsof;
/**
 * Extract the pid number from a matching string
 * @param {string} input
 * @returns {number|null}
 */
const parsePid = input => {
	if (typeof input !== 'string') {
		return null;
	}

	const match = input.match(/(?:^|",|",pid=)(\d+)/);

	return match ? parseInt(match[1], 10) : null;
};

/**
 * Find a pid from a given list that has a given port
 * @param {string|number} input
 * @param {[string]} list
 * @returns {number|null} - returns the result of parsePid
 */
const getPort = (input, list) => {
	const regex = new RegExp(`[.:]${input}$`);
	const port = list.find(x => regex.test(x[cols.port]));

	if (!port) {
		throw new Error(`Couldn't find a process with port \`${input}\``);
	}

	return parsePid(port[cols.pid]);
};

/**
 * Finds the pid of a process running on a given port
 * @param {number} input
 * @returns {number|null}
 */
module.exports = input => {
	if (!isNumber(input)) {
		return Promise.reject(new TypeError(`Expected a number, got ${typeof input}`));
	}

	return getList().then(list => getPort(input, list));
};

/**
 * Finds the pids of processes running on a list given port
 * @param {[number]} input - a list of ports you want pids for
 * @returns {Map}
 */
module.exports.all = input => {
	if (!Array.isArray(input)) {
		return Promise.reject(new TypeError(`Expected an array, got ${typeof input}`));
	}

	return getList()
		.then(list => Promise.all(input.map(x => [x, getPort(x, list)])))
		.then(list => new Map(list));
};

/**
 * Get a list of all of the pids and ports for currently running TCP and UDP processes
 * @returns {ValueGenerator<Map<any, any>>|*|Promise<Map<any, any>>|PromiseLike<Map<any, any>>}
 */
module.exports.list = () => getList().then(list => {
	const ret = new Map();

	for (const x of list) {
		const match = x[cols.port].match(/[^]*[.:](\d+)$/);

		if (match) {
            ret.set(parseInt(match[1], 10), parsePid(x[cols.pid]));
		}
	}

	return ret;
});

if (process.env.NODE_ENV === 'test') {
	module.exports.util = {
		isProtocol,
		splitStringOnData: splitOnWs,
		parsePid,
		stringToProtocolList,
		stringToTable,
		tableToDict,
		zipToObject
	};
}
