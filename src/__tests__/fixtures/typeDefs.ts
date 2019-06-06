import { directiveTypeDefs } from '../../typeDefs';

export default `
${directiveTypeDefs()}

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
  user: User!
    @cypher(
      match: "(user:User {id: $parent.userId})"
      return: "user"
    )
}

type PostsContainer @cypherVirtual {
  posts: [Post!]! @cypherNode(relationship: "HAS_POST", direction: OUT, where: "node.title =~ $virtual.titleMatch")
}

type VirtualLayer @cypherVirtual {
  user: User @cypher(match: "(user:User {id: $virtual.userId})", return: "user")
  post: Post @cypher(match: "(post:Post {id: $virtual.postId})", return: "post")
}

type User {
  id: ID!
  name: String!
  email: String!

  # this one doesnt have args and can use @cypherNode.
  simplePosts: [Post!]!
    @cypherNode(relationship: "HAS_POST", direction: OUT)

  posts(
    pagination: Pagination = { first: 10, offset: 0 }
    filter: PostFilter
  ): [Post!]!
    @cypherCustom(statements: [
      {
        when: "$args.filter"
        statement: """
          MATCH ($parent)-[:AUTHOR_OF]->(post:Post)
          WHERE post.title =~ $args.filter.titleMatch
          RETURN post
          SKIP $args.pagination.offset
          LIMIT $args.pagination.first
        """
      },
      {
        statement: """
          MATCH ($parent)-[:AUTHOR_OF]->(post:Post)
          RETURN post
          SKIP $args.pagination.offset
          LIMIT $args.pagination.first
        """
      }
    ])

  postsConnection(titleMatch: String): PostsContainer!

  settings: UserSettings! @cypherSkip
}

type Query {
  user(id: ID!): User
    @cypher(
      match: "(user:User {id: $args.id})"
      return: "user"
    )

  post(id: ID!): Post
    @cypher(
      match: "(post:Post {id: $args.id})"
      return: "post"
    )

  userSettings(id: ID!): UserSettings

  virtual(userId: ID!, postId: ID!): VirtualLayer
}

type Mutation {
  createUser(name: String!, email: String!): User!
    @generateId
    @cypher(
      create: "(user:User {id: $generated.id, name: $args.name, email: $args.email})"
      return: "user"
    )
}
`;
