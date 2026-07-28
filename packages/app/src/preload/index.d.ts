import type { EmbroiderApi } from '../shared/ipc-contract.js';

declare global {
  interface Window {
    embroider: EmbroiderApi;
  }
}

export {};
