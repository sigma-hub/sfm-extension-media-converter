globalThis.sigma = {
  i18n: {
    extensionT: (key: string) => key,
  },
  settings: {
    get: async () => undefined,
  },
  storage: {
    get: async () => null,
    set: async () => {},
  },
};
