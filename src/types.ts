import { v1 } from 'neo4j-driver';

export type CustomCypherParams = {
  args?: {
    [name: string]: any;
  };
  generated?: {
    [name: string]: any;
  };
};

export type CustomCypherQuery = {
  cypher: string;
  returnsList: boolean;
  paramNames: string[];
  params: CustomCypherParams;
  fields: string[];
  fieldQueries: {
    [fieldName: string]: CustomCypherQuery;
  };
};

export type CypherConditionalStatement = {
  statement: string;
  when?: string | null;
};

export type CypherDirectiveArgs = {
  statement?: string;
  statements?: CypherConditionalStatement[];
};

export type CypherQueryFieldMap = { [path: string]: CustomCypherQuery };

export type AugmentedContext = { [key: string]: any } & {
  __graphqlCypher: {
    isWrite: boolean;
    cypherQueries: CypherQueryFieldMap;
    parentQuery: CustomCypherQuery | null;
    resultCache: {
      [fieldName: string]: any;
    };
  };

  neo4jDriver: v1.Driver;
  cypherContext?: any;
};

export type DirectiveNames = {
  cypher: string;
  cypherSkip: string;
  generateId: string;
};
