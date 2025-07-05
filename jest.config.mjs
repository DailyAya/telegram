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
        // This will map imports of './config.js' from any file under <rootDir>
        // (which includes src/) to the mock file.
        // Escaping the dot to match a literal dot.
        '^\\./config\\.js$': '<rootDir>/src/__mocks__/config.mock.js',
        // This would map an import of 'src/config.js' (e.g. if used from outside src or with base URLs)
        '^src/config\\.js$': '<rootDir>/src/__mocks__/config.mock.js',
    },
    // Support for __dirname, __filename if using ESM
    // setupFilesAfterEnv: ['./jest.setup.js'], // If needed for global mocks or setup
};
