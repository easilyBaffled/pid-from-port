import http from 'http';
import {serial as test} from 'ava';
import getPort from 'get-port';
import m from '.';

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
test('getListFn', async t => {
	const table = await m.util.getListFn();
	t.true(typeof table === 'string');
	t.true(/(^\s*(udp|tcp)\d?.*\n)+/gmi.test(table)); // A dumb matcher for {1,2} Header rows and rows that start with udp or tcp
});

test('isProtocol', t => {
	const {isProtocol} = m.util;
	t.true(typeof isProtocol('fail') === 'boolean');
	t.true(['fail', 0, [], -1, null, ' '].every(str => !isProtocol(str)));
	t.true(['udp', 'tcp', 'UDP', 'TCP', '   udp', '  udp46'].every(isProtocol));
});

test('insertStatePlaceholder', t => {
	const {insertStatePlaceholder} = m.util;
	t.is(typeof insertStatePlaceholder(), 'function');
	t.is(typeof insertStatePlaceholder()(''), 'string');
	t.is(insertStatePlaceholder(0)(' starts with STATE'), 'STATE starts with STATE');
	t.is(insertStatePlaceholder(12)('will insert  <- here'), 'will insert STATE <- here');
	t.is(insertStatePlaceholder(0)('is unchanged'), 'is unchanged');
});

test('splitRowOnData', t => {
	const {splitRowOnData} = m.util;
	t.true(Array.isArray(splitRowOnData('')));
	t.throws(splitRowOnData, 'Cannot read property \'trim\' of undefined');
	t.is(splitRowOnData('abc').length, 1);
	t.is(splitRowOnData(' abc').length, 1);
	t.is(splitRowOnData(' a b c ').length, 3);
	t.is(splitRowOnData(' a    c ').length, 2);
});

test('parsePid', t => {
	const {parsePid} = m.util;
	t.is(parsePid(), null);
	t.is(parsePid(1234), null);
	t.is(parsePid('bad string'), null);

	t.true(['1234', '",1234', '   ",1234', '",pid=1234'].every(pid => parsePid(pid) === 1234));
});

test('findStateIndex', t => {
	const {findStateIndex} = m.util;
	t.is(findStateIndex(), null);
	t.is(findStateIndex(1234), null);
	t.is(findStateIndex('bad string'), null);

	t.is(findStateIndex('\n anything state anything\n'), 10);
	t.is(findStateIndex(' anything State anything\n'), 10);
	t.is(findStateIndex(`
	    state
	    `), 5);
	t.is(findStateIndex('  (State)\n'), 3);
	t.is(findStateIndex('  (STATE) \n'), 3);
});
