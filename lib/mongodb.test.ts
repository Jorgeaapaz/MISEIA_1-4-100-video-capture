import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockDb = vi.fn().mockReturnValue({ collection: vi.fn() })
const mockConnect = vi.fn()

vi.mock('mongodb', () => ({
  MongoClient: class MongoClient {
    connect() { return mockConnect() }
    db(...args: unknown[]) { return mockDb(...args) }
  },
  Db: class {},
}))

describe('lib/mongodb', () => {
  beforeEach(() => {
    vi.resetModules()
    delete (global as Record<string, unknown>)._mongoClientPromise
    mockConnect.mockReset()
    mockDb.mockReset()
  })

  it('getDb() calls client.db() with the configured DB name', async () => {
    process.env.MONGODB_URI = 'mongodb://localhost:27017'
    process.env.MONGODB_DB = 'test-db'

    mockConnect.mockResolvedValue({ db: mockDb })
    mockDb.mockReturnValue({ collection: vi.fn() })

    const { getDb } = await import('./mongodb')
    await getDb()

    expect(mockDb).toHaveBeenCalledWith('test-db')
  })

  it('getDb() returns a defined value', async () => {
    process.env.MONGODB_URI = 'mongodb://localhost:27017'
    process.env.MONGODB_DB = 'test-db'

    const fakeDb = { collection: vi.fn() }
    mockConnect.mockResolvedValue({ db: () => fakeDb })
    mockDb.mockReturnValue(fakeDb)

    const { getDb } = await import('./mongodb')
    const db = await getDb()
    expect(db).toBeDefined()
  })

  it('getDb() can be called multiple times safely', async () => {
    process.env.MONGODB_URI = 'mongodb://localhost:27017'
    process.env.MONGODB_DB = 'test-db'

    const fakeDb = { collection: vi.fn() }
    mockConnect.mockResolvedValue({ db: () => fakeDb })

    const { getDb } = await import('./mongodb')
    const db1 = await getDb()
    const db2 = await getDb()
    expect(db1).toBeDefined()
    expect(db2).toBeDefined()
  })
})
