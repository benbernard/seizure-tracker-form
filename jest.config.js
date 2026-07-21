/** @type {import('jest').Config} */
const config = {
  projects: [
    {
      displayName: "node",
      preset: "ts-jest",
      testEnvironment: "node",
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
      },
      transform: {
        "^.+\\.tsx?$": [
          "ts-jest",
          {
            tsconfig: "tsconfig.json",
          },
        ],
      },
      testMatch: [
        "**/src/lib/**/__tests__/**/*.test.ts",
        "**/src/app/**/__tests__/**/*.test.ts",
        "**/scripts/__tests__/**/*.test.ts",
      ],
      setupFiles: ["<rootDir>/jest.setup.js"],
    },
    {
      displayName: "ui",
      preset: "ts-jest",
      testEnvironment: "jsdom",
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
      },
      transform: {
        "^.+\\.tsx?$": [
          "ts-jest",
          {
            tsconfig: "<rootDir>/tsconfig.test.json",
          },
        ],
      },
      testMatch: ["**/src/app/**/__tests__/**/*.test.tsx"],
      setupFilesAfterEnv: ["<rootDir>/jest.setup.ui.ts"],
    },
  ],
};

module.exports = config;
