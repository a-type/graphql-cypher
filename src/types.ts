import { v1 } from 'neo4j-driver';

export type CustomCypherParams = {
  args?: {
    [name: string]: any;
  };
  generated?: {
    [name: string]: any;
  };
  virtual?: {
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
  returnsRelationship: boolean;
};

export type BuilderCypherQuery = BaseCypherQuery & {
  kind: 'BuilderCypherQuery';
  match?: string;
  optionalMatch?: string;
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
  where?: string;
};

export type RelationshipCypherQuery = BaseCypherQuery & {
  kind: 'RelationshipCypherQuery';
  relationshipType: string;
  direction: RelationshipDirection;
  nodeLabel: string;
  where?: string;
};

/** Virtual fragments create 'gaps' in the structure of the data without querying anything */
export type VirtualCypherQuery = BaseCypherQuery & {
  kind: 'VirtualCypherQuery';
};

export type LinkedNodesCypherQuery = BaseCypherQuery & {
  kind: 'LinkedNodesCypherQuery';
  relationship: string;
  direction: RelationshipDirection;
  label: string;
  skip?: string;
  limit?: string;
  where?: string;
};

export type CypherQuery =
  | CustomCypherQuery
  | BuilderCypherQuery
  | NodeCypherQuery
  | RelationshipCypherQuery
  | VirtualCypherQuery
  | LinkedNodesCypherQuery;

export type CypherConditionalStatement = {
  statement: string;
  when?: string | null;
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
  cypher: string;
  cypherNode: string;
  cypherRelationship: string;
  cypherCustom: string;
  cypherSkip: string;
  generateId: string;
  cypherVirtual: string;
  cypherLinkedNodes: string;
};

export type CypherBuilderDirectiveArgs = {
  kind: 'CypherBuilderDirective';
  match?: string;
  optionalMatch?: string;
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

export type CypherNodeDirectiveArgs = {
  kind: 'CypherNodeDirective';
  relationship: string;
  direction: RelationshipDirection;
  label?: string;
  where?: string;
};

export type CypherRelationshipDirectiveArgs = {
  kind: 'CypherRelationshipDirective';
  relationshipType: string;
  direction: RelationshipDirection;
  nodeLabel?: string;
  where?: string;
};

export type CypherCustomDirectiveArgs = {
  kind: 'CypherCustomDirective';
  cypher: string;
  returnsRelationship: boolean;
};

export type CypherVirtualDirectiveArgs = {
  kind: 'CypherVirtualDirective';
};

export type CypherLinkedNodesArgs = {
  kind: 'CypherLinkedNodesDirective';
  relationship: string;
  direction?: RelationshipDirection;
  skip?: string;
  limit?: string;
  label?: string;
  where?: string;
};

export type CypherDirectiveArgs =
  | CypherBuilderDirectiveArgs
  | CypherNodeDirectiveArgs
  | CypherRelationshipDirectiveArgs
  | CypherCustomDirectiveArgs
  | CypherVirtualDirectiveArgs
  | CypherLinkedNodesArgs;
