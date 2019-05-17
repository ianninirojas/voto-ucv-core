import 'reflect-metadata';
import { createConnection, Connection, ConnectionOptions } from 'typeorm';
import { join } from 'path';
const parentDir = join(__dirname, '..');

const prod: ConnectionOptions = {
  type: "mysql",
  host: "localhost",
  port: 3306,
  username: "root",
  password: "3k8J4TESma4HbvW",
  database: "voto_ucv",
  extra: {
    "socketPath": "/cloudsql/core-voto-ucv:us-central1:voto-ucv"
  },
  synchronize: true,
  logging: false,
  // connectTimeout: 2200,
  // acquireTimeout: 2200,
  entities: [
    `${parentDir}/entities/*.js`,
  ]
}

// const dev: ConnectionOptions = {
//   type: "mysql",
//   host: "35.226.48.37",
//   port: 3306,
//   username: "root",
//   password: "3k8J4TESma4HbvW",
//   database: "voto_ucv",
//   synchronize: true,
//   logging: false,
//   entities: [
//     `${parentDir}/entities/*.ts`,
//   ]
// }

const dev: ConnectionOptions = {
  type: "mysql",
  host: "localhost",
  port: 3306,
  username: "root",
  password: "",
  database: "voto-ucv",
  synchronize: true,
  logging: false,
  entities: [
    `${parentDir}/entities/*.ts`,
  ]
}
const dbConfig: ConnectionOptions = process.env.REACT_APP_ENV === "production" ? prod : dev;

// const dbConnection: Promise<Connection> = createConnection(dbConfig);

// console.log('process.env.REACT_APP_ENV :', process.env.REACT_APP_ENV);

// console.log('dbConfig :', dbConfig);

// console.log('dbConnection :', dbConnection.then(x => console.log('x ', x, ' x.entityMetadatas :', x.entityMetadatas)));

export { dbConfig };