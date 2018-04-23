'use strict';

const execa = require('execa');

const macos = () => execa.stdout('netstat', ['-anv', '-p', 'tcp'])
	.then(data => Promise.all([data, execa.stdout('netstat', ['-anv', '-p', 'udp'])]))
	.then(data => data.join('\n'));

const linux = () => execa.stdout('ss', ['-tunlp']);
const win32 = () => execa.stdout('netstat', ['-ano']);

const getListFn = process.platform === 'darwin' ? macos : process.platform === 'linux' ? linux : win32;
const cols = process.platform === 'darwin' ? [3, 8] : process.platform === 'linux' ? [4, 6] : [1, 4];

const isProtocol = str => /^\s*(tcp|udp)/i.test(str);
const insertStatePlaceholder = startIndex => string => (
	string[startIndex] === ' ' ?
			string.slice(0, startIndex) + 'STATE' + string.slice(startIndex) :
		string
);

const splitRowOnData = str => (
	str.trim().split(/\s+/)
);

const parsePid = input => {
	if (typeof input !== 'string') {
		return null;
	}

	const match = input.match(/(?:^|",|",pid=)(\d+)/);
	return match ? parseInt(match[1], 10) : null;
};

const getPort = (input, list) => {
	const regex = new RegExp(`[.:]${input}$`);
	const port = list.find(x => regex.test(x[cols[0]]));

	if (!port) {
		throw new Error(`Couldn't find a process with port \`${input}\``);
	}

	return parsePid(port[cols[1]]);
};

function findStateIndex(listTable) {
	if (typeof listTable !== 'string') {
		return null;
	}

	const header = listTable.match(/\n?(.*(state).*)\n/i); // The (.*, .*) are so this will capture the whole line
	return header ? header[1].search(/state/i) : null;
}

const getList = () =>
	getListFn()
		.then(list => {
			const stateIndex = findStateIndex(list);

			return {
				insertStatePlaceholder: insertStatePlaceholder(stateIndex),
				list
			};
		})
		.then(({insertStatePlaceholder, list}) =>
			list
				.split('\n')
				.reduce((list, row) => {
					if (isProtocol(row)) {
list.push(splitRowOnData(insertStatePlaceholder(row)));
					}

					return list;
				}, [])
		);

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
		const match = x[cols[0]].match(/[^]*[.:](\d+)$/);

		if (match) {
			ret.set(parseInt(match[1], 10), parsePid(x[cols[1]]));
		}
	}

	return ret;
});

if (process.env.NODE_ENV === 'test') {
	module.exports.util = {
		getListFn,
		isProtocol,
		insertStatePlaceholder,
		splitRowOnData,
		parsePid,
		getPort,
		findStateIndex,
		getList
	};
}

//
// module.exports.list = () =>
// 	getList()
// 		.then(list => {
// 			return list.reduce((acc, x) => {
// 				const match = x[cols[0]].match(/[^]*[.:](\d+)$/);
// 				if (match) {
// 					acc.set(parseInt(match[1], 10), parsePid(x[cols[1]]));
// 				}
// 				return acc;
// 			}, new Map());
// 		});

