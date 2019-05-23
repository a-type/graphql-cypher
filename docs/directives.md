# Directives Design

This library uses directives in the GraphQL schema as a primary way of gaining information about the data the user wants to query from their database.

## `@cypher` directive

The `@cypher` directive is a kind of high-level catch-all for Cypher operations. It gives you full control over the exact Cypher statement you want to execute to retrieve your data. However, it requires the popular APOC library to work, and the queries it creates aren't as readable (or possibly as performant) as a more naturally written query.

The `@cypher` directive can only be applied to fields.

The `@cypher` directive supports the following parameters:

- `statement`: A Cypher statement you want to use to resolve this field's data.
- `statements`: A list of "Conditional Statement" objects for more fine-grained control over the Cypher that is run
  - A "Conditional Statement" has the following properties:
    - `statement`: A Cypher statement to run
    - `when`: (optional) A string conditional clause which determines when the statement should be run. Currently only supports existential conditions by simply stating a parameter name (example: `when: "$args.input.filter"`), which will skip this statement if that parameter is falsy.

### Global parameters

When you're writing your Cypher statement, you have access to some global parameters:

- `$args`: the arguments the current field was called with (including default argument values).
- `$context`: any contents of the special `cypherContext` property on the GraphQL context. Simply add a `.cypherContext` to your context and that value will be available as `$context`.
- `parent`: the parent object. This parameter will be an object if your field is the child of a non-Cypher object in your GraphQL schema, or a node if your field is the child of a Cypher object. For instance, if you decide to resolve your `UserSettings` type from a SQL database, but you want to add a `user` field to it which is resolved from your graph database, the `$parent` parameter in your `user` field's Cypher query would be the value of the `UserSettings` object. On the other hand, if your Cypher-based `User` type had a field `posts` which was also Cypher, the `parent` of a Post Cypher query would be the `User` node in your graph.
