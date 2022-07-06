import { injectLambdaContext, Logger } from '@aws-lambda-powertools/logger';
import { captureLambdaHandler, Tracer } from '@aws-lambda-powertools/tracer';
import middy from '@middy/core';
import { APIGatewayProxyStructuredResultV2, Context } from 'aws-lambda';

// Middy is only needed if you want to inject Lambda Context information into the Logger instance
// create Powertools Logger instance
const logger = new Logger({ serviceName: 'HelloFunction' });

// create Powertools Tracer instance
const tracer = new Tracer({ serviceName: 'HelloFunction' });

const lambdaHandler = async (event: any, context: Context): Promise<APIGatewayProxyStructuredResultV2> => {
  // Old way of logging
  console.log('Incoming Request:', { event });
  // New way of logging using Powertools Logger
  logger.info('Incoming Request:', { event });

  // Add custom annotation for filtering traces
  tracer.putAnnotation('awsRequestId', context.awsRequestId);
  // Add custom metadata for traces
  tracer.putMetadata('eventPayload', event);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/plain' },
    body: `Hello, World! You've hit "${event.path}".\n`
  };
};

// Use middy to add middleware to the Lambda handler. Although not required, this is the simplest way to use Lambda Powertools.
// It cleans up the handler and removes the need to add boilerplate code, while also allowing you to add custom middleware if needed.
// The middleware automatically captures AWS X-Ray traces and injects the Lambda Context into the Logger instance
export const handler = middy(lambdaHandler).use(captureLambdaHandler(tracer)).use(injectLambdaContext(logger));
