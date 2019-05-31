import Docker, { Container } from 'dockerode';
import { resolve as pathResolve } from 'path';
import { emptyDir } from 'fs-extra';
import { PassThrough } from 'stream';
import seed from './seed';

const docker = new Docker({});
export const BOLT_PORT = '7687';

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

  await docker.pull('neo4j:3.5', {});

  let container: Container;

  docker.run(
    'neo4j:3.5',
    [],
    outputStream,
    {
      Labels: {
        'graphql-cypher-test': 'true',
      },
      Env: [
        'NEO4J_AUTH=none',
        'NEO4J_apoc_import_file_enabled=true',
        'NEO4J_apoc_import_file_use__neo4j__config=true',
        'NEO4J_dbms_security_procedures_unrestricted=apoc.*',
      ],
      HostConfig: {
        PortBindings: {
          [`7687/tcp`]: [
            {
              HostPort: BOLT_PORT,
            },
          ],
        },
        Binds: [
          pathResolve(__dirname, './mountedVolumes/plugins') + ':/plugins',
        ],
      },
      Volumes: {
        '/plugins': {},
      },
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
      if (container.Labels['graphql-cypher-test']) {
        console.log('Terminating container...');
        const realContainer = await docker.getContainer(container.Id);
        await realContainer.kill();
        await realContainer.remove();
      }
    })
  );
};
