// 用状态机处理abababx
// 自重复数组: [0, 0, 0, 1, 2, 3, 4]

function match(str) {
  let state = start;
  for (let i of str) {
    state = state(i);
  }

  return state === end;
}

function start(i) {
  return i === 'a' ? findA1 : start;
}

function findA1(i) {
  return i === 'b' ? findB1 : start(i);
}

function findB1(i) {
  return i === 'a' ? findA2 : start(i);
}

function findA2(i) {
  return i === 'b' ? findB2 : findA1(i);
}

function findB2(i) {
  return i === 'a' ? findA3 : findB1(i);
}

function findA3(i) {
  return i === 'b' ? findB3 : findA2(i);
}

function findB3(i) {
  return i === 'x' ? end : findB2(i);
}

function end(i) {
  return end;
}
