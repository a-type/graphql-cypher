# graphql-cypher

A simple, no-frills translation layer between GraphQL and Cypher.

> **Note** This library is currently coupled to Neo4j as a backing database, but I'd be happy to accept contributions to decrease that coupling if there is another graph database which uses Cypher that someone would like to support.

> **Note** In its current form, all features of this library require APOC to run. See [Limitations](#limitations)

### Example Schema

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

type UserSettings {
  id: ID!
  homepage: String!
}

type User {
  id: ID!
  name: String!
  email: String!

  posts(
    pagination: Pagination = { first: 10, offset: 0 }
    filter: PostFilter
  ): [Post!]!
    @cypher(
      statements: [
        {
          when: "$args.filter"
          statement: """
          MATCH (parent)-[:AUTHOR_OF]->(post:Post)
          WHERE post.title =~ $args.filter.titleMatch
          RETURN post
          SKIP $args.pagination.offset
          LIMIT $args.pagination.first
          """
        }
        {
          statement: """
          MATCH (parent)-[:AUTHOR_OF]->(post:Post)
          RETURN post
          SKIP $args.pagination.offset
          LIMIT $args.pagination.first
          """
        }
      ]
    )

  settings: UserSettings! @cypherSkip
}

type Query {
  user(id: ID!): User
    @cypher(
      statement: """
      MATCH (user:User {id: $args.id}) RETURN user
      """
    )
}
```

## Key Features

### 🔨 Simple setup

Attach Cypher resolution directives to an field in your schema and they'll be resolved accordingly, no matter where they are in the query.

### 🌎 Helpful Cypher globals

Important data is added automatically to your Cypher queries for you to reference. In addition to `$args` (the field arguments), you get `parent` (the parent node) and `context` (special values you can add to your GraphQL context to give to every query).

```graphql
type User {
  posts(offset: Int = 10): [Post!]!
    @cypher(
      statement: "MATCH (parent)-[:HAS_POST]->(p:Post) RETURN p SKIP $args.offset LIMIT $context.globalPageSize"
    )
}
```

### 🔗 Multi-data-source friendly

"Skip" fields which are resolved from data sources external from your Cypher-powered database easily. `graphql-cypher` will plan all the queries and inter-dependencies for you.

Externally-powered fields are even woven back into Cypher via the `parent` variable, just like any normal Cypher query, so you can reference external data just as easily as graph-native data.

```graphql
type User {
  # this field is resolved from an external source...
  settings: UserSettings! @cypherSkip
}

type UserSettings {
  account: Account!
    @cypher(
      statement: """
      MATCH (a:Account{id: parent.id}) RETURN a
      """
    )
}

type Query {
  user(id: ID!): User!
    @cypher(statement: "MATCH (u:User{id:$args.id}) RETURN u")
}
```

### 🔑 Authorization and custom-logic friendly

`graphql-cypher` is simple by default, but it gives you the option to optionally omit fields based on logic you define in a regular old reducer. This means it can better support custom authorization or pre-query logic.

```ts
const resolvers = {
  Query: {
    secret: (parent, args, ctx) => {
      if (!ctx.isAdmin) {
        return null;
      }

      // this function is added to context for you so that you can
      // customize how you invoke your cypher operation
      return ctx.runCypher();
    },
  },
};
```

## Mutations

TODO

## Limitations

- `@cypher` directives rely on the popular APOC library for Neo4j. Chances are if you're running Neo4j, you already have it installed.
- Using `context.runCypher` to selectively fetch data only prevents the data from being queried if the field is the root field in your operation or the direct descendant of a non-Cypher-powered field. Otherwise, the data will still be fetched, but by omitting `runCypher` you will just not return it.
  - This could probably be changed, but not within the current middleware model. A new traversal to just resolve the Cypher queries before the main resolvers are called would probably need to be introduced.
- `@cypher` custom queries are probably not going to be as performant as a hand-written query. But, that is the core tradeoff of the library; it would be labor-intensive if not infeasible to try to anticipate and craft a custom query for every GraphQL query your users make.
  - One of my first roadmap items is to investigate more 'builder-style' query directives which make a more native query instead of only supporting raw Cypher statements

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
