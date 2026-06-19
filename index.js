const express = require("express");
const dotenv = require("dotenv");
dotenv.config();

const app = express();
const cors = require("cors");
const port = process.env.PORT || 5000;
app.use(cors());
app.use(express.json());
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// const { createRemoteJWKSet, jwtVerify } = require('jose-cjs')

const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

//middleware

// const JWKS = createRemoteJWKSet(
//   new URL(`${process.env.CLIENT_URL}/api/auth/jwks`)
// );

//  ---------------------------------

// const verifyToken = async(req, res, next) => {
//   const authHeader = req?.headers.authorization;
//   if (!authHeader) {
//     return res.status(401).send({ message: "Unauthorized access1" });
//   }
//   const token= authHeader.split(" ")[1]
//   if(!token){
//     return res.status(401).send({ message: "Unauthorized access2" });
//   }
//  try{
//    const {payload} =await jwtVerify(token, JWKS)
//   console.log(payload)
//     next();
//  }
//  catch(err){
//    return res.status(401).send({ message: "Unauthorized access3" });
//  }
// }

async function run() {
  try {
    await client.connect();
    const db = client.db("LifeAtlas");
    //Database collections

    const subscriptionsCollection = db.collection("subscriptions");
    const userCollection = db.collection("user");

 app.post("/subscription", async (req, res) => {
  try {
    console.log("API HIT");
    console.log("BODY:", req.body);

    const data = req.body;

    const result = await subscriptionsCollection.insertOne({
      ...data,
      createdAt: new Date(),
    });

    console.log("INSERT RESULT:", result);

    const updateResult = await userCollection.updateOne(
      {
        _id: new ObjectId(data.userId),
      },
      {
        $set: {
          plan: "premium",
        },
      }
    );

    console.log("UPDATE RESULT:", updateResult);

    return res.send({
      success: true,
      subscriptionResult: result,
      updateResult,
    });
  } catch (error) {
    console.log("ERROR:", error);

    return res.status(500).send({
      success: false,
      message: error.message,
    });
  }
});

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // Ensures that the client will close when you finish/error
    //  await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Simple CRUD server is serving...");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
