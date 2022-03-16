import Client from './client/Client';
import NetworkRequest from './client/NetworkRequest';
import FetchStrategy from './constants/FetchStrategy';
import OnUnobservedStrategy from './constants/OnUnobservedStrategy';
import UpdateType from './constants/UpdateType';
import GraphQLError, { findGraphQLError } from './errors/GraphQLError';
import NotFoundInCacheError from './errors/NotFoundInCacheError';
import Mutation from './mutation/Mutation';
import DerivedQuery from './query/DerivedQuery';
import Query, { handleStoreUpdate } from './query/Query';
import store from './store';
import {
  removeEntity,
  removeEntityById,
  updateEntity
} from './store/middleware/normalize';

export {
  Client,
  NetworkRequest,
  FetchStrategy,
  OnUnobservedStrategy,
  UpdateType,
  GraphQLError,
  findGraphQLError,
  NotFoundInCacheError,
  Mutation,
  DerivedQuery,
  Query,
  store,
  handleStoreUpdate,
  removeEntity,
  removeEntityById,
  updateEntity
}
