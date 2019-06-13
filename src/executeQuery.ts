import { v1 } from 'neo4j-driver';

export const executeCypherQuery = async ({
  fieldName,
  cypher,
  variables,
  driver,
  isWrite,
  isList,
}: {
  fieldName: string;
  cypher: string;
  variables: { [name: string]: any };
  driver: v1.Driver;
  isList: boolean;
  isWrite: boolean;
}): Promise<any> => {
  const work = async (tx: v1.Transaction) => {
    const result = await tx.run(cypher, variables);
    if (result.records && result.records.length) {
      if (isList) {
        return result.records.map(record => record.get(fieldName));
      } else {
        return result.records[0].get(fieldName);
      }
    }
    return isList ? [] : null;
  };

  const session = driver.session();
  let result;

  try {
    if (isWrite) {
      result = await session.writeTransaction(work);
    } else {
      result = await session.readTransaction(work);
    }
  } finally {
    session.close();
  }

  return result;
};
