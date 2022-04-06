export default class Node {
  constructor(parent, meta, fetchCached) {
    this.parent = parent;
    this.meta = meta;
    this.fetchCached = fetchCached;
    this.fields = {};
  }
}
