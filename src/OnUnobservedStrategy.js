const OnUnobservedStrategy = Object.freeze({
  /**
   * When there are no observers, keep updating because the query with params is expected to be called frequently.
   *
   * This option is best suited for a query with params that is often coming back, and resolving every time it is first
   * subscribed to (`watch()`) or queried (`query()`) would be more expensive than continually listening for store updates.
   *
   * When a store update concerns a specific query with params and
   * - the query is resolved with a user-defined resolver: the query is marked as to be updated and the listener for store
   *   updates is paused until the resolver is called (data is requested). The resolver is only called when the data is
   *   requested or if there are any watchers.
   * - the query is resolved with the query cache data: the query is updated by any new store update, or by user-defined
   *   code (`onStoreUpdate` callback). The listener for store updates is never paused.
   *
   * The reason why the listener for store updates may be paused when an update is found and a user-defined resolver is
   * used, is because the resolver will use the global cache to fetch data and thus always access up-to-date data; therefore
   * all we need is a flag "to-be-updated" set to true without listening for further updates.
   */
  KEEP_UPDATING: 'KEEP_UPDATING',

  /**
   * When there are no observers, pause updating.
   *
   * This is the default value.
   *
   * This option is best suited for a query with params that is infrequently called, or a query that is called with a lot
   * of params and would cause a lot of store subscriptions listening and processing updates.
   */
  PAUSE_UPDATING: 'PAUSE_UPDATING'
});

export default OnUnobservedStrategy;
