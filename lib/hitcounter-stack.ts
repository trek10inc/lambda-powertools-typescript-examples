import * as cdk from 'aws-cdk-lib';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';

import { HitCounter } from './hitcounter';

export class HitCounterStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const helloFunction = new NodejsFunction(this, 'HelloFunction', {
      functionName: 'hello-hitcounter-function',
      runtime: lambda.Runtime.NODEJS_14_X,
      entry: path.join(__dirname, '../lambda/typescript/hello.ts'),
      handler: 'handler',
      bundling: {
        minify: true
      },
      tracing: lambda.Tracing.ACTIVE
    });

    const hitCounterFunction = new HitCounter(this, 'HitCounterFunction', {
      downstream: helloFunction,
      functionName: 'hitcounter-function',
      entryPath: '../lambda/typescript/hitcounter.ts',
      tableName: 'Hits'
    });

    // defines an API Gateway REST API resource backed by our "hello" function.
    new apigw.LambdaRestApi(this, 'HitCounterEndpoint', {
      restApiName: 'hitcounter-api',
      handler: hitCounterFunction.handler
    });
  }
}
