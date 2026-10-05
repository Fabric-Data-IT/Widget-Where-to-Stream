import { define } from './element';

export { FabricWhereToStream, TAG, VERSION, define } from './element';
export { DEFAULT_API_BASE } from './api';
export type * from './types';

// Cargar el script ya registra <fabric-where-to-stream>. Es idempotente: dos copias del
// script en la misma página no tiran "already defined".
define();
