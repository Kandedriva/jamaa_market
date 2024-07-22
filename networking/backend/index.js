import express  from "express";
import bodyParser from "body-parser";
import env from "dotenv";
import cors from "cors";
import pg from "pg";

const app = express();
const port = 5001
env.config();
app.use(bodyParser.json())
app.use(cors())

const db = new pg.Client({
  user: "postgres",
  database: "networking",
  host: "localhost",
  password:"Dkkande",
  port: 5432
})

db.connect();

app.get("/", (req, res)=>{
  res.send("<h1>Hello from the Server</h1>")
})

app.post("/registration", async(req, res)=>{
  const {username, email, password} = req.body
  console.log(username, email, password)

try {
  const newUser = await db.query("INSERT INTO networking_users (user_name, email, user_password) VALUES($1, $2, $3)", [username, email, password])
  console.log(newUser)
} catch (error) {
  console.log(error)
}  
res.json({message: "Hello from the Server"})
})


app.listen(port, ()=>{
    console.log(`Server is running on port ${port}`)
})

