const { Logger, injectLambdaContext } = require('@aws-lambda-powertools/logger');
const { Tracer, captureLambdaHandler } = require('@aws-lambda-powertools/tracer');
const { Metrics, MetricUnits, logMetrics } = require('@aws-lambda-powertools/metrics');
const middy = require('@middy/core');
const { DynamoDB, Lambda } = require('aws-sdk');

// create Powertools Logger instance
const logger = new Logger({ serviceName: 'HitCounterFunction' });

// create Powertools Tracer instance
const tracer = new Tracer({ serviceName: 'HitCounterFunction' });

// create Powertools Metrics instance
const metrics = new Metrics({ namespace: 'HitCounter', serviceName: 'HitCounterFunction' });

// create AWS SDK clients with Powertools Tracer instrumentation to automatically capture traces
const dynamo = tracer.captureAWSClient(new DynamoDB());
const lambda = tracer.captureAWSClient(new Lambda());

const lambdaHandler = async function (event, context) {
  // Old way of logging
  console.log('Incoming Request:', { event });
  // New way of logging using Powertools Logger
  logger.info('Incoming Request:', { event });

  // Add custom annotation for filtering traces
  tracer.putAnnotation('awsRequestId', context.awsRequestId);
  // Add custom metadata for traces
  tracer.putMetadata('eventPayload', event);

  // update dynamo entry for "path" with hits++
  await dynamo
    .updateItem({
      TableName: process.env.HITS_TABLE_NAME,
      Key: { path: { S: event.path } },
      UpdateExpression: 'ADD hits :incr',
      ExpressionAttributeValues: { ':incr': { N: '1' } }
    })
    .promise();

  // create custom metric
  metrics.addMetric('hit', MetricUnits.Count, 1);
  metrics.publishStoredMetrics();

  // call downstream function and capture response
  const resp = await lambda
    .invoke({
      FunctionName: process.env.DOWNSTREAM_FUNCTION_NAME,
      Payload: JSON.stringify(event)
    })
    .promise();

  logger.info('Downstream Response:', { ...resp });

  // return response back to upstream caller
  return JSON.parse(resp.Payload);
};

// Use middy to add middleware to the Lambda handler. Although not required, this is the simplest way to use Lambda Powertools.
// It cleans up the handler and removes the need to add boilerplate code, while also allowing you to add custom middleware if needed.
// The Lambda Powertools middleware automatically captures AWS X-Ray traces, cold start metrics, and injects the Lambda Context into the Logger instance.
const handler = middy(lambdaHandler)
  .use(captureLambdaHandler(tracer))
  .use(
    logMetrics(metrics, {
      captureColdStartMetric: true
    })
  )
  .use(injectLambdaContext(logger));

module.exports = { handler };
