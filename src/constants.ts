import { DirectiveNames } from './types';

export const DEFAULT_DIRECTIVE_NAMES: DirectiveNames = {
  cypherCustom: 'cypherCustom',
  cypherSkip: 'cypherSkip',
  generateId: 'generateId',
  cypher: 'cypher',
  cypherNode: 'cypherNode',
  cypherRelationship: 'cypherRelationship',
  cypherVirtual: 'cypherVirtual',
  cypherLinkedNodes: 'cypherLinkedNodes',
  cypherComputed: 'cypherComputed',
};

export const IGNORED_FIELD_NAMES = ['__typename', '__schema', '__type'];
