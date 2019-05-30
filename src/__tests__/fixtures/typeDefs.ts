import { directiveTypeDefs } from '../../directives';

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
    @cypherCustom(
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

  settings: UserSettings! @cypherSkip
}

type Query {
  user(id: ID!): User
    @cypherCustom(
      statement: """
      MATCH (user:User {id: $args.id}) RETURN user
      """
    )

  post(id: ID!): Post
    @cypherCustom(
      statement: """
      MATCH (post:Post {id: $args.id}) RETURN post
      """
    )

  userSettings(id: ID!): UserSettings
}

type Mutation {
  createUser(name: String!, email: String!): User!
    @generateId
    @cypherCustom(
      statement: """
      CREATE (u:User {id: $generated.id, name: $args.name, email: $args.email}) RETURN u
      """
    )
}
`;
