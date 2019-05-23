import { v1 as neo4j } from 'neo4j-driver';

export default async () => {
  const driver = neo4j.driver('bolt://localhost:7687');
  const session = driver.session('WRITE');

  await session.writeTransaction(async tx => {
    await tx.run(`

    `);
  });
};
