export default {
    testEnvironment: 'jsdom',
    transform: {
        '^.+\\.js$': 'babel-jest'
    },
    moduleFileExtensions: ['js', 'json'],
    testMatch: ['**/?(*.)+(spec|test).[jt]s'],
    setupFiles: ['<rootDir>/tests/jest.setup.js'],
    collectCoverage: false
};
