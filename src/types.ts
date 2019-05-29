import { v1 } from 'neo4j-driver';

export type CustomCypherParams = {
  args?: {
    [name: string]: any;
  };
  generated?: {
    [name: string]: any;
  };
};

export type BaseCypherQuery = {
  returnsList: boolean;
  paramNames: string[];
  params: CustomCypherParams;
  fields: string[];
  fieldQueries: {
    [fieldName: string]: CypherQuery;
  };
};

export type CustomCypherQuery = BaseCypherQuery & {
  cypher: string;
};

export type CypherBuilderQuery = BaseCypherQuery & {
  match: string;
  optionalMatch?: string;
  when?: string;
  set?: string;
  delete?: string;
  detachDelete?: string;
  orderBy?: string;
  skip?: string;
  limit?: string;
  return: string;
};

export type RelationDirection = 'OUT' | 'IN';

export type CypherNodeQuery = BaseCypherQuery & {
  relation: string;
  direction: RelationDirection;
  label?: string;
};

export type CypherRelationQuery = BaseCypherQuery & {
  name: string;
  direction: RelationDirection;
  label?: string;
};

export type CypherQuery = CustomCypherQuery &
  CypherBuilderQuery &
  CypherNodeQuery &
  CypherRelationQuery;

export type CypherConditionalStatement = {
  statement: string;
  when?: string | null;
};

export type CypherDirectiveArgs = {
  statement?: string;
  statements?: CypherConditionalStatement[];
};

export type CypherQueryFieldMap = { [path: string]: CypherQuery };

export type AugmentedContext = { [key: string]: any } & {
  __graphqlCypher: {
    isWrite: boolean;
    cypherQueries: CypherQueryFieldMap;
    parentQuery: CypherQuery | null;
    resultCache: {
      [fieldName: string]: any;
    };
  };

  neo4jDriver: v1.Driver;
  cypherContext?: any;
};

export type DirectiveNames = {
  cypherCustom: string;
  cypherSkip: string;
  generateId: string;
};
