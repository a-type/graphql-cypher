export default `
  input CypherConditionalStatement { statement: String!, when: String }
  directive @cypher(
    statement: String
    statements: [CypherConditionalStatement!]
  ) on FIELD_DEFINITION
  directive @cypherSkip on FIELD_DEFINITION
  directive @generateId(argName: String) on FIELD_DEFINITION

  type Person {
    id: ID!
    firstName: String!
    lastName: String!
    age: Int!

    skills: [Skill!]!
      @cypher(
        statement: """
        MATCH (parent)-[:HAS_SKILL]->(skill:Skill) RETURN skill
        """
      )
    livesIn: Country!
      @cypher(
        statement: """
        MATCH (parent)-[:LIVES_IN]->(country:Country) RETURN country
        """
      )

    jobApplications: [JobApplication!]! @cypherSkip
  }

  type Skill {
    id: ID!
    name: String!

    possessedBy: [Person!]!
      @cypher(
        statement: """
        MATCH (parent)<-[:HAS_SKILL]-(person:Person) RETURN person
        """
      )

    soughtBy: [Company!]!
      @cypher(
        statement: """
        MATCH (parent)<-[:LOOKS_FOR_COMPETENCE]-(company:Company) RETURN company
        """
      )
  }

  type Company {
    id: ID!
    name: String!
    catchPhrase: String!
    founded: String!

    seeks: [Skill!]!
      @cypher(
        statement: """
        MATCH (parent)-[:SEEKS]->(skill:Skill) RETURN skill
        """
      )

    locatedIn: Country!
      @cypher(
        statement: """
        MATCH (parent)-[:LOCATED_IN]->(country:Country) RETURN country
        """
      )
  }

  type Country {
    id: ID!
    name: String!

    hasResidents: [Person!]!
      @cypher(
        statement: """
        MATCH (parent)<-[:LIVES_IN]-(person:Person) RETURN person
        """
      )

    hasCompanyOffice: [Company!]!
      @cypher(
        statement: """
        MATCH (parent)<-[:LOCATED_IN]-(company:Company) RETURN company
        """
      )
  }

  type JobApplication {
    id: ID!

    applicant: Person!
      @cypher(
        statement: """
        MATCH (person:Person {id: parent.applicantId}) RETURN person
        """
      )

    company: Company!
      @cypher(
        statement: """
        MATCH (company:Company {id: parent.companyId}) RETURN company
        """
      )
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
        statement: """
        MATCH (person:Person{id: $args.id}) RETURN person
        """
      )

    people(pagination: PaginationInput = { first: 10, offset: 0 }): [Person!]!
      @cypher(
        statement: """
        MATCH (person:Person) RETURN person SKIP $args.pagination.offset LIMIT $args.pagination.first
        """
      )

    company(id: ID!): Company
      @cypher(
        statement: """
        MATCH (company:Company{id: $args.id}) RETURN company
        """
      )

    jobApplications: [JobApplication!]!
  }

  type Mutation {
    createPerson(input: PersonCreateInput!): Person!
      @generateId(argName: "id")
      @cypher(
        statement: """
        CREATE (person:Person{id: $generated.id})
        SET person += $args.input
        RETURN person
        """
      )

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
`;
