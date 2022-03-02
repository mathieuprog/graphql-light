export default function notifySubscribers(result, store) {
  const { updates } = result;

  if (updates.length > 0) {
    for (const { subscriber } of store.subscribers) {
      subscriber(updates); // Call all subscriptions
    }
  }

  return result;
}
