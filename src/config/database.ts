import 'reflect-metadata';
import { createConnection, Connection, ConnectionOptions } from 'typeorm';
import { join } from 'path';
const parentDir = join(__dirname, '..');

const prod: ConnectionOptions = {
  type: "mysql",
  host: "35.226.48.37",
  port: 3306,
  username: "root",
  password: "3k8J4TESma4HbvW",
  database: "voto_ucv",
  synchronize: true,
  logging: false,
  entities: [
    `${parentDir}/**/*.entity.js`,
  ]
}

const dev: ConnectionOptions = {
  type: "mysql",
  host: "127.0.0.1",
  port: 3306,
  username: "root",
  password: "",
  database: "voto-ucv",
  synchronize: true,
  logging: false,
  entities: [
    `${parentDir}/**/*.entity.ts`,
  ]
}
const dbConfig: ConnectionOptions = process.env.REACT_APP_ENV === "production" ? prod : dev;

const dbConnection: Promise<Connection> = createConnection(dbConfig);

export { dbConnection };