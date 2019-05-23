const mockTransaction = {
  run: jest.fn(),
};

const mockNeo4jDriver = {
  _mockTransaction: mockTransaction,
  session: jest.fn(() => ({
    readTransaction: jest.fn(runner => runner(mockTransaction)),
    writeTransaction: jest.fn(runner => runner(mockTransaction)),
    close: jest.fn(),
  })),
};

export default mockNeo4jDriver;
