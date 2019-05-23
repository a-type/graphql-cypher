export default (fakeRecords: { [name: string]: any }[]) => {
  return {
    records: fakeRecords.map(obj => ({
      get: (name: string) => obj[name],
    })),
  };
};
