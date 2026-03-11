import "dotenv/config";
import app from "./app.js";
import connectToDatabase from "./database/mongodb.js";
import "./jobs/worker.js";
import {PORT, SERVER_URL} from "./config/env.js"; // registers Bull processor in-process

const startServer = async () => {
    try{
        await connectToDatabase();
        app.listen(PORT, () => {
            console.log(`Server is running at ${SERVER_URL}`);
            console.log(`Worker : running in-process\n`);
        })
    } catch(err){
        console.error("Database connection failed, Server not started", err);
        throw err;
    }
}

startServer();