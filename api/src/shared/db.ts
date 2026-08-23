import { CosmosClient, Database, Container } from '@azure/cosmos';

let cosmosClient: CosmosClient | null = null;
let database: Database | null = null;
const containers: Map<string, Container> = new Map();

// Local In-Memory Fallback Store (when Cosmos DB connection string is missing or invalid)
const inMemoryStore: Map<string, Map<string, any>> = new Map([
  ['members', new Map()],
  ['shopping', new Map()],
  ['calendar', new Map()],
  ['feed', new Map()],
  ['subscriptions', new Map()]
]);

export function isCosmosConfigured(): boolean {
  const conn = process.env.COSMOS_DB_CONNECTION_STRING;
  return !!conn && !conn.includes('your-cosmos-account');
}

export async function getCosmosDatabase(): Promise<Database | null> {
  if (!isCosmosConfigured()) {
    return null;
  }

  if (database) {
    return database;
  }

  try {
    const connectionString = process.env.COSMOS_DB_CONNECTION_STRING!;
    cosmosClient = new CosmosClient(connectionString);
    const dbName = process.env.COSMOS_DB_DATABASE_NAME || 'HomePulseDB';
    const { database: db } = await cosmosClient.databases.createIfNotExists({ id: dbName });
    database = db;
    return database;
  } catch (error) {
    console.warn('Could not connect to Cosmos DB, falling back to in-memory store:', error);
    return null;
  }
}

export async function getContainer(containerName: string): Promise<Container | null> {
  if (containers.has(containerName)) {
    return containers.get(containerName)!;
  }

  const db = await getCosmosDatabase();
  if (!db) return null;

  try {
    const { container } = await db.containers.createIfNotExists({
      id: containerName,
      partitionKey: { paths: ['/id'] }
    });
    containers.set(containerName, container);
    return container;
  } catch (error) {
    console.warn(`Could not get/create container ${containerName}:`, error);
    return null;
  }
}

// Universal Data Operations (Cosmos DB with automatic In-Memory fallback)

export async function queryItems<T>(containerName: string, query?: string): Promise<T[]> {
  const container = await getContainer(containerName);
  if (container) {
    try {
      const q = query || 'SELECT * FROM c';
      const { resources } = await container.items.query<T>(q).fetchAll();
      return resources;
    } catch (error) {
      console.error(`Error querying Cosmos DB for ${containerName}:`, error);
    }
  }

  // Fallback to in-memory store
  const store = inMemoryStore.get(containerName);
  if (!store) return [];
  return Array.from(store.values()) as T[];
}

export async function getItemById<T = any>(containerName: string, id: string): Promise<T | null> {
  const container = await getContainer(containerName);
  if (container) {
    try {
      const { resource } = await container.item(id, id).read<any>();
      return (resource as unknown as T) || null;
    } catch (error: any) {
      if (error.code === 404) return null;
      console.error(`Error getting item ${id} from ${containerName}:`, error);
    }
  }

  const store = inMemoryStore.get(containerName);
  return (store?.get(id) as T) || null;
}

export async function saveItem<T extends { id: string }>(containerName: string, item: T): Promise<T> {
  const container = await getContainer(containerName);
  if (container) {
    try {
      const { resource } = await container.items.upsert<any>(item);
      return (resource as unknown as T) || item;
    } catch (error) {
      console.error(`Error saving item to Cosmos DB in ${containerName}:`, error);
    }
  }

  // Fallback to in-memory store
  if (!inMemoryStore.has(containerName)) {
    inMemoryStore.set(containerName, new Map());
  }
  inMemoryStore.get(containerName)!.set(item.id, item);
  return item;
}

export async function deleteItemById(containerName: string, id: string): Promise<boolean> {
  const container = await getContainer(containerName);
  if (container) {
    try {
      await container.item(id, id).delete();
      return true;
    } catch (error: any) {
      if (error.code === 404) return false;
      console.error(`Error deleting item from Cosmos DB in ${containerName}:`, error);
    }
  }

  const store = inMemoryStore.get(containerName);
  if (store && store.has(id)) {
    store.delete(id);
    return true;
  }
  return false;
}
