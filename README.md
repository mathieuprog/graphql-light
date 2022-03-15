# GraphQL Light - a simple GraphQL client

* [Why GraphQL Light?](#why-graphql-light)
* [Architecture](#architecture)
  * [Global normalized cache](#global-normalized-cache)
  * [Queries, derived queries and mutations](#queries-derived-queries-and-mutations)
* [Limitations](#limitations)
* [Getting started](#getting-started)
  * [Instantiate and configure the client](#instantiate-and-configure-the-client)
  * [Create a `Query` instance](#create-a-query-instance)
  * [Fetch data using `query`](#fetch-data-using-query)
  * [Fetch data using `watch`](#fetch-data-using-watch)
  * [Create a `Mutation` instance](#create-a-mutation-instance)
  * [Mutate data](#mutate-data)
* [Manage the cache](#manage-the-cache)
  * [Transform entities](#transform-entities)
  * [Delete and update entities](#delete-and-update-entities)
  * [Handling arrays](#handling-arrays)
  * [Customize query behavior on cache updates](#customize-query-behavior-on-cache-updates)
* [Errors](#errors)
* [Advanced features](#advanced-features)
  * [Query caching strategies](#query-caching-strategies)
  * [Dependent queries](#dependent-queries)
  * [Derived queries](#derived-queries)
  * [Fetching strategies](#fetching-strategies)
  * [Simple network requests](#simple-network-requests)
  * [Caching entities manually](#caching-entities-manually)
  * [Inspecting the cache](#inspecting-the-cache)
  * [Debug mode](#debug-mode)
* [API](#api)
* [Installation](#installation)

## Why GraphQL Light?

`graphql-light` was written for a few main reasons that differentiates it from other GraphQL clients:

1. Cached entities are updated through explicit code written by the user; the user has full control over the caching, no magic involved.

2. Cached entities are normalized, but the user can seamlessly access their nested entities (as if data is denormalized) with the use of proxies behind the scenes.

3. If it is assumed that a nested entity has already been fetched, only the reference (foreign key) can be requested in the user's GraphQL document. A field with the nested entity will be added by the library alongside the reference. This saves a lot of SQL JOINs.

4. Queries may be derived from other queries.

These features will become more clear throughout the reading of this documentation.

## Architecture

### Global normalized cache

Entities (objects containing an `id` and `__typename`) fetched from the server are stored into a global cache. The entities are normalized. Nested entities are stored as proxies allowing to access the full object from the parent, and thus allowing chaining properties as if data is denormalized.

A global cache has two main functions:

1. When a query is addressed by the cache, a global cache ensures the data returned is the latest updated data.

2. A global cache allows to keep track of updates and letting the user's application react to data updates: any component throughout the application can subscribe to cache updates.

The global cache is also called store.

### Queries, derived queries and mutations

Queries and mutations are executed through instances of the `Query` and `Mutation` classes. One instance should be created per query, and shared across the application.

Queries may be derived from other queries. This is useful for two scenarios:

1. The user wants to execute a large query to initialize the application with data instead of a multitude of small queries, and wants to use different parts of the result in different parts of the application. For example, a large initial query includes the organization, the users, the services, etc. and derived queries return each of these data separately.

2. The user wants to return data based on the result of multiple queries.

## Limitations

* objects must use global unique identifiers (e.g. UUIDv4) as their identifiers. There is no plan to support sequential IDs.

* objects must have an `id` property storing their UUID.

* object properties `id` and `__typename` must be present for every cacheable entity.

## Getting started

### Instantiate and configure the client

Export an instance of `Client` which will be consumed by queries and mutations in order to execute requests:

```javascript
import { Client } from 'graphql-light';

const url = 'http://myapp.localhost:4000/api';
const client = new Client(url, { credentials: 'include' });

export default client;
```

The second argument of the constructor contains the settings to apply to the request, as used by the Fetch API. Refer to the Fetch API documentation for more information about these settings:<br>
https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch#supplying_request_options

### Create a `Query` instance

```javascript
import { Query } from 'graphql-light';
import client from './client';

const articlesQuery =
  new Query(client, `query($authorId: ID!) {
    articles(authorId: $authorId) {
      __typename
      id
      title
      publishDate

      comments {
        __typename
        id
        text
      }
    }
  }`);

export default articlesQuery;
```

### Fetch data using `query`

```javascript
import { articlesQuery } from './graphql';

const articles = await articlesQuery.query({ authorId: 1 });
```

### Fetch data using `watch`

Watching a query allows to get the response of query as well as any subsequent updates.

```javascript
import { articlesQuery } from './graphql';

let unsubscriber;

let articles =
  articlesQuery.watch({ authorId: 1 },
    (updatedArticles) => articles = updatedArticles,
    (unsubscribe) => unsubscriber = unsubscribe
  );
```

### Create a `Mutation` instance

```javascript
import { Mutation } from 'graphql-light';
import client from './client';

const createArticleMutation =
  new Mutation(client, `mutation CreateArticle($user: ArticleInput!) {
    createArticle(input: $article) {
      __typename
      id
      title
      publishDate

      author {
        __typename
        id
      }

      comments {
        __typename
        id
        text
      }
    }
  }`);

export default createArticleMutation;
```

### Mutate data

```javascript
import { createArticleMutation } from './graphql';

createArticleMutation
  .mutate({ id: article.id, name: article.name });
```

## Manage the cache

### Transform entities

When we request entities from the server, we often want to apply transformations to the incoming JSON data. Examples:

* transform a date string into a `Temporal` object;
* transform a foreign key to the corresponding object;
* transform the structure of the fetched data;
* etc.

You may add a `transformers` key in the config object. The `transformers` prop holds an object like below:

```javascript
import { store } from 'graphql-light';

store.setConfig({
  transformers: {
    Article: {
      data: {
        publishDate: Temporal.PlainDateTime.from
      }
    }
  }
});
```

In the example above, every incoming object with typename `"Article"` will have its `publishDate` (received as a string from the server) converted into a `PlainDateTime` object.

Another nice thing to do, is to convert the foreign keys into objects, to allow chaining properties as if data is denormalized:

```javascript
import { FetchStrategy } from 'graphql-light';
import client from './client';

store.setConfig({
  transformers: {
    Article: {
      data: {
        publishDate: Temporal.PlainDateTime.from
      },
      references: {
        authorId: {
          type: 'Author',
          field: 'author'
        }
      }
    }
  }
});
```

Not only does this allow chaining on nested entities' properties, it also allows to avoid fetching what has been previously fetched. If the authors have been previously fetched, we now just specify that the authorId on an Article points to an Author. In the result of the query, a field `author` is added alongside the field `authorId`.

It is assumed that the Author with id `authorId` has already been stored in the cache by a previous query. If that is not the case, you may add a callback to the query to handle missing references:

```javascript
import { FetchStrategy } from 'graphql-light';

query.setOnMissingRelation((propName, _propValue, _object, _variables, _data) => {
  switch (propName) {
    case 'authorId':
      return otherQuery.query({}, { fetchStrategy: FetchStrategy.NETWORK_ONLY });
  }
});
```

For arrays of references, you may either work with an array of ids or an array of objects containing only ids. Respectively, the config will look like:

```javascript
authorIds: {
  type: 'Author',
  field: 'authors'
}
```

```javascript
authors: {
  type: 'Author'
}
```

You may also use the `setTransformer` function on a query to change the fetched data before processing it.

### Delete and update entities

Deleting and updating entities from the cache is done by passing a callback function to `setOnFetchEntity` of the query instance:

```javascript
import { removeEntityById } from 'graphql-light';

query.setOnFetchEntity((normalizedEntity) => {
  if (normalizedEntity.__typename === 'Article') {
    return removeEntityById(normalizedEntity.id);
  }
});
```

3 functions are available to mark an entity as to be deleted or updated:
* `updateEntity`
* `removeEntity`
* `removeEntityById`

`updateEntity` is especially useful if we need to add or remove elements from arrays:

```javascript
updateEntity(normalizedEntity, 'articles', (articles) =>
  articles.filter(({ id }) => id !== 'article1' && id !== 'article2'));
```

### Handling arrays

When arrays are returned from the server, we need to know whether we want to append or override the array in the cache.

```javascript
query.setOnFetchArrayOfEntities((propName, _object) => {
  switch (propName) {
    case 'articles':
      return 'append';
  }
});
```

### Customize query behavior on cache updates

When the server returns a response for a query, the response is traversed recursively to retrieve all the objects and properties that need to be watched for cache updates. The response is also cached at the query level in order to return the cached data for subsequent requests.

Commonly when dealing with arrays, we need to customize that behavior in order to add or remove entities from arrays. In the example below, we queried an author and we listen for newly created articles; any new article belonging to the author is added into the query's cache:

```javascript
import { UpdateType } from 'graphql-light';

query.setOnStoreUpdate((update, variables, match) => {
  if (match(update,
      {
        type: UpdateType.CREATE_ENTITY,
        entity: { __typename: 'Article', authorId: variables.authorId }
      })
  ) {
    return (cache) => ({ ...cache, articles: [...cache.articles, entity] });
  }
});
```

`match` is a handy function that allows to check if an object is a subset of another object. In this case, we check if the `update` matches a `CREATE_ENTITY` update type, concerns an `'Article'` and if the article belongs to the author we queried.

Possible update types are  `CREATE_ENTITY`, `DELETE_ENTITY` and `UPDATE_PROP`.

The code above may be written more concisely using the `handleStoreUpdate` helper. Below the creation and deletion of articles have been handled using `handleStoreUpdate`:

```javascript
import { UpdateType } from 'graphql-light';

query.setOnStoreUpdate((update, variables, match) => {
  return handleStoreUpdate(update, {
    Article: {
      shouldUpdate(article) {
        return article.authorId === variables.authorId;
      },
      onCreate(article) {
        return (author) => ({
          ...author,
          articles: [...author.articles, entity]
        });
      },
      onDelete(article) {
        return (author) => ({
          ...author,
          articles: author.articles.filter(({ id }) => article.id !== id)
        });
      }
    }
  });
});
```

## Errors

`GraphQLError` is a custom error type that is thrown when the server returns GraphQL errors. It holds a `graphQLErrors` property that contains the list of errors.

In some cases you might want to catch such errors, for example when handling authentication errors:

```javascript
import { GraphQLError } from 'graphql-light';

someQuery.catch((error) => {
  if (error instanceof GraphQLError) {
    const isUnauthenticated = error.graphQLErrors.some((error) => {
      return error.extensions.code === 'unauthenticated';
    });

    if (isUnauthenticated) {
      // do something
      return;
    }
  }

  throw error;
});
```

## Advanced features

### Query caching strategies

By default, the response of a query is cached in the query instance. This cache is called the query cache and is different than the global cache, where the query cache is simply the denormalized response of the request.

The query cache is updated if any object or property present has been updated in the global cache.

When a query is called again, the query cache is returned.

This default strategy is called the query cache strategy.

Another strategy is available where the user writes a function that returns the response of the query. This strategy is called the user resolver strategy.

```javascript
query.setResolver((variables, entities) => {
  return entities[variables.authorId];
});
```

This strategy is faster for simple queries to resolve but may be slower for more complex queries than the query cache strategy.

When using the user resolver strategy, the `onStoreUpdate` function should return a boolean when a match is found.

The caching behavior can further be customized through the `setOnUnobservedStrategy` function:

```javascript
import { OnUnobservedStrategy } from 'graphql-light';

query.setOnUnobservedStrategy((_variables) => {
  return OnUnobservedStrategy.KEEP_UPDATING;
});
```

This allows to specify whether the query should continue listening for cache updates or not when no subscribers (`watch` calls) are listening.

By default, the value is `PAUSE_UPDATING`, but if the query is expected to be called frequently, it is more efficient to keep listening for cache updates, rather than rebuilding the response when called again.

Lastly, a query may be given two options:
* `clearWhenInactiveForDuration`: clean the query instance data and unsubscribe from cache updates after a given duration of inactivity.
* `refreshAfterDuration`: re-execute the query on the server after a given duration.

```javascript
query.setOptions((_variables) => ({
  clearWhenInactiveForDuration: Temporal.Duration.from({ days: 1 }),
  refreshAfterDuration: Temporal.Duration.from({ hours: 2 })
}));
```

### Dependent queries

It is possible to specify a set queries that a specific query is depending on. This is especially useful for reducing the document's object graph, by asking for foreign keys for data that might already have been fetched by other queries.

```javascript
query.setDependentQueries([
  (_variables) => otherQuery.query({})
]);
```

### Derived queries

Derived queries allow to extract some part of data from larger queries, or allow to derive data from multiple queries.

Say we execute a large query to initialize the application with base data. In the code below, we retrieve only the members from larger query:

```javascript
import { DerivedQuery } from 'graphql-light';
import organizationQuery from './organizationQuery';

const membersQuery =
  new DerivedQuery(
    [
      {
        query: organizationQuery,
        takeVariables: ({ organizationId }) => ({ organizationId })
      }
    ],
    ([organization]) => {
      return organization.members;
    }
  );

export default membersQuery;
```

`DerivedQuery` shares the API of `Query`, so we can call `fetch` and `watch` to retrieve data and watch for cache updates.

`DerivedQuery`'s constructor takes two arguments:

* the first argument is a list of queries to depend on. `takeVariables` is a function that allows to take the variables (given to `fetch` or `watch`) corresponding to each query.
* the second argument is the resolver function that returns the data. The resolver function's first argument is the list of responses of each query. In the example below, we depend only on one query, so we have a list of one item. The resolver function can also take a second and third argument which are the variables and the cached entities respectively.

Similarly to `setOnStoreUpdate` for queries, derived queries may optionally specify a `setOnQueryUpdate` callback function allowing to filter out relevant updates only. In the example below, we specify we only want our derived query to resolve when updates concern a `'Member'`.

```javascript
const membersQuery = new DerivedQuery(queries, resolver);

membersQuery.setOnQueryUpdate((update, _variables, match) => {
  if (match(update, { entity: { __typename: 'Member' } })) return true;
  return false;
});
```

### Fetching strategies

Different fetch strategies are supported for the `query` and `watch` functions:

```javascript
import { FetchStrategy } from 'graphql-light';
import { articlesQuery } from './graphql';

let articles =
  articlesQuery.watch({ authorId: 1 },
    (updatedArticles) => articles = updatedArticles,
    (unsubscribe) => unsubscriber = unsubscribe,
    { fetchStrategy: FetchStrategy.CACHE_AND_NETWORK }
  );
```

#### `FetchStrategy.CACHE_FIRST` (default)
First executes the query against the cache. If all requested data is present in the cache, that data is returned. Otherwise, executes the query against your GraphQL server and returns that data after caching it.

Prioritizes minimizing the number of network requests sent by your application.

This is the default fetch policy.

#### `FetchStrategy.CACHE_ONLY`
Executes the query only against the cache. It never queries your server in this case.

A cache-only query throws an error if the cache does not contain data for all requested fields.

#### `FetchStrategy.CACHE_AND_NETWORK`
Executes the full query against both the cache and your GraphQL server. The query automatically updates if the result of the server-side query modifies cached fields.

 Provides a fast response while also helping to keep cached data consistent with server data.

#### `FetchStrategy.NETWORK_ONLY`
Executes the full query against your GraphQL server, without first checking the cache. The query's result is stored in the cache.

Prioritizes consistency with server data, but can't provide a near-instantaneous response when cached data is available.

### Simple network requests

A `NetworkRequest` instance allows to execute a GraphQL request without any caching and transformation:

```javascript
import { NetworkRequest } from 'graphql-light';
import client from './client';

const promise = new NetworkRequest(client, `...`).execute(variables);
```

### Caching entities manually

```javascript
import { store } from 'graphql-light';

await store.store({ id: 'person1', __typename: 'Person', name: 'John' });

await store.store(
  { id: 'person1', __typename: 'Person', name: 'John' },
  { onFetchEntity, onFetchArrayOfEntities, onMissingRelation }
);
```

### Inspecting the cache

The `store` instance also provides some utility functions to inspect the cached data. The object is accessible globally, so you may call its functions from the Chrome Web Inspector.

```javascript
store.getEntities()
```

```javascript
store.getEntityById(id, subsetEntities)
```

```javascript
store.filterEntities({ __typename: 'Tag', label: 'foo' }, subsetEntities)
```

```javascript
store.getEntitiesByType('Tag', subsetEntities)
```

```javascript
store.countEntities(subsetEntities)
```

```javascript
store.getSingleEntity(subsetEntities)
```

```javascript
store.subscribe(console.log)
```

For each of these functions, the `subsetEntities` parameter is optional. If omitted, they act on the whole store.

### Debug mode

By default, the debug mode is on while the lib is in alpha, and it is recommended to keep it on. The debug mode checks the integrity of the store after every update.

```javascript
import { store } from 'graphql-light';

store.setConfig({ debug: false });
```

## API

### Client

#### `constructor(url, options)`

#### `async request(query, variables = {})`

### Query

#### `constructor(client, queryDocument)`

#### `async query(variables, options = {})`

#### `async watch(variables, subscriber, getUnsubscribeFn, options = {})`

#### `setDependentQueries(queries)`

#### `setOnFetchArrayOfEntities(onFetchArrayOfEntities)`

#### `setOnFetchEntity(onFetchEntity)`

#### `setOnStoreUpdate(onStoreUpdate)`

#### `setOnUnobservedStrategy(callback)`

#### `setOptions(callback)`

#### `setOnMissingRelation(callback)`

#### `setResolver(resolver)`

#### `setTransformer(transformer)`

### DerivedQuery

#### `constructor(queries, resolver)`

#### `async query(variables, options = {})`

#### `async watch(variables, subscriber, getUnsubscribeFn, options = {})`

#### `setOnQueryUpdate(onQueryUpdate)`

### Mutation

#### `constructor(client, queryDocument)`

#### `async mutate(variables, callback = _ => true)`

#### `setOnFetchArrayOfEntities(onFetchArrayOfEntities)`

#### `setOnFetchEntity(onFetchEntity)`

#### `setOnMissingRelation(callback)`

#### `setTransformer(transformer)`

### NetworkRequest

#### `constructor(client, queryDocument)`

#### `async execute(variables)`

### GraphQLError

### FetchStrategy constants

### OnUnobservedStrategy constants

### UpdateType constants

### removeEntity function

### removeEntityById function

### updateEntity function

### handleStoreUpdate function

### store instance

## Installation

You can get GraphQL Light via [npm](http://npmjs.com).

```bash
$ npm install graphql-light --save
```
