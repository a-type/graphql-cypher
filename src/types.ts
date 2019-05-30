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
  kind: 'CustomCypherQuery';
  cypher: string;
};

export type BuilderCypherQuery = BaseCypherQuery & {
  kind: 'BuilderCypherQuery';
  match: string;
  optionalMatch?: string;
  when?: string;
  create: string[];
  merge: string[];
  set: string[];
  delete: string[];
  detachDelete: string[];
  remove: string[];
  orderBy?: string;
  skip?: string;
  limit?: string;
  return: string;
};

export type RelationshipDirection = 'OUT' | 'IN';

export type NodeCypherQuery = BaseCypherQuery & {
  kind: 'NodeCypherQuery';
  relationship: string;
  direction: RelationshipDirection;
  label: string;
};

export type RelationshipCypherQuery = BaseCypherQuery & {
  kind: 'RelationshipCypherQuery';
  relationshipType: string;
  direction: RelationshipDirection;
  nodeField: string;
  nodeLabel: string;
};

export type CypherQuery =
  | CustomCypherQuery
  | BuilderCypherQuery
  | NodeCypherQuery
  | RelationshipCypherQuery;

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
