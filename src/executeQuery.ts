import { v1 } from 'neo4j-driver';

export const executeCypherQuery = async ({
  fieldName,
  cypher,
  variables,
  session,
  write = false,
  isList,
}: {
  fieldName: string;
  cypher: string;
  variables: { [name: string]: any };
  session: v1.Session;
  isList: boolean;
  write?: boolean;
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
    return null;
  };

  if (write) {
    return await session.writeTransaction(work);
  } else {
    return await session.readTransaction(work);
  }
};
