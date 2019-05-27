# Execution Phase Design

Execution occurs within a GraphQL middleware, so it has access to before, during, and after states for each resolver.

We begin at the root resolver for the operation. The Cypher query map is generated from the `GraphQLResolveInfo`. This query map has every Cypher query we will need to fulfill the request mapped to the field path it must be invoked from. We cannot make any Cypher queries yet; they may depend on the data provided by their parent in the GraphQL tree. So, we cache these queries in context and proceed.

Still in the middleware, we add a `runCypher` function to the `context` of the resolver which will be run. The user will call this function if they want to access data from our query.

There are reasons a user may not want to run a query within a resolver. Perhaps they have authorization logic in place and decide to exit the resolver early if the user isn't authorized to view the node.

If the user decides they want to access data from the Cypher query, they will call and `await` `runCypher` and block until it returns. When `runCypher` is called, that is when we will run our Cypher query and return the result (if the field in question is the 'root' of a Cypher query) or simply return a portion of the previously run query result (if the field is the child of a previous field which ran a query).

If there is no Cypher query associated with this field path, `runCypher` just immediately returns `parent[fieldName]` like a default resolver. Usage must remain consistent, because we will not necessarily know whether a Cypher query was required at any particular field. A field with a `@cypher` directive would require a new query to be made if it was the first field in the tree to do so, but if that same field were the child of a previous `@cypher` field, it would already have its data from its parent query. When we write a resolver, we do not want to care about this, so we just await `runCypher` and trust that it will return our data.

Once all resolvers have finished, the query is complete. We have done all the work this library needs to do and we can simply return the result.
