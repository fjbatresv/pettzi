const { readFileSync } = require('fs');

// Reading the SWC compilation config for the spec files
const swcJestConfig = JSON.parse(
  readFileSync(`${__dirname}/.spec.swcrc`, 'utf-8')
);

// Disable .swcrc look-up by SWC core because we're passing in swcJestConfig ourselves
swcJestConfig.swcrc = false;

module.exports = {
  displayName: '@peto/api-catalogs',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['@swc/jest', swcJestConfig],
  },
  moduleNameMapper: {
    '^@peto/utils-dynamo/(.*)$': '<rootDir>/../utils-dynamo/src/$1',
    '^@peto/utils-dynamo$': '<rootDir>/../utils-dynamo/src/index',
    '^@peto/domain-model/(.*)$': '<rootDir>/../domain-model/src/$1',
    '^@peto/domain-model$': '<rootDir>/../domain-model/src/index',
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: 'test-output/jest/coverage',
};
