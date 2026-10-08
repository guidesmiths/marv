// Invokes a driver method with a callback. If the method returns a promise instead,
// the outcome is bridged to the callback, so drivers may be written in either style.
module.exports = function invoke(driver, method, ...args) {
  const cb = args.pop();
  let settled = false;

  function once(...results) {
    if (settled) return;
    settled = true;
    cb(...results);
  }

  const result = driver[method](...args, once);
  if (typeof result?.then === 'function') result.then((value) => once(null, value), once);
};
