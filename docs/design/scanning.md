# Scanning Phase Design

When we first receive a request, we want to scan the field selections made, compare them to the schema, and determine the Cypher queries we will need to make to fulfill the request. We go ahead and do this ahead of time.

To gather the Cypher queries, we traverse the tree given to us in the `GraphQLResolveInfo` parameter. As we move down the tree, we gather contiguous blocks of `@cypher`-directive-annotated fields. When we reach the last `@cypher`-annotated field in a certain path of the tree, we will continue one more hop and gather any child fields in the selection as well (unless they have a `@cypherSkip` directive).

So, if we had a subtree like so:

```
Query
  user @cypher
    id
    name
    posts @cypher
      id
      title
    settings @cypherSkip
      id
      group @cypher
        id
        users @cypher
          id
```

we would generate two queries. The first:

```
Query A
[user]--->[post]
- id      - id
- name    - title
```

and the second:

```
Query B
[group]--->[user]
- id       - id
```

We generated two queries because the `@cypher` annotated blocks are separated by the `@cypherSkip` field `settings`. We added each of the non-annotated immediate children to our property selections for the nodes we grabbed in our queries.

We store these queries in a map, keyed on a string representation of their field path in the GraphQL query.

```
{
  'user': Query A,
  'user,settings,group': Query B
}
```

Later, when we traverse and resolve this request, we will use these paths to lookup where we need to run these queries.

Each query uses the context of the field selection, as well as the contents of the `@cypher` directives, to determine what we will end up querying for.

Our Cypher queries have the following properties:

- cypher: the actual cypher statement provided by the user to query the data
- fields: a list of sub-field names (properties, in our graph) which we will select
- params: a list of param names which will be required to run the query
- returnsList: a boolean for whether this query should return a list, or a single item
- args: a map of argument values from GraphQL which match up to our params list
- fieldQueries: a map of field names to sub-queries which we may use to resolve specific fields in this query using new Cypher statements. Field queries are recursive, each one is its own new Cypher query.

With this data, we can then construct a final Cypher query which will retrieve all the data we need.
