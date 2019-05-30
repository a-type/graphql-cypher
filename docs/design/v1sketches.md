# v1 Feature and Usage Sketches

## Objectives before v1

- Make more sane queries without all the APOC function calls, which can't be good for planning
- Require a bit less manual Cypher while preserving the power of using it

```graphql
type User {
  id: ID!
  name: String!

  # example: skip relation, go straight to node
  posts: [Post!]! @cypherNode(relation: "HAS_POST", direction: "OUT")

  # example: edge based on relation
  friendships: [UserFriendshipEdge!]!
    @cypherRelation(name: "FRIENDS_WITH", direction: "OUT")
}

type Post {
  id: ID!
  title: String!

  # example: reverse edge
  author: User! @cypherNode(relation: "HAS_POST", direction: "IN")

  tags: [Tag!]! @cypherNode(relation: "HAS_TAG", direction: "OUT")
}

type Tag {
  id: ID!
  name: String!
}

type UserFriendshipEdge @cypherRelation(nodeField: "node") {
  type: String
  node: User!
}

type Query {
  # example: find a specific node to start a query
  user(id: ID!): User
    @cypher(match: "(user:User {id: $args.id})", return: "user")

  # example: find multiple nodes with WHERE clause
  posts(titleSearch: String, first: Int = 10, after: Int = 0): [Post!]!
    @cypher(
      match: "(post:Post)"
      where: "post.title =~ $args.titleSearch"
      skip: "$args.after"
      limit: "$args.first"
      return: "post"
    )
}

input UserUpdateInput {
  id: ID!
  name: String
}

type Mutation {
  # example: update a node
  updateUser(input: UserUpdateInput!): User
    @cypher(
      match: "(user:User {id:$args.input.id})"
      set: "user.name = $args.input.name"
      return: "user"
    )
}
```

Notes:

- We infer the label for queries from the returned GraphQL type name. The user could override this with an optional directive arg.

---

A GraphQL query like this:

```graphql
query UserAndPosts($id: ID!) {
  user(id: $id) {
    id
    name
    posts {
      id
      title
    }
  }
}
```

Generates a query like this:

```cypher
MATCH (user:User {id: $args.id})
RETURN user {.id, .name, posts: [(user)-[:HAS_POST]->(user_posts:Post) | user_posts {.id, .title}]}
```

---

A GraphQL query like this:

```graphql
query Posts {
  posts(titleSearch: "foo", first: 20) {
    id
    title
    author {
      id
      name
    }
  }
}
```

Generates a query like this:

```cypher
MATCH (posts:Post)
WHERE posts.title =~ $args.titleSearch
WITH posts
SKIP 0 LIMIT 20
RETURN posts {.id, .title, author: head([(posts)<-[:HAS_POST]-(posts_author:User) | posts_author {.id, .name}])}
```

---

A GraphQL query like this:

```graphql
query UserWithFriends {
  user(id: "foo") {
    id
    name
    friendships {
      type
      node {
        id
        name
      }
    }
  }
}
```

Generates a query like this:

```cypher
MATCH (user:User {id: $args.id})
RETURN user {.id, .name, friendships: [(user)-[user_friendships:FRIENDS_WITH]->(:User) | user_friendships {.type, friend: head(:User)-[user_friendships]->(user_friendships_friend:User) | user_friendships_friend {.id, .name}}]}
```

---

A GraphQL query like this:

```graphql
query UserPostsTags {
  user(id: "foo") {
    id
    posts {
      id
      tags {
        id
      }
    }
  }
}
```

Generates a query like this:

```cypher
MATCH (user:User {id: $args.id})
RETURN user {.id, posts: [(user)-[:HAS_POST]->(user_posts:Post) | user_posts {.id, tags: [(user_posts)-[:HAS_TAG]->(user_posts_tags:Tag) | user_posts_tags {.id}]}]}
```
