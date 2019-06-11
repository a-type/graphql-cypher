import { directiveTypeDefs } from '../../typeDefs';

export default `
  ${directiveTypeDefs()}

  type Person {
    id: ID!
    firstName: String!
    lastName: String!
    age: Int!

    skills(strength: String = "any", category: String = "any"): [Skill!]!
      @cypherNode(
        relationship: "HAS_SKILL",
        direction: OUT,
        where: """
          ($args.strength = 'any' OR relationship.strength = $args.strength) AND
          ($args.category = 'any' OR node.category = $args.category)
        """
      )
    livesIn: Country! @cypherNode(relationship: "LIVES_IN", direction: OUT)
    friendships(type: String = "any"): [UserFriendship!]!
      @cypherRelationship(
        type: "FRIEND_OF",
        direction: OUT,
        where: "$args.type = 'any' OR relationship.type = $args.type"
      )
    friendshipsConnection(type: String = "any"): FriendshipsConnection!

    jobApplications: [JobApplication!]! @cypherSkip
  }

  type FriendshipsConnection @cypherVirtual {
    edges: [UserFriendship!]!
      @cypherRelationship(
        type: "FRIEND_OF",
        direction: OUT,
        where: "$virtual.type = 'any' OR relationship.type = $virtual.type"
      )
  }

  type UserFriendship {
    type: String!
    person: Person! @cypherNode(relationship: "FRIEND_OF", direction: OUT)
  }

  type Skill {
    id: ID!
    name: String!

    possessedBy: [Person!]! @cypherNode(relationship: "HAS_SKILL", direction: IN)
    soughtBy: [Company!]! @cypherNode(relationship: "SEEKS", direction: IN)
  }

  type Company {
    id: ID!
    name: String!
    catchPhrase: String!
    founded: String!

    seeks: [Skill!]! @cypherNode(relationship: "SEEKS", direction: OUT)
    locatedIn: Country! @cypherNode(relationship: "LOCATED_IN", direction: OUT)
  }

  type Country {
    id: ID!
    name: String!

    hasResidents: [Person!]! @cypherNode(relationship: "LIVES_IN", direction: IN)
    hasCompanyOffice: [Company!]! @cypherNode(relationship: "LOCATED_IN", direction: IN)
  }

  type JobApplication {
    id: ID!

    applicant: Person!
      @cypher(
        match: "(person:Person {id: parent.applicationId})"
        return: "person"
      )

    company: Company!
      @cypher(
        match: "(company:Company {id: parent.companyId})"
        return: "company"
      )
  }

  type VirtualLayer @cypherVirtual {
    person: Person @cypher(match: "(person:Person{id: $virtual.personId})", return: "person")
    company: Company @cypher(match: "(company:Company{id: $virtual.companyId})", return: "company")
  }

  input PaginationInput {
    first: Int
    offset: Int
  }

  input PersonCreateInput {
    firstName: String!
    lastName: String!
    age: Int!
  }

  input PersonUpdateInput {
    id: ID!
    firstName: String
    lastName: String
    age: Int
  }

  type Query {
    person(id: ID!): Person
      @cypher(
        match: "(person:Person{id: $args.id})"
        return: "person"
      )

    people(pagination: PaginationInput = { first: 10, offset: 0 }): [Person!]!
      @cypher(
        match: "(person:Person)"
        return: "person"
        skip: "$args.pagination.offset"
        limit: "$args.pagination.first"
      )

    company(id: ID!): Company
      @cypher(
        match: "(company:Company{id: $args.id})"
        return: "company"
      )

    jobApplications: [JobApplication!]!

    virtualLayer(personId: ID!, companyId: ID!): VirtualLayer!
  }

  type Mutation {
    createPerson(input: PersonCreateInput!): Person!
      @generateId(argName: "id")
      @cypher(
        create: "(person:Person{id: $generated.id})"
        set: "person += $args.input"
        return: "person"
      )

    updatePerson(input: PersonUpdateInput!): Person!
      @cypher(
        match: "(person:Person{id: $args.input.id})"
        setMany: [
          "person.firstName = coalesce($args.input.firstName, person.firstName)",
          "person.lastName = coalesce($args.input.lastName, person.lastName)",
          "person.age = coalesce($args.input.age, person.age)",
        ]
        return: "person"
      )
  }
`;
