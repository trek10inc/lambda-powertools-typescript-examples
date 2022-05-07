import { injectLambdaContext, Logger } from '@aws-lambda-powertools/logger';
import { captureLambdaHandler, Tracer } from '@aws-lambda-powertools/tracer';
import { Metrics, MetricUnits, logMetrics } from '@aws-lambda-powertools/metrics';
import middy from '@middy/core';
import { Context } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

// create Powertools Logger instance
const logger = new Logger({ serviceName: 'HitCounterFunction' });

// create Powertools Tracer instance
const tracer = new Tracer({ serviceName: 'HitCounterFunction' });

// create Powertools Metrics instance
const metrics = new Metrics({ namespace: 'HitCounter', serviceName: 'HitCounterFunction' });

// create AWS SDK clients with Powertools Tracer instrumentation to automatically capture traces
const dynamoDBClient = tracer.captureAWSv3Client(new DynamoDBClient({}));
const dynamoDBDocumentClient = DynamoDBDocumentClient.from(dynamoDBClient);
const lambdaClient = tracer.captureAWSv3Client(new LambdaClient({}));

const lambdaHandler = async (event: any, context: Context): Promise<unknown> => {
  // Old way of logging
  console.log('Incoming Request:', { event });
  // New way of logging using Powertools Logger
  logger.info('Incoming Request:', { event });

  // Add custom annotation for filtering traces
  tracer.putAnnotation('awsRequestId', context.awsRequestId);
  // Add custom metadata for traces
  tracer.putMetadata('eventPayload', event);

  const updateCommand = new UpdateCommand({
    TableName: process.env.HITS_TABLE_NAME,
    Key: { path: event.path },
    UpdateExpression: 'ADD hits :incr',
    ExpressionAttributeValues: { ':incr': 1 }
  });

  await dynamoDBDocumentClient.send(updateCommand);

  // create custom metric
  metrics.addMetric('hit', MetricUnits.Count, 1);
  metrics.publishStoredMetrics();

  const invokeCommand = new InvokeCommand({
    FunctionName: process.env.DOWNSTREAM_FUNCTION_NAME,
    Payload: Buffer.from(JSON.stringify(event))
  });

  const resp = await lambdaClient.send(invokeCommand);

  logger.info('Downstream Response:', { ...(resp as any) });

  // return response back to upstream caller
  if (resp.Payload) {
    return JSON.parse(Buffer.from(resp.Payload).toString());
  } else {
    return {};
  }
};

// Use middy to add middleware to the Lambda handler. Although not required, this is the simplest way to use Lambda Powertools.
// It cleans up the handler and removes the need to add boilerplate code, while also allowing you to add custom middleware if needed.
// The Lambda Powertools middleware automatically captures AWS X-Ray traces, cold start metrics, and injects the Lambda Context into the Logger instance.
export const handler = middy(lambdaHandler)
  .use(captureLambdaHandler(tracer))
  .use(
    logMetrics(metrics, {
      captureColdStartMetric: true
    })
  )
  .use(injectLambdaContext(logger));
