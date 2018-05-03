'use strict';
import http from 'http';
import {serial as test} from 'ava';
import getPort from 'get-port';
import m from '.';

// Const {check, gen} = require('ava-check');
const {check, gen, property} = require('testcheck');

const pidFromPort = m;

const startNewServer = port => {
	const server = http.createServer((req, res) => {
		res.end();
	});
	server.listen(port);
	return server;
};

// PidFromPort
test('success', async t => {
	const port = await getPort();
	const server = startNewServer(port);
	t.truthy(await pidFromPort(port));
	server.close();
});

test('fail', async t => {
	await t.throws(m(0), 'Couldn\'t find a process with port `0`');
	await t.throws(m.all([0]), 'Couldn\'t find a process with port `0`');
});

test('accepts a number', async t => {
	await t.throws(m('3000'), 'Expected a number, got string');
	await t.throws(m('foo'), 'Expected a number, got string');
});
// PidFromPort.all
test('all', async t => {
	const [p1, p2] = await Promise.all([getPort(), getPort()]);
	const [s1, s2] = [startNewServer(p1), startNewServer(p2)];
	const ports = await m.all([p1, p2]);

	t.true(ports instanceof Map);

	for (const x of ports.values()) {
		t.is(typeof x, 'number');
	}

	s1.close();
	s2.close();
});

// PidFromPort.list
test('list', async t => {
	const list = await m.list();
	t.true(list instanceof Map);
	await t.notThrows(m.all(Array.from(list.keys())));
});

// PidFromPort.util
test('isProtocol', t => {
	const {isProtocol} = m.util;
	t.true(typeof isProtocol('fail') === 'boolean');
	t.true(['fail', 0, [], -1, null, ' '].every(str => !isProtocol(str)));
	t.true(['udp', 'tcp', 'UDP', 'TCP', '   udp', '  udp46'].every(isProtocol));
});

test('splitStringOnData', t => {
	const {splitStringOnData} = m.util;
	t.true(Array.isArray(splitStringOnData('')));
	t.throws(splitStringOnData, 'Cannot read property \'trim\' of undefined');
	t.is(splitStringOnData('abc').length, 1);
	t.is(splitStringOnData(' abc').length, 1);
	t.is(splitStringOnData(' a b c ').length, 3);
	t.is(splitStringOnData(' a    c ').length, 2);
});

test('parsePid', t => {
	const {parsePid} = m.util;
	t.is(parsePid(), null);
	t.is(parsePid(1234), null);
	t.is(parsePid('bad string'), null);

	t.true(['1234', '",1234', '   ",1234', '",pid=1234'].every(pid => parsePid(pid) === 1234));
});

const {toLowerCase} = m.util;
test('toLowerCase', t => {
	t.true(
		check(
			property(gen.string, str => toLowerCase(str) === str.toLowerCase()),
			{numTests: 100}
		)
	);
});

const {stringToTable} = m.util;
test('stringToTable', t => {
	t.true(
		check(
			property(gen.string, str => {
				const res = stringToTable(str);
				return typeof res.headers === 'string' && Array.isArray(res.rows) && res.headers + '\n' + res.rows.join('\n') === str;
			},
			{numTests: 100}
			)
		)
	);
});

