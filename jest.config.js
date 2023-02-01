const SuiteCloudJestConfiguration = require("@oracle/suitecloud-unit-testing/jest-configuration/SuiteCloudJestConfiguration");
const cliConfig = require("./suitecloud.config");

module.exports = SuiteCloudJestConfiguration.build({
	projectFolder: cliConfig.defaultProjectFolder,
	projectType: SuiteCloudJestConfiguration.ProjectType.ACP,
	customStubs: [
		{
			module: "N/log",
			path: "<rootDir>/jestStubs/netsuite/log.js"
		},
		{
			module: "N/url",
			path: "<rootDir>/jestStubs/netsuite/url.js"
		},
		{
			module: "N/runtime",
			path: "<rootDir>/jestStubs/netsuite/runtime/runtime.js"
		}, 
		{
			module: "N/https/serverresponse",
			path: "<rootDir>/jestStubs/netsuite/https/ServerResponse.js"
		}, 
		
	]
});
