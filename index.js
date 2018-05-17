'use strict';

const execa = require('execa');

const isNumber = n => typeof n === 'number' && !Number.isNaN(n); // Typeof n === 'number' isn't good enough, you want to catch NaN, as well
const isProtocol = str => /^\s*(?:tcp|udp)/i.test(str); // Don't capture if you don't have to, it's probably more efficient. It was (tcp|udp)
const splitOn = rx => str => str.trim().split(rx); // Re-use for two similar scenarios
const splitOnWs = splitOn(/\s+/);
const splitOnLf = splitOn(/\r?\n/);

const zipToObject = keys => values => keys.reduce((obj, key, i) => { // I removed the `Object.assign()` since it's too slow to justify just to get a one-liner
	obj[key] = values[i];
	return obj;
}, {});

function stringToTable(str) {
	str = str || '';
	const rows = splitOnLf(str);
	const headers = splitOnWs(rows.shift()).map(str => str.toLowerCase());

	return {
		headers,
		rows: rows.map(splitOnWs)
	};
}

function tableToDict(table) {
	const addAsValues = zipToObject(table.headers);

	return table.rows.map(addAsValues);
}

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

const lsof = () =>
		execa.stdout('lsof', ['-Pn', '-i'])
			.then(stringToTable)
			.then(tableToDict)
			.catch(() => []); // When nothing is found, pass the empty array along to the user and let them decide how to handle the situation

const win32 = () => execa.stdout('netstat', ['-ano']).then(stringToProtocolList);

const os = process.platform;
const cols = os === 'darwin' || os === 'linux' ? {port: 'name', pid: 'pid'} : {port: 1, pid: 4};
const getList = os === 'win32' ? win32 : lsof;

const parsePid = input => {
	if (typeof input !== 'string') {
		return null;
	}

	const match = input.match(/(?:^|",|",pid=)(\d+)/);

	return match ? parseInt(match[1], 10) : null;
};

const getPort = (input, list) => {
	const regex = new RegExp(`[.:]${input}$`);
	const port = list.find(x => regex.test(x[cols.port]));
	// Console.log(list);
	if (!port) {
		throw new Error(`Couldn't find a process with port \`${input}\``);
	}

	return parsePid(port[cols.pid]);
};

module.exports = input => {
	if (!isNumber(input)) {
		return Promise.reject(new TypeError(`Expected a number, got ${typeof input}`));
	}

	return getList().then(list => getPort(input, list));
};

module.exports.all = input => {
	if (!Array.isArray(input)) {
		return Promise.reject(new TypeError(`Expected an array, got ${typeof input}`));
	}

	return getList()
		.then(list => Promise.all(input.map(x => [x, getPort(x, list)])))
		.then(list => new Map(list));
};

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
