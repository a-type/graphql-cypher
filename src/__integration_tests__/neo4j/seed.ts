import { v1 as neo4j } from 'neo4j-driver';
import { seed, random, company, name, hacker, date, address } from 'faker';

seed(345636);

export const people = new Array(5).fill(null).map(() => ({
  id: random.uuid(),
  firstName: name.firstName(),
  lastName: name.lastName(),
  age: random.number({ min: 20, max: 70 }),
}));

export const skills = new Array(5).fill(null).map(() => ({
  id: random.uuid(),
  name: hacker.ingverb(),
}));

export const companies = new Array(7).fill(null).map(() => ({
  id: random.uuid(),
  name: company.companyName(),
  catchPhrase: company.catchPhrase(),
  founded: neo4j.types.Date.fromStandardDate(date.past(30)),
}));

export const countries = new Array(3).fill(null).map(() => ({
  id: random.uuid(),
  name: address.country(),
}));

export const userSkills = [
  [people[0].id, skills[0].id],
  [people[0].id, skills[1].id],
  [people[1].id, skills[2].id],
  [people[2].id, skills[0].id],
  [people[2].id, skills[3].id],
  [people[2].id, skills[4].id],
  [people[3].id, skills[1].id],
  [people[3].id, skills[4].id],
  [people[4].id, skills[2].id],
  [people[4].id, skills[3].id],
];

export const userLivesIn = [
  [people[0].id, countries[0].id],
  [people[1].id, countries[0].id],
  [people[2].id, countries[1].id],
  [people[3].id, countries[2].id],
  [people[4].id, countries[2].id],
];

export const companySeeks = [
  [companies[0].id, skills[0].id],
  [companies[0].id, skills[3].id],
  [companies[0].id, skills[4].id],
  [companies[1].id, skills[2].id],
  [companies[1].id, skills[3].id],
  [companies[1].id, skills[4].id],
  [companies[2].id, skills[0].id],
  [companies[2].id, skills[1].id],
  [companies[2].id, skills[4].id],
  [companies[3].id, skills[1].id],
  [companies[3].id, skills[3].id],
  [companies[3].id, skills[4].id],
  [companies[4].id, skills[0].id],
  [companies[4].id, skills[2].id],
  [companies[4].id, skills[3].id],
  [companies[5].id, skills[1].id],
  [companies[5].id, skills[2].id],
  [companies[5].id, skills[4].id],
  [companies[6].id, skills[0].id],
  [companies[6].id, skills[4].id],
];

export const companyLocatedIn = [
  [companies[0].id, countries[0].id],
  [companies[1].id, countries[0].id],
  [companies[2].id, countries[1].id],
  [companies[3].id, countries[1].id],
  [companies[4].id, countries[1].id],
  [companies[5].id, countries[2].id],
  [companies[6].id, countries[2].id],
];

export default async () => {
  const driver = neo4j.driver('bolt://localhost:7687');
  const session = driver.session('WRITE');
  await session.writeTransaction(async tx => {
    const constraints = [
      'CREATE CONSTRAINT ON (person:Person) ASSERT person.id IS UNIQUE;',
      'CREATE CONSTRAINT ON (skill:Skill) ASSERT skill.id IS UNIQUE;',
      'CREATE CONSTRAINT ON (company:Company) ASSERT company.id IS UNIQUE;',
      'CREATE CONSTRAINT ON (country:Country) ASSERT country.id IS UNIQUE;',
      'CREATE CONSTRAINT ON (company:Company) ASSERT company.name IS UNIQUE;',
      'CREATE CONSTRAINT ON (country:Country) ASSERT country.name IS UNIQUE;',
      'CREATE CONSTRAINT ON (skill:Skill) ASSERT skill.name IS UNIQUE;',
    ];
    for (let constraint of constraints) {
      await tx.run(constraint);
    }
  });

  await session.writeTransaction(async tx => {
    await tx.run(
      `
      UNWIND $people as person
      CREATE (p:Person)
      SET p += person
      `,
      {
        people,
      }
    );

    await tx.run(
      `
      UNWIND $companies as company
      CREATE (c:Company)
      SET c += company
      `,
      {
        companies,
      }
    );

    await tx.run(
      `
      UNWIND $skills as skill
      CREATE (s:Skill)
      SET s += skill
      `,
      {
        skills,
      }
    );

    await tx.run(
      `
      UNWIND $countries as country
      CREATE (c:Country)
      SET c += country
      `,
      {
        countries,
      }
    );

    await tx.run(
      `
      UNWIND $userSkills as userSkill
      MATCH (u:Person {id: userSkill[0]}), (s:Skill {id: userSkill[1]})
      CREATE (u)-[:HAS_SKILL]->(s)
      `,
      {
        userSkills,
      }
    );

    await tx.run(
      `
      UNWIND $userLivesIn as userLivesIn
      MATCH (u:Person {id: userLivesIn[0]}), (c:Country {id: userLivesIn[1]})
      CREATE (u)-[:LIVES_IN]->(c)
      `,
      {
        userLivesIn,
      }
    );

    await tx.run(
      `
      UNWIND $companySeeks as companySeek
      MATCH (c:Company {id: companySeek[0]}), (s:Skill {id: companySeek[1]})
      CREATE (c)-[:SEEKS]->(s)
      `,
      {
        companySeeks,
      }
    );

    await tx.run(
      `
      UNWIND $companyLocatedIn as companyLocated
      MATCH (c:Company {id: companyLocated[0]}), (o:Country {id: companyLocated[1]})
      CREATE (c)-[:LOCATED_IN]->(o)
      `,
      {
        companyLocatedIn,
      }
    );
  });
};
