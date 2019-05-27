# graphql-cypher

A simple but powerful translation layer between GraphQL and Cypher.

> **Note** This library is currently coupled to Neo4j as a backing database, but I'd be happy to accept contributions to decrease that coupling if there is another graph database which uses Cypher that someone would like to support.

> **Note** In its current form, all features of this library require APOC to run. See [Limitations](#limitations)

### [Read the Documentation](#documentation)

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

### 🔑 Authorization friendly

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

## Goals

- Support application-focused use cases, giving users as much control as possible over their GraphQL query and mutation contracts
- Make it dead simple for a user familiar with Cypher to start resolving complex GraphQL queries with next to no business logic
- Support multi-data-source apps, letting users choose which data store is the right fit for each part of their GraphQL schema and stitch them together with ease
- Allow users to utilize resolvers to write logic surrounding their data access when it's necessary, without hacky workarounds

## Documentation

### Setup

Install the library and its dependencies\* (if you don't have them already):

```
npm i -s graphql-cypher graphql graphql-middleware neo4j-driver
```

_\* `graphql-middleware` is not required if you're using `graphql-yoga` or another GraphQL server that supports middleware natively_

The first step to get started is to add the middleware to your schema.

**GraphQL Yoga Server**

```ts
import { middleware as cypherMiddleware } from 'graphql-cypher';
import { GraphQLServer } from 'graphql-yoga';

const server = new GraphQLServer({
  // ... typedefs, etc
  middlewares: [cypherMiddleware],
});
```

**Other GraphQL Server**

```ts
import { middleware as cypherMiddleware } from 'graphql-cypher';
import { applyMiddleware } from 'graphql-middleware';
import schema from './my-schema';

const schemaWithMiddleware = applyMiddleware(schema, cypherMiddleware);
```

With the middleware installed, you'll now need to add this library's custom directives. You may need to check documentation for your GraphQL library on how to do this. An example is provided below with the widely-used `graphql-tools` `makeExecutableSchema`.

**Using makeExecutableSchema**

```ts
import { CypherDirective } from 'graphql-cypher';
import { makeExecutableSchema } from 'graphql-tools';

const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
  schemaDirectives: {
    cypher: CypherDirective,
  },
});
```

Now you're ready to begin adding directives to your schema. Find a field you want to resolve with Cypher and create your directive.

```graphql
type Query {
  user(id: ID!): User
    @cypher(
      statement: """
      MATCH (user:User {id: $args.id}) RETURN user
      """
    )
}
```

You don't need to add a resolver. Make a query against your schema and see what happens!

### Queries

Querying your data in `graphql-cypher` is done via `@cypher` directives. There are a few ways you can write your Cypher statements:

**Simple mode**: one statement per directive, which will be run every time.

```graphql
type Query {
  user(id: ID!): User
    @cypher(
      statement: """
      MATCH (user:User {id: $args.id}) RETURN user
      """
    )
}
```

**Conditional mode**: multiple statements with conditions; the one that matches will be run.

```graphql
type Query {
  posts(filter: PostFilter): [Post!]!
    @cypher(
      statements: [
        {
          when: "$args.filter"
          statement: """
          MATCH (post:Post)
          WHERE post.title =~ $args.filter.titleMatch
          RETURN post
          """
        }
        {
          statement: """
          MATCH (post:Post)
          RETURN post
          """
        }
      ]
    )
}
```

_In conditional mode, always write your last statement without a condition._

Currently, conditional mode only supports existential conditions: supply an arg name to `when`, and it will choose that statement if that arg exists. This supports deep paths.

#### `@cypher` globals

We've already seen the `$args` parameter, which is available to our `@cypher` statements. There are a few other parameters as well:

- `$args`: All the arguments provided to your GraphQL field. This includes defaulted values.
- `parent`: This is the parent of the current field; analagous to the `parent` field in a GraphQL resolver. `parent` works even if the parent of your GraphQL field wasn't resolved from Cypher! Example usage: `MATCH (parent)-[:LIKES]->(post:Post)` (for Cypher parents) or `MATCH (user:User{id: parent.userId})` (for non-Cypher parents)
- `$context`: Pass values via a special `cypherContext` property on your GraphQL context, and they will be populated in this parameter. This is great for context-centric values like the ID or permissions of the current API user.
- `$generated`: Any values generated by `graphql-cypher` will be available as properties on this parameter (see: [Generated Values](#generated-values))

#### Rules for `@cypher` directives

- Don't specify property selections on the returned node ("`{.id, .name}`", etc). These will be managed by the library.

### Mutations

Mutations are pretty similar to queries. In the root field, you'll want to write some Cypher that will modify your graph. From there, any sub-selections in your mutation will be added to the mutation Cypher query just like they would have in a read query.

```graphql
type Mutation {
  updatePerson(input: PersonUpdateInput!): Person!
    @cypher(
      statement: """
      MATCH (person:Person{id: $args.input.id})
      SET person.firstName = coalesce($args.input.firstName, person.firstName)
      SET person.lastName = coalesce($args.input.lastName, person.lastName)
      SET person.age = coalesce($args.input.age, person.age)
      RETURN person
      """
    )
}
```

The `@cypher` directive works the same way as queries; you can even use `when` to apply different statements to your mutation based on user input.

_Check out [Generated Values](#generated-values) learn about the generated values utility, which can be useful for generating IDs for create mutations._

### Custom Resolver Logic

You can add your own custom resolver logic into the Cypher execution flow to control user access to data or call out to external services before returning the result.

Simply add your own resolver to a Cypher-powered field, and then be sure to call `await context.runCypher()` to retrieve the field's data from your graph database when you're ready for it.

#### Example: Authorization

```ts
const authorizedResolver = (parent, args, context) => {
  if (!context.isAdmin) {
    return null;
  }

  return context.runCypher();
};
```

### Example: External Service

```ts
const notifyingResolver = async (parent, args, context) => {
  const data = await context.runCypher();
  context.notifier.record('The user fetched the data');
  return data;
};
```

There are limitations to custom resolvers. Currently, there is no way to modify incoming arguments to a Cypher-powered field. This is a limitation of the design of this library and GraphQL itself; by the time your resolver is called, the Cypher query is likely to have already been sent to your database. With the exception of root fields, there is no way for us to modify arguments before making that initial Cypher query, and still retain the benefit of batching up all field Cypher statements into one larger query (which is the whole benefit of the library!) I have some ideas about possible ways to approach this problem, but they are a bit heavy and I'm waiting to see a bit more of how the usage pans out. In the meantime, if there's logic to do, it basically has to be done in Cypher.

### Generated Values

This library ships with utility directive support for generating some values as extra arguments to your Cypher statements. All generated values are available on the `$generated` parameter in Cypher.

`@generateId`: Use it as a directive on a field to generate an ID which will be supplied as an extra argument to that field. This is useful for create mutations.

```graphql
type Mutation {
  createPerson(input: PersonCreateInput!): Person!
    @generateId(argName: "personId")
    @cypher(
      statement: """
      CREATE (person:Person{id: $generated.personId})
      SET person += $args.input
      RETURN person
      """
    )
}
```

`@generateId` takes one optional argument, `argName`, which can be used to change the property it gets assigned to on `$generated`. That's why the value is available on `$generated.personId` above. The default is `$generated.id`.

## Limitations

- `@cypher` directives rely on the popular APOC library for Neo4j. Chances are if you're running Neo4j, you already have it installed.
- Using `context.runCypher` to selectively fetch data only prevents the data from being queried if the field is the root field in your operation or the direct descendant of a non-Cypher-powered field. Otherwise, the data will still be fetched, but by omitting `runCypher` you will just not return it.
  - This could probably be changed, but not within the current middleware model. A new traversal to just resolve the Cypher queries before the main resolvers are called would probably need to be introduced.
- `@cypher` custom queries are probably not going to be as performant as a hand-written query. But, that is the core tradeoff of the library; it would be labor-intensive if not infeasible to try to anticipate and craft a custom query for every GraphQL query your users make.
  - One of my first roadmap items is to investigate more 'builder-style' query directives which make a more native query instead of only supporting raw Cypher statements
- Relationships are simply not a part of the way this library works right now. This is obviously a significant limitation, but it shouldn't be hard to change... I just haven't gotten around to defining that use case yet.

## Inspiration

Obviously the official [`neo4j-graphql-js`](https://github.com/neo4j-graphql/neo4j-graphql-js) was a huge inspiration for this library. I learned a lot by reading over their output queries, without which I would probably have struggled for far longer trying to understand how to craft the underlying Cypher queries for this library.

`neo4j-graphql-js` still has a lot of great features which I don't intend to bring to `graphql-cypher`, namely things like automated generation with convention-based parameters. I hope that `graphql-cypher` will become a tool geared toward a specific audience of people like me who want full control over their app, and `neo4j-graphql-js` can continue to evolve in the direction of auto-generated schemas and turnkey prototyping solutions.

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

### `npm run test:integration`

This library has a full integration tests suite against a real Neo4j database. To run it, you need to have Docker started. It will manage creating Neo4j containers and removing them as needed.
