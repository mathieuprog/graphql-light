import Client from './client';
import Query from './query';
import DerivedQuery from './derived_query';
import Mutation from './mutation';
import store from './store';

const getEntityById = store.getEntityById;
const setStoreConfig = store.setConfig;

export {
  Client,
  Query,
  DerivedQuery,
  Mutation,
  getEntityById,
  setStoreConfig
}
