
var serverlessSDK = require('./serverless_sdk/index.js');
serverlessSDK = new serverlessSDK({
  orgId: 'oscarjvd',
  applicationName: 'my-express-application',
  appUid: 'jWmKTfLhqrXbBfc24g',
  orgUid: 'c5582f11-6e9e-4048-b036-8e996827efcf',
  deploymentUid: '7b5ac0b2-2699-4d96-b028-40a8d83c04e2',
  serviceName: 'my-express-application',
  shouldLogMeta: true,
  shouldCompressLogs: true,
  disableAwsSpans: false,
  disableHttpSpans: false,
  stageName: 'dev',
  serverlessPlatformStage: 'prod',
  devModeEnabled: false,
  accessKey: null,
  pluginVersion: '5.5.1',
  disableFrameworksInstrumentation: false
});

const handlerWrapperArgs = { functionName: 'my-express-application-dev-app', timeout: 6 };

try {
  const userHandler = require('./index.js');
  module.exports.handler = serverlessSDK.handler(userHandler.handler, handlerWrapperArgs);
} catch (error) {
  module.exports.handler = serverlessSDK.handler(() => { throw error }, handlerWrapperArgs);
}