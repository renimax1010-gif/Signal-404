'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { isDirectAddress, chooseReply, chooseRandomInterjection } = require('../src/brain');

test('recognizes a direct address by bot name', () => {
  assert.equal(isDirectAddress('Бот, ты здесь?', 123), true);
  assert.equal(isDirectAddress('ботик помоги', 123), true);
});
test('recognizes a community mention', () => {
  assert.equal(isDirectAddress('Эй [club123|наш бот], ответь', 123), true);
});
test('does not treat an unrelated message as a direct address', () => {
  assert.equal(isDirectAddress('Кто сегодня идёт гулять?', 123), false);
});
test('reply selectors return text', () => {
  assert.equal(typeof chooseReply({ direct: true, random: () => 0 }), 'string');
  assert.equal(typeof chooseRandomInterjection(() => 0), 'string');
});
