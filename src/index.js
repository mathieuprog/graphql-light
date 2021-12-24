import Client from './client';
import Query from './Query';
import DerivedQuery from './DerivedQuery';
import Mutation from './mutation';
import store from './store';
import transform from './transform';
import FetchStrategy from './fetchStrategies';

const getEntityById = store.getEntityById;
const getEntities = store.getEntities;
const getEntitiesByType = store.getEntitiesByType;
const filterEntities = store.filterEntities;
const countEntities = store.countEntities;
const asList = store.asList;
const one = store.one;
const setStoreConfig = store.setConfig;

export {
  Client,
  Query,
  DerivedQuery,
  Mutation,
  transform,
  getEntityById,
  getEntities,
  getEntitiesByType,
  filterEntities,
  countEntities,
  asList,
  one,
  setStoreConfig,
  FetchStrategy
}
