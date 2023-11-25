import chalk from 'chalk';
import nodeCrypto from 'crypto';
import FS from 'fs';
import Path from 'path';
import PromiseThrottle from 'promise-throttle';
import {logger} from '../logger';

const promiseThrottle = new PromiseThrottle({requestsPerSecond: 1});

export function md5(input: string) {
  return nodeCrypto.createHash('md5').update(input).digest('hex');
}

function getPath(url: string) {
  return Path.join(__dirname, '../../cache', `${md5(url)}.txt`);
}

async function cachedFetch(urlObject: URL) {
  const url = urlObject.toString();

  const path = getPath(url);

  try {
    const text = await FS.promises.readFile(path, 'utf-8');
    logger.verbose(chalk.dim(`Fetch cached ${url}`));
    return text;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code !== 'ENOENT') {
      throw error;
    }

    const text = await promiseThrottle.add(async () => {
      logger.verbose(chalk.dim(`Fetch live ${url}`));
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP response not ok: ${url} ${response.statusText}`);
      }
      return response.text();
    });

    if (text) {
      await FS.promises.mkdir(Path.dirname(path), {recursive: true});
      await FS.promises.writeFile(path, text);
    }
    return text;
  }
}

export default cachedFetch;
