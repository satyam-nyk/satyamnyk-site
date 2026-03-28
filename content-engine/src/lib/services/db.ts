import mongoose from "mongoose";

const MONGODB_URI = (process.env.MONGODB_URI ?? "").trim();

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  var mongooseCache: MongooseCache | undefined;
}

const cache: MongooseCache = global.mongooseCache ?? {
  conn: null,
  promise: null,
};

global.mongooseCache = cache;

export async function connectToDb() {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not set");
  }

  if (cache.conn) {
    return cache.conn;
  }

  if (!cache.promise) {
    cache.promise = mongoose.connect(MONGODB_URI, {
      dbName: "content-engine",
      bufferCommands: false,
    });
  }

  cache.conn = await cache.promise;
  return cache.conn;
}
