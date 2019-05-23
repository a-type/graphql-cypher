import Docker, { Container } from 'dockerode';
import { resolve as pathResolve } from 'path';
import { emptyDir } from 'fs-extra';
import { PassThrough } from 'stream';
import seed from './seed';

const docker = new Docker({});

export const initialize = async () => {
  await emptyDir(pathResolve(__dirname, './mountedVolumes/data'));

  const outputStream = new PassThrough();
  const started = new Promise(resolve => {
    outputStream.on('data', (chunk: Buffer) => {
      const logline = chunk.toString('utf-8');
      if (logline.indexOf('Started.') >= 0) {
        console.info('Bolt ready');
        outputStream.removeAllListeners('data');
        resolve();
      }
    });
  });

  let container: Container;

  docker.run(
    'neo4j:3.5',
    [],
    outputStream,
    {
      Labels: {
        'neo4j-migrate-test': 'true',
      },
      Env: ['NEO4J_AUTH=none'],
      HostConfig: {
        PortBindings: {
          '7687/tcp': [
            {
              HostPort: '7687',
            },
          ],
        },
      },
      // Volumes: {
      //   '/plugins': pathResolve(__dirname, './mountedVolumes/plugins'),
      // },
    },
    (err, res) => {
      if (err) {
        console.error(err);
        throw new Error(err);
      }
      container = res;
    }
  );

  console.info('Waiting for Bolt port to be ready...');

  await started;

  console.info('Neo4j container ready!');
  console.info('Seeding db...');

  await seed();

  console.info('Seeding complete.');

  process.on('beforeExit', async () => {
    console.log('Killing and removing container...');
    await container.kill();
    await container.remove();
  });

  return async () => {
    await container.kill();
    await container.remove();
  };
};

export const cleanup = async () => {
  const containers = await docker.listContainers();
  await Promise.all(
    containers.map(async container => {
      if (container.Labels['neo4j-migrate-test']) {
        const realContainer = await docker.getContainer(container.Id);
        await realContainer.kill();
        await realContainer.remove();
      }
    })
  );
};
