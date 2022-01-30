export default class Watcher {
  constructor(query, unsubscribeFn) {
    this.query = query;
    this.unsubscribeFn = unsubscribeFn;
    this.mustUnsubscribe = false;
  }

  watch(variables, subscriber, getUnsubscribeFn, options = {}) {
    if (this.mustUnsubscribe) {
      this.unsubscribeFn();
    }
    this.getUnsubscribeFn = getUnsubscribeFn;
    this.query.watch(variables, subscriber, getUnsubscribeFn, options);

    this.mustUnsubscribe = true;
  }

}
