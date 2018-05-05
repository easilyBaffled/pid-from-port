'use strict';

const execa = require('execa');

const isProtocol = str => /^\s*(tcp|udp)/i.test(str);

const splitStringOnData = str => (
    str.trim().split(/\s+/) // Leading white space would be included in the slit array, Trim ensures that there isn't any
);

const zipToObject = keys => values =>
    keys.reduce((obj, key, i) => Object.assign({}, obj, {[key]: values[i]}), {});

function stringToTable(str = '') {
	const rows = str.split('\n');
	const headers = splitStringOnData(rows.shift()).map(str => str.toLowerCase());

	return {
		headers,
		rows: rows.map(splitStringOnData)
	};
}

function tableToDict({headers, rows}) {
	const addAsValues = zipToObject(headers);

	return rows.map(addAsValues);
}

function stringToProtocolList(str = '') {
	return str
		.split('\n')
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

const win32 = () =>
	execa.stdout('netstat', ['-ano'])
		.then(stringToProtocolList);

const getList = process.platform === 'darwin' ? lsof : process.platform === 'linux' ? lsof : win32;
const cols = process.platform === 'darwin' ? {port: 'name', pid: 'pid'} : process.platform === 'linux' ? {
	port: 'name',
	pid: 'pid'
} : {port: 1, pid: 4};

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
	if (typeof input !== 'number') {
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
		splitStringOnData,
		parsePid,
		stringToProtocolList,
		stringToTable,
		tableToDict,
		zipToObject
	};
}
