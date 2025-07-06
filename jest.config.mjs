// jest.config.js
export default {
    // Indicates whether the coverage information should be collected while executing the test
    collectCoverage: true,
    // The directory where Jest should output its coverage files
    coverageDirectory: 'coverage',
    // A list of paths to directories that Jest should use to search for files in
    roots: ['<rootDir>/src'],
    // The test environment that will be used for testing
    testEnvironment: 'node',
    // The file extensions your modules use
    moduleFileExtensions: ['js', 'json', 'node'],
    // Jest transformations -- this is crucial for ES6+ and ESM
    transform: {
        '^.+\\.js$': 'babel-jest',
    },
    moduleNameMapper: {
        // Config.js mappings removed. Will be handled by explicit mocks in test files.
    },
    // Support for __dirname, __filename if using ESM
    // setupFilesAfterEnv: ['./jest.setup.js'], // If needed for global mocks or setup
};
