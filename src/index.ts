import {CloudFormation} from '@aws-sdk/client-cloudformation';
import {S3} from '@aws-sdk/client-s3';
import chalk from 'chalk';
import {program} from 'commander';
import {createDirs} from './createDirs';
import {scrape} from './scrape';
import {syncStack} from './syncStack';
import {SyncStackOutput} from './syncStack/getStackTemplate';
import {uploadOutputDir} from './uploadOutputDir';
import {writeSchemas} from './writeSchemas';

program.option('--skipAWS', 'Skip updating the AWS stack and uploading files to S3', false);

async function main() {
  program.parse();
  const options = program.opts<{skipAWS: boolean}>();

  const region = 'us-west-1';
  const s3 = new S3({region});
  const cloudFormation = new CloudFormation({region});

  let stack: SyncStackOutput | undefined;
  if (!options.skipAWS) {
    stack = await syncStack(cloudFormation);
  }

  await createDirs();
  await scrape();
  await writeSchemas();

  if (!options.skipAWS && stack) {
    await uploadOutputDir(s3, stack);
  }

  console.log(chalk.green(chalk.bold('Done')));
}

main();
