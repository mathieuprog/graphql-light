# GraphQL Light - a simple GraphQL client

## Features

### Caching of normalized entities

Entities are normalized and cached into a global store.

### Subscribe to data updates

You subscribe to queries : receive any updates on the fetched data after the initial fetch.

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

const articlesQuery = new Query(client, ARTICLES_QUERY, (entities, variables) => {
  const { userId } = variables;

  return entities[userId].articles;
});

export default {
  articlesQuery
};
```

A `Query` instance allows executing GraphQL requests through the `subscribe` function that it exposes (see below).

The third argument passed to `Query`'s constructor is a function that retrieves the fetched data from the store. It may
seem unnecessary and redundant as the server did the same operation (fetched the data from the DB), however this is
needed in order to subscribe to data updates in the store; whenever there is an update in the store, this code is
re-executed, and if the data changed, the listener is called (see `subscribe` and its second argument below).

Another function can optionally be passed as a fourth argument allowing to apply some transformations before storing the
data into the cache. For example, if you want to convert datetime strings to `PlainDateTime` objects:

```javascript
const articlesQuery = new Query(client, ARTICLES_QUERY, (entities, variables) => {
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

Notice how the library doesn't try to parse the GraphQL query string in order to deduce what needs to be returned, nor
try to transform the server response automatically. Instead, you explicitly write the code to retrieve data from the
store and to transform data before storage.

### Fetch data

```javascript
import { articlesQuery } from '../graphql';

// import the callback function from your framework that is fired when the component unmounts
// this example uses Svelte
import { onDestroy } from 'svelte';

const unsubscribers = [];

let articles = articlesQuery.subscribe({ userId: 1 },
  updatedArticles => {
    articles = updatedArticles;
  },
  unsubscirbe => {
    unsubscribers.push(unsubscirbe);
  });

onDestroy(() => unsubscribers.forEach(unsubscriber => unsubscriber()));

// if using Svelte, you may use the await block to wait for the articles data

{#await articles}
  Loading...
{:then resolvedArticles}
  <!-- do something with the resolved data -->
{/await}
```

The `subscribe` function allows to execute a GraphQL request and returns a promise which resolves into the requested
data. The data is returned from the store through the function that you passed to the `Query` instance.

The first argument is an object containing the variables that the GraphQL query requires.

The second argument is a callback function called whenever the stored data changes.

### Derived queries

Some data may be derived from other queries' responses. For example, say we have a query to fetch the organizations that a
user belongs to, with its locations, its services, etc.

```javascript
const organizationsQuery = new Query(client, ORGANIZATIONS_QUERY, (entities, variables) => {
  const { userId } = variables;

  return entities[userId].organizations;
});
```

You can create a `DerivedQuery` to retrieve derived data from the response of the organization's query. In this case,
we want to retrieve all the locations that can already be fetched through the organization query above.

```javascript
import { DerivedQuery } from 'graphql-light';

const locationsQuery = new DerivedQuery(
  [
    { query: organizationsQuery, takeVariables: ({ organization }) => ({ ...organization }) }
  ],
  (entities, variables) => {
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

```javascript
let locations = locationsQuery.subscribe({ organization: { userId: 1 } }, updatedLocations => {
  locations = updatedLocations;
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

const deleteArticleMutation = new Mutation(client, DELETE_ARTICLE_MUTATION, ({ deleteArticle: data }) => {
  if (data.__typename !== 'DeleteArticleSuccess') {
    return null;
  }

  const article = {
    ...data.article,
    __deleted: true
  };

  const author = {
    ...author,
    articles: [article],
    __onReplace: { articles: 'append' }
  }

  return author;
});
```

Add a property `__deleted` to the entity that you want to remove from the cache.

In the example above, we cannot just return the article; we must also return the author with its list of articles, as
the deleted article should also be removed from that list. This should be done for every list that contains the deleted
article.

If you only want to remove an entity from a list, without deleting the entity, use `__unlink` and set it to `true`.

### Inspect the global store (cache)

```javascript
graphQLCache.entities()
```

## Installation

You can get GraphQL Light via [npm](http://npmjs.com).

```bash
$ npm install graphql-light --save
```
