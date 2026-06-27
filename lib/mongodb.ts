import { MongoClient, Db } from 'mongodb'

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined
}

// Deferred: only called at request time, not at module evaluation (build-safe)
function getClientPromise(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI!
  if (process.env.NODE_ENV === 'development') {
    if (!global._mongoClientPromise) {
      global._mongoClientPromise = new MongoClient(uri).connect()
    }
    return global._mongoClientPromise
  }
  return new MongoClient(uri).connect()
}

export async function getDb(): Promise<Db> {
  const client = await getClientPromise()
  return client.db(process.env.MONGODB_DB!)
}
