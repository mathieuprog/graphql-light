# GraphQL Light - a simple GraphQL client

## Features

### Caching of normalized entities

Entities are normalized and cached into a global store.

### Watch for data updates

Receive any updates on the fetched data after the initial fetch.

### Explicitness

The difference with other clients (such as Apollo) is that this library requires you to write code for each query that
tells what to update in the cache, what data to retrieve for a query, etc.

More code is then needed to configure your GraphQL queries, but in return you also have way more understanding and full
control over the way the data is processed and cached, as you code it yourself.

If you feel that Apollo is like a black box that often doesn't work the way you expect, is too complex, or is just too
hard to understand, then have a look at how this library works as a GraphQL client.

## Limitations

Your objects must have global unique identifiers (e.g. UUIDv4). There is no plan to support sequential IDs.

Objects must have an `id` property storing their UUID.

The GraphQL server must return the `id` and `__typename` properties for every cacheable entity.

## Usage

### Instantiate and configure GraphQL Light's client

Create a `graphql/client.js` file in your project with the following content:

```javascript
import { Client } from 'graphql-light';

const url = 'http://myapp.localhost:4000/api';
const client = new Client(url, { credentials: 'include' });

export default client;
```

The second parameter passed to `Client` are the options for the request, using the Fetch API:<br>
https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch#supplying_request_options

### Write a GraphQL query as a string

```javascript
export default `query($userId: ID!) {
  user(userId: $userId) {
    __typename
    id

    articles {
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
  }
}`
```

Save the code for example in a `graphql/queries/articles.js` file.

It is important to always query the `__typename` and the `id` for every object that is or needs to be cached.

### Create a Query instance

```javascript
import { Query } from 'graphql-light';
import client from './client';
import ARTICLES_QUERY from './queries/articles';

const articlesQuery = new Query(client, ARTICLES_QUERY, (variables, entities) => {
  const { userId } = variables;

  return entities[userId].articles;
});

export default {
  articlesQuery
};
```

A `Query` instance allows executing GraphQL requests through the `watch` function that it exposes (see below).

The third argument passed to `Query`'s constructor is a function that retrieves the fetched data from the store. It may
seem unnecessary and redundant as the server did the same operation (fetched the data from the DB), however this is
needed in order to watch for data updates in the store; whenever there is an update in the store, this code is
re-executed, and if the data changed, the listener is called (see `watch` and its second argument below).

Another function can optionally be passed as a fourth argument allowing to apply some transformations before storing the
data into the cache. For example, if you want to convert datetime strings to `PlainDateTime` objects:

```javascript
import { Query } from 'graphql-light';
import client from './client';
import ARTICLES_QUERY from './queries/articles';

const articlesQuery = new Query(client, ARTICLES_QUERY, (variables, entities) => {
  const { userId } = variables;

  return entities[userId].articles;
}, responseData => {
  return responseData.user.articles.map(article => {
    return {
      ...article,
      publishDate: PlainDateTime.from(article.publishDate)
    };
  });
});
```

### Fetch data

#### `watch`

```javascript
import { articlesQuery } from '../graphql';

// import the callback function from your framework that is fired when the component unmounts
// this example uses Svelte
import { onDestroy } from 'svelte';

const unsubscribers = [];

let articles = articlesQuery.watch({ userId: 1 },
  updatedArticles => {
    articles = updatedArticles;
  },
  unsubscribe => {
    unsubscribers.push(unsubscribe);
  });

onDestroy(() => unsubscribers.forEach(unsubscriber => unsubscriber()));

// if using Svelte, you may use the await block to wait for the articles data

{#await articles}
  Loading...
{:then resolvedArticles}
  <!-- do something with the resolved data -->
{/await}
```

The `watch` function allows to execute a GraphQL request and returns a promise which resolves into the requested
data. The data is returned from the store through the function that you passed to the `Query` instance.

The first argument is an object containing the variables that the GraphQL query requires.

The second argument is a callback function called whenever the stored data changes.

The third argument allows you to retrieve the unsubscriber function which you need to call when you no longer need to
watch for data updates.

A fourth argument may be passed allowing to pass options. The only supported option for now is the [fetching strategy](#fetching-strategies).

#### `query`

If you don't need to listen to cache updates, you may call the `query` function:

```javascript
import { articlesQuery } from '../graphql';

let articles = articlesQuery.query({ userId: 1 });

// if using Svelte, you may use the await block to wait for the articles data

{#await articles}
  Loading...
{:then resolvedArticles}
  <!-- do something with the resolved data -->
{/await}
```

### Derived queries

Some data may be derived from other queries' responses. For example, say we have a query to fetch the organizations that
a user belongs to, with its locations, its services, etc.

```javascript
import { Query } from 'graphql-light';
import client from './client';
import ORGANIZATIONS_QUERY from './queries/organizations';

const organizationsQuery = new Query(client, ORGANIZATIONS_QUERY, (variables, entities) => {
  const { userId } = variables;

  return entities[userId].organizations;
});
```

You can create a `DerivedQuery` to retrieve derived data from the response of the organization's query. In this case,
we want to retrieve all the locations that can already be fetched through the organization query above.

```javascript
import { DerivedQuery } from 'graphql-light';
import { organizationsQuery } from '../graphql';

const locationsQuery = new DerivedQuery(
  [
    { query: organizationsQuery, takeVariables: ({ organization }) => ({ ...organization }) }
  ],
  (variables, entities) => {
    const { organization: { userId } } = variables;

    return entities[userId].organizations.flatMap(o => o.locations);
  });
```

The first argument is a list of queries from which this query depends on. In this example, the locations are available
from the response of the organization query.
You need to provide an object with two properties:
* `query`: the query we depend on;
* `takeVariables`: the variables to take from the `subscription` function call (see below) for that specific query.

The second argument is the function that retrieves the requested data from the store after the response has been cached.

Then you can call the `watch` or `query` function to fetch the data. The arguments of these functions are the same
as those of `Query`'s.

```javascript
import { locationsQuery } from '../graphql';

let locations = locationsQuery.watch({ organization: { userId: 1 } },
  updatedLocations => {
    locations = updatedLocations;
  },
  unsubscribe => {
    unsubscribers.push(unsubscribe);
  });
```

As the query may depend on multiple other queries, it is a good idea to scope the variables. Here the location query
depends on the organization query, so we create an organization object containing the variables for the organization
query.

### Mutations

```javascript
export default `mutation CreateArticle($user: ArticleInput!) {
  createArticle(input: $article) {
    __typename
    ... on FormInputErrors {
      errors {
        key
        message
      }
    }
    ... on CreateArticleSuccess {
      article {
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
    }
  }
}`;
```

```javascript
import { Mutation } from 'graphql-light';
import client from './client';
import CREATE_ARTICLE_MUTATION from './mutations/create-article';

const createArticleMutation = new Mutation(client, CREATE_ARTICLE_MUTATION, ({ createArticle: data }) => {
  if (data.__typename !== 'CreateArticleSuccess') {
    return null;
  }

  const article = {
    ...data.article,
    publishDate: PlainDateTime.from(article.publishDate)
  };

  const author = {
    ...author,
    articles: [article],
    __onReplace: { articles: 'append' }
  }

  return author;
});
```

The third argument for `Mutation`'s constructor is a function that returns the data that will be normalized and stored
in the cache.

In the example above, if we simply return the newly created article, the author's list of articles won't be updated. For
this reason we create an object representing an author (at least the `id` and `__typename` must be included) with a list
of new articles to be appended in the list. This will update the author's list of articles but will also store the new
article as the data is being normalized.

Instead of appending you may also specify `'override'` in order to replace the whole list with the new list.

```javascript
import { createArticleMutation } from '../graphql';

const newArticleData = {
  name,
  articles: articles.map(({ id }) => id)
};

createArticleMutation
  .mutate({ id: article.id, article: newArticleData })
  .then(({ createArticle: data }) => {
    if (data.__typename === 'FormInputErrors') {
      unexpectedErrorOccurred = true;
      throw new UnexpectedFormErrors(data.errors);
    }
  })
  .catch(e => {
    unexpectedErrorOccurred = true;
    throw e;
  });
```

### Deleting entities

When an entity has been deleted, you should also remove it from the cache.

```javascript
import { Mutation } from 'graphql-light';
import client from './client';
import DELETE_ARTICLE_MUTATION from './mutations/delete-article';

const deleteArticleMutation = new Mutation(client, DELETE_ARTICLE_MUTATION, ({ deleteArticle: data }) => {
  if (data.__typename !== 'DeleteArticleSuccess') {
    return null;
  }

  const article = {
    ...data.article,
    __delete: true
  };

  const author = {
    ...author,
    articles: [article],
    __onReplace: { articles: 'append' }
  }

  return author;
});
```

Add a property `__delete` to the entity that you want to remove from the cache.

In the example above, we cannot just return the article; we must also return the author with its list of articles, as
the deleted article should also be removed from that list. This should be done for every list that contains the deleted
article.

If you only want to remove an entity from a list, without deleting the entity, use `__unlink` and set it to `true`.

### Fetching strategies

Different fetching strategies can be used when calling `watch`.

```javascript
import { FetchStrategy } from 'graphql-light';
import { articlesQuery } from '../graphql';

let articles = articlesQuery.watch({ userId: 1 },
  updatedArticles => articles = updatedArticles,
  unsubscribe => unsubscribers.push(unsubscribe),
  { fetchStrategy: FetchStrategy.CACHE_AND_NETWORK });
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

### Global function to transform data before caching

In the example below, we want to convert dates formatted as strings into datetime objects:

```javascript
import { store, transform } from 'graphql-light';

store.setConfig({ transformers: { transformArticle } });

function transformArticle(article) {
  return transform(article, {
    publishDate: Temporal.PlainDateTime.from
  });
}
```

### Errors

You may catch GraphQL errors as seen in the example below:

```javascript
import { GraphQLError } from 'graphql-light';
import GraphQLErrorCode from '../graphql';

articlesPromise
  .catch(error => {
    if (error instanceof GraphQLError) {
      const isUnauthenticated = error.graphQLErrors.some(error => {
        return error.extensions.code === GraphQLErrorCode.UNAUTHENTICATED;
      });

      if (isUnauthenticated) {
        // do something
        return;
      }
    }

    throw error;
  });
```

`GraphQLErrorCode` in this example is just a custom object in the user's app:

```javascript
// 'graphql/GraphQLErrorCode.js'

export default Object.freeze({
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  // ...
});
```

### Simple network requests

```javascript
import { NetworkRequest } from 'graphql-light';
import client from './client';
import ARTICLES_QUERY from './queries/articles';

const promise = new NetworkRequest(client, ARTICLES_QUERY).execute(variables);
```

### Inspect the global store (cache)

The `store` object provides some utility functions to inspect the cached data. The object is accessible globally, so you may call its functions from the Chrome Web Inspector.

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

For each of these functions, the `subsetEntities` parameter is optional. If omitted, they act on the whole store.

## Installation

You can get GraphQL Light via [npm](http://npmjs.com).

```bash
$ npm install graphql-light --save
```
