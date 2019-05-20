# graphql-cypher

> The following documentation is a hypothetical sketch, none of this works yet, and I may give up and carry on with neo4j-graphql-js. My objective here is to see if I can create something simpler without all the confusing magic and auto-generation.

A simple, no-frills translation layer between GraphQL and Cypher.

```graphql
input Pagination {
  first: Int
  offset: Int
}

input PostFilter {
  titleMatch: String
}

type Post {
  id: ID!
  title: String!
  body: String!
}

type User {
  id: ID!
  name: String!
  email: String!

  posts(
    pagination: Pagination = { first: 10, offset: 0 }
    filter: PostFilter
  ): [Post!]!
}

type Query {
  user(id: ID!): User
}
```

```ts
import { autoResolver, cypherResolver } from 'graphql-cypher';

const resolvers = {
  Query: {
    // auto-generates: MATCH (user:User {id: $args.id}) RETURN user {...selectionFields}
    // where selectionFields are gathered based on the query selection
    user: autoResolver,
  },
  User: {
    posts: cypherResolver`
      MATCH (parent)-[:AUTHOR_OF]->(post:Post)
      ${(_parent, args) =>
        !!args.filter
          ? `
        WHERE post.title =~ $args.filter.titleMatch
        `
          : null}
      RETURN post
      SKIP $args.pagination.offset
      LIMIT $args.pagination.first
    `,
  },
};
```

---

This project was bootstrapped with [TSDX](https://github.com/jaredpalmer/tsdx).

## Local Development

Below is a list of commands you will probably find useful.

### `npm start` or `yarn start`

Runs the project in development/watch mode. Your project will be rebuilt upon changes. TSDX has a special logger for you convenience. Error messages are pretty printed and formatted for compatibility VS Code's Problems tab.

<img src="https://user-images.githubusercontent.com/4060187/52168303-574d3a00-26f6-11e9-9f3b-71dbec9ebfcb.gif" width="600" />

Your library will be rebuilt if you make edits.

### `npm run build` or `yarn build`

Bundles the package to the `dist` folder.
The package is optimized and bundled with Rollup into multiple formats (CommonJS, UMD, and ES Module).

<img src="https://user-images.githubusercontent.com/4060187/52168322-a98e5b00-26f6-11e9-8cf6-222d716b75ef.gif" width="600" />

### `npm test` or `yarn test`

Runs the test watcher (Jest) in an interactive mode.
By default, runs tests related to files changed since the last commit.
