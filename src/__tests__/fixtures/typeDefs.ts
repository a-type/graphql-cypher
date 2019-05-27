export default `
input CypherConditionalStatement { statement: String!, when: String }
directive @cypher(
  statement: String
  statements: [CypherConditionalStatement!]
) on FIELD_DEFINITION
directive @cypherSkip on FIELD_DEFINITION
directive @generateId(argName: String) on FIELD_DEFINITION

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
      statement: """
      MATCH (user:User {id: $parent.userId}) RETURN user
      """
    )
}

type User {
  id: ID!
  name: String!
  email: String!

  posts(
    pagination: Pagination = { first: 10, offset: 0 }
    filter: PostFilter
  ): [Post!]!
    @cypher(statements: [
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

  settings: UserSettings! @cypherSkip
}

type Query {
  user(id: ID!): User
    @cypher(
      statement: """
      MATCH (user:User {id: $args.id}) RETURN user
      """
    )

  post(id: ID!): Post
    @cypher(
      statement: """
      MATCH (post:Post {id: $args.id}) RETURN post
      """
    )

  userSettings(id: ID!): UserSettings
}

type Mutation {
  createUser(name: String!, email: String!): User!
    @generateId
    @cypher(
      statement: """
      CREATE (u:User {id: $generated.id, name: $args.name, email: $args.email}) RETURN u
      """
    )
}
`;
