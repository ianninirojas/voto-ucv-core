import "reflect-metadata";
import { createConnection } from "typeorm";
import express from "express";
import bodyParser from "body-parser";
import helmet from "helmet";
import cors from "cors";
import routes from "./routes";
// import { dbConnection } from "./config";
import { dbConfig } from "./config";

//Connects to the Database -> then starts the express
createConnection(dbConfig)
  .then(async connection => {
    // Create a new express application instance
    const app = express();

    // Call midlewares
    app.use(cors({ exposedHeaders: 'token' }));
    app.use(helmet());
    app.use(bodyParser.json());

    //Set all routes from routes folder
    app.use("/", routes);

    const PORT = process.env.PORT || 8080;

    app.listen(PORT, () => {
      console.log(`App listening on port ${PORT}`);
      console.log('Press Ctrl+C to quit.');
    });
  })
  .catch(error => console.log(error));