#!/usr/bin/env node
import 'source-map-support/register';
import { App } from 'aws-cdk-lib';
import { HitCounterStack } from '../lib/hitcounter-stack';

const app = new App();
new HitCounterStack(app, 'HitCounterStack');
