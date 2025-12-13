/* eslint-disable */
const { readFileSync } = require('fs');

// Reading the SWC compilation config for the spec files
const swcJestConfig = JSON.parse(
  readFileSync(`${__dirname}/.spec.swcrc`, 'utf-8')
);

// Disable .swcrc look-up by SWC core because we're passing in swcJestConfig ourselves
swcJestConfig.swcrc = false;

module.exports = {
  displayName: '@pettzi/api-owners',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['@swc/jest', swcJestConfig],
  },
  moduleNameMapper: {
    '^@pettzi/utils-dynamo/(.*)$': '<rootDir>/../utils-dynamo/src/$1',
    '^@pettzi/utils-dynamo$': '<rootDir>/../utils-dynamo/src/index',
    '^@pettzi/domain-model/(.*)$': '<rootDir>/../domain-model/src/$1',
    '^@pettzi/domain-model$': '<rootDir>/../domain-model/src/index',
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: 'test-output/jest/coverage',
};
